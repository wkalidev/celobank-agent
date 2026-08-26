import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Mock } from "vitest"

vi.mock("../lib/activity-store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/activity-store.js")>()
  return { ...actual, getActivity: vi.fn(), markRewardClaimed: vi.fn() }
})

vi.mock("./prepare.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./prepare.js")>()
  return {
    ...actual,
    publicClient: {
      readContract: vi.fn(),
      getBlockNumber: vi.fn(),
      simulateContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
    },
  }
})

import { getActivity } from "../lib/activity-store.js"
import { publicClient } from "./prepare.js"
import {
  claimEngagementRewardTool,
  checkOnChainEligibility,
  prepareEngagementClaim,
  submitEngagementClaim,
} from "./engagement.js"
import type { EngagementClients } from "./engagement.js"

const USER = "0x000000000000000000000000000000000000a1" as `0x${string}`
const APP  = "0x000000000000000000000000000000000000a2" as `0x${string}`

function fakeClients(overrides: Partial<{
  readContract: Mock
  getBlockNumber: Mock
  simulateContract: Mock
  writeContract: Mock
  waitForTransactionReceipt: Mock
}> = {}): EngagementClients {
  return {
    publicClient: {
      readContract: overrides.readContract ?? vi.fn(),
      getBlockNumber: overrides.getBlockNumber ?? vi.fn().mockResolvedValue(1000n),
      simulateContract: overrides.simulateContract ?? vi.fn(),
      waitForTransactionReceipt: overrides.waitForTransactionReceipt ?? vi.fn().mockResolvedValue({ status: "success" }),
    } as any,
    walletClient: {
      writeContract: overrides.writeContract ?? vi.fn().mockResolvedValue("0xtxhash"),
    } as any,
    appAccount: { address: APP, type: "json-rpc" } as any,
  }
}

describe("checkOnChainEligibility", () => {
  it("returns canClaim: true when the on-chain read succeeds", async () => {
    const clients = fakeClients({ readContract: vi.fn().mockResolvedValue(true) })
    const result = await checkOnChainEligibility(USER, clients)
    expect(result).toEqual({ canClaim: true })
  })

  it("parses a known revert reason out of the thrown error", async () => {
    const clients = fakeClients({
      readContract: vi.fn().mockRejectedValue(new Error("execution reverted: App not approved or registered")),
    })
    const result = await checkOnChainEligibility(USER, clients)
    expect(result).toEqual({ canClaim: false, reason: "App not approved or registered" })
  })

  it("falls back to a generic reason for an unrecognized revert", async () => {
    const clients = fakeClients({ readContract: vi.fn().mockRejectedValue(new Error("mystery revert")) })
    const result = await checkOnChainEligibility(USER, clients)
    expect(result).toEqual({ canClaim: false, reason: "Not eligible to claim right now." })
  })
})

describe("prepareEngagementClaim", () => {
  it("builds EIP-712 typed data using the on-chain description and a bounded validUntilBlock", async () => {
    // registeredApps(...) tuple — description is index 9
    const appInfoTuple = [
      "0xowner", "0xreceiver", 0n, 0, 0, 80, 60, true, true,
      "CeloBank Agent — a description at least fifty characters long for validity.",
      "https://example.com", "ops@example.com", APP, "0x0000000000000000000000000000000000000000",
    ]
    const clients = fakeClients({
      readContract: vi.fn().mockResolvedValue(appInfoTuple),
      getBlockNumber: vi.fn().mockResolvedValue(12345n),
    })

    const claim = await prepareEngagementClaim(clients)

    expect(claim.domain).toEqual({ name: "EngagementRewards", version: "1.0", chainId: 42220, verifyingContract: expect.any(String) })
    expect(claim.message.app).toBe(APP)
    expect(claim.message.description).toBe(appInfoTuple[9])
    expect(claim.message.inviter).toMatch(/^0x0+$/)
    expect(BigInt(claim.message.validUntilBlock)).toBeGreaterThan(12345n)
    expect(BigInt(claim.message.validUntilBlock) - 12345n).toBeLessThanOrEqual(600n)
  })
})

describe("submitEngagementClaim", () => {
  const message = { app: APP, inviter: "0x0000000000000000000000000000000000000000" as `0x${string}`, validUntilBlock: "2000", description: "x" }

  it("simulates then writes appClaim and records the resulting tx hash on success", async () => {
    const simulateContract = vi.fn().mockResolvedValue({ request: { fake: "request" } })
    const writeContract = vi.fn().mockResolvedValue("0xabc123")
    const clients = fakeClients({ simulateContract, writeContract })

    const result = await submitEngagementClaim(USER, message, "0xsig" as `0x${string}`, clients)

    expect(result).toEqual({ success: true, txHash: "0xabc123" })
    expect(simulateContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "appClaim",
      args: [USER, message.inviter, 2000n, "0xsig"],
    }))
  })

  it("returns success: false with the error message when simulation/write fails", async () => {
    const clients = fakeClients({ simulateContract: vi.fn().mockRejectedValue(new Error("Claim cooldown not reached")) })
    const result = await submitEngagementClaim(USER, message, "0xsig" as `0x${string}`, clients)
    expect(result.success).toBe(false)
    expect(result.error).toContain("Claim cooldown not reached")
  })
})

describe("claimEngagementRewardTool", () => {
  beforeEach(() => {
    vi.mocked(getActivity).mockReset()
    vi.mocked(publicClient.readContract).mockReset()
    vi.mocked(publicClient.getBlockNumber).mockReset()
  })

  it("asks for a wallet address if none is provided", async () => {
    const result = await claimEngagementRewardTool.invoke({})
    expect(result).toContain("connect your wallet")
  })

  it("reports the product-level gate reason when DB activity is insufficient", async () => {
    vi.mocked(getActivity).mockResolvedValue({
      address: USER, actionCount: 1, firstActionAt: new Date(), lastActionAt: new Date(), rewardClaimedAt: null,
    })
    const result = await claimEngagementRewardTool.invoke({ address: USER })
    expect(result).toContain("not ready yet")
    expect(result).toContain("at least 2")
    expect(publicClient.readContract).not.toHaveBeenCalled() // never hits the chain if the DB gate already fails
  })

  it("reports the on-chain gate reason when DB-eligible but canClaim() reverts", async () => {
    vi.mocked(getActivity).mockResolvedValue({
      address: USER, actionCount: 2,
      firstActionAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      lastActionAt: new Date(), rewardClaimedAt: null,
    })
    vi.mocked(publicClient.readContract).mockRejectedValue(new Error("App not approved or registered"))

    const result = await claimEngagementRewardTool.invoke({ address: USER })
    expect(result).toContain("App not approved or registered")
  })

  it("returns the unsigned-typed-data marker payload once both gates pass", async () => {
    vi.mocked(getActivity).mockResolvedValue({
      address: USER, actionCount: 2,
      firstActionAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      lastActionAt: new Date(), rewardClaimedAt: null,
    })
    const appInfoTuple = [
      "0xowner", "0xreceiver", 0n, 0, 0, 80, 60, true, true,
      "CeloBank Agent — a description at least fifty characters long for validity.",
      "https://example.com", "ops@example.com", APP, "0x0000000000000000000000000000000000000000",
    ]
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(true)          // canClaim()
      .mockResolvedValueOnce(appInfoTuple)  // registeredApps() inside prepareEngagementClaim
    vi.mocked(publicClient.getBlockNumber).mockResolvedValue(9999n)

    const result = await claimEngagementRewardTool.invoke({ address: USER })
    expect(result.startsWith("__CELOBANK_UNSIGNED_TYPED_DATA__")).toBe(true)

    const payload = JSON.parse(result.slice("__CELOBANK_UNSIGNED_TYPED_DATA__".length))
    expect(payload.success).toBe(true)
    expect(payload.action).toBe("claim_engagement_reward")
    expect(payload.message.description).toBe(appInfoTuple[9])
  })
})
