import "dotenv/config"
import { createWalletClient, http, defineChain, zeroAddress } from "viem"
import type { PublicClient, WalletClient, Account } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { publicClient, UNSIGNED_TYPED_DATA_MARKER } from "./prepare.js"
import { getActivity, isEligible, markRewardClaimed } from "../lib/activity-store.js"

// ─── GoodDollar EngagementRewards ───────────────────────────────────────────
// See EngagementRewards.sol in github.com/GoodDollar/GoodSDKs. There is no
// "automatic on verification" mode — every reward requires an explicit appClaim
// call from the registered app (msg.sender must equal the app address), gated
// on-chain by canClaim() (GoodDollar identity verification + a 180-day per-user
// cooldown + app approval + the app's own reward budget).
const PROD_REWARDS_CONTRACT = "0x25db74CF4E7BA120526fd87e159CF656d94bAE43" as `0x${string}`
const DEV_REWARDS_CONTRACT  = "0xb44fC3A592aDaA257AECe1Ae8956019EA53d0465" as `0x${string}`

// CeloBank's live registration has isApproved=false pending GoodDollar review — until
// that flips, appClaim would always revert on prod. Default to the dev deployment
// (IS_DEV_ENV=true there lets an app self-approve) so this path is buildable and
// testable now; flip via env once GoodDollar approves the prod registration.
export const REWARDS_CONTRACT: `0x${string}` =
  process.env.ENGAGEMENT_REWARDS_ENV === "prod" ? PROD_REWARDS_CONTRACT : DEV_REWARDS_CONTRACT

const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC ?? "https://forno.celo.org"] } },
})

const rawKey = process.env.PRIVATE_KEY!.trim()
const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`
const appAccount = privateKeyToAccount(privateKey)

const defaultWalletClient = createWalletClient({ account: appAccount, chain: celo, transport: http() })

const ENGAGEMENT_REWARDS_ABI = [
  {
    name: "canClaim", type: "function", stateMutability: "view",
    inputs: [{ name: "app", type: "address" }, { name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "registeredApps", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "owner", type: "address" }, { name: "rewardReceiver", type: "address" },
      { name: "totalRewardsClaimed", type: "uint96" }, { name: "registeredAt", type: "uint32" },
      { name: "lastResetAt", type: "uint32" }, { name: "userAndInviterPercentage", type: "uint8" },
      { name: "userPercentage", type: "uint8" }, { name: "isRegistered", type: "bool" },
      { name: "isApproved", type: "bool" }, { name: "description", type: "string" },
      { name: "url", type: "string" }, { name: "email", type: "string" },
      { name: "app", type: "address" }, { name: "signer", type: "address" },
    ],
  },
  {
    name: "appClaim", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" }, { name: "inviter", type: "address" },
      { name: "validUntilBlock", type: "uint256" }, { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

// ─── Dependency injection (production defaults, overridable for tests) ─────
export interface EngagementClients {
  publicClient: PublicClient
  walletClient: WalletClient
  appAccount:   Account
}

const defaultClients: EngagementClients = {
  publicClient,
  walletClient: defaultWalletClient,
  appAccount,
}

// ─── canClaim() revert-reason parsing ───────────────────────────────────────
// canClaim() is pure require()-chain-then-return-true — it never returns false,
// it reverts. We surface the on-chain reason as-is so users see exactly what's
// blocking them (not approved yet, cooldown, not GoodDollar-verified, ...).
const KNOWN_REVERT_REASONS = [
  "User not whitelisted",
  "Claim cooldown not reached",
  "App not approved or registered",
  "App registration expired",
  "App maxed rewards",
  "Max apps per period reached",
  "Insufficient reward token balance",
  "Reward amount must be greater than zero",
  "Invalid user address",
]

function parseKnownRevertReason(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : String(e)
  return KNOWN_REVERT_REASONS.find(reason => msg.includes(reason)) ?? fallback
}

function parseCanClaimRevertReason(e: unknown): string {
  return parseKnownRevertReason(e, "Not eligible to claim right now.")
}

export interface OnChainEligibility {
  canClaim: boolean
  reason?:  string
}

export async function checkOnChainEligibility(
  userAddress: `0x${string}`,
  clients: EngagementClients = defaultClients
): Promise<OnChainEligibility> {
  try {
    await clients.publicClient.readContract({
      address: REWARDS_CONTRACT, abi: ENGAGEMENT_REWARDS_ABI, functionName: "canClaim",
      args: [clients.appAccount.address, userAddress],
    })
    return { canClaim: true }
  } catch (e) {
    return { canClaim: false, reason: parseCanClaimRevertReason(e) }
  }
}

// ─── EIP-712 claim signature request ────────────────────────────────────────
export interface ClaimTypedData {
  domain:  { name: string; version: string; chainId: number; verifyingContract: `0x${string}` }
  types:   { Claim: Array<{ name: string; type: string }> }
  message: { app: `0x${string}`; inviter: `0x${string}`; validUntilBlock: string; description: string }
}

// validUntilBlock must satisfy the contract's `validUntilBlock <= block.number + 600`
// at submission time — 500 leaves headroom for the sign-then-submit round trip
// (~5s Celo blocks => ~40min window) without drifting past the contract's own cap.
const VALID_UNTIL_BLOCK_BUFFER = 500n

export async function prepareEngagementClaim(
  clients: EngagementClients = defaultClients
): Promise<ClaimTypedData> {
  const appInfo = await clients.publicClient.readContract({
    address: REWARDS_CONTRACT, abi: ENGAGEMENT_REWARDS_ABI, functionName: "registeredApps",
    args: [clients.appAccount.address],
  })
  const description = appInfo[9] // must exactly match on-chain storage — the contract
  // hashes registeredApps[app].description itself, not whatever we pass in the message.

  const currentBlock = await clients.publicClient.getBlockNumber()
  const validUntilBlock = (currentBlock + VALID_UNTIL_BLOCK_BUFFER).toString()

  return {
    domain: { name: "EngagementRewards", version: "1.0", chainId: 42220, verifyingContract: REWARDS_CONTRACT },
    types:  { Claim: [
      { name: "app", type: "address" }, { name: "inviter", type: "address" },
      { name: "validUntilBlock", type: "uint256" }, { name: "description", type: "string" },
    ] },
    // No referral graph exists yet in this codebase — inviter defaults to the zero
    // address; the contract reallocates the inviter's share to the app in that case.
    // Wiring a real inviter address here is a natural follow-up, not in this rework's scope.
    message: { app: clients.appAccount.address, inviter: zeroAddress, validUntilBlock, description },
  }
}

// ─── Submission (agent's own wallet — pays its own gas, never touches user funds) ──
export interface ClaimSubmission {
  success: boolean
  txHash?: string
  error?:  string
}

export async function submitEngagementClaim(
  userAddress: `0x${string}`,
  message: ClaimTypedData["message"],
  signature: `0x${string}`,
  clients: EngagementClients = defaultClients
): Promise<ClaimSubmission> {
  try {
    const { request } = await clients.publicClient.simulateContract({
      address: REWARDS_CONTRACT, abi: ENGAGEMENT_REWARDS_ABI, functionName: "appClaim",
      args: [userAddress, message.inviter, BigInt(message.validUntilBlock), signature],
      account: clients.appAccount,
    })
    const hash = await clients.walletClient.writeContract(request)
    // waitForTransactionReceipt does NOT throw on revert — it resolves with
    // status: "reverted". A reverted appClaim (e.g. lost a race for the app's
    // per-period budget) must not consume the user's claim.
    const receipt = await clients.publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== "success") {
      return { success: false, error: `Transaction reverted (${hash})` }
    }
    try {
      await markRewardClaimed(userAddress, hash)
    } catch (dbErr) {
      // The on-chain claim already succeeded and consumed the contract's own
      // ~180-day cooldown — a DB blip here must not turn that into a reported
      // failure (the user would retry, hit "Claim cooldown not reached" on-chain,
      // and be stuck for the rest of the cooldown with no record of their tx).
      // The row is recoverable later from appClaim event logs; the tx hash isn't
      // if we drop it here.
      console.error("[engagement] markRewardClaimed failed after successful on-chain claim — backfill from event logs, tx:", hash, dbErr instanceof Error ? dbErr.message : dbErr)
    }
    return { success: true, txHash: hash }
  } catch (e) {
    // simulateContract/writeContract errors carry raw viem internals (RPC URLs,
    // request bodies, dependency version strings) — never forward those to an
    // unauthenticated caller. Log the full error server-side, surface only an
    // allowlisted revert reason (or a fixed fallback) to the response, matching
    // the same KNOWN_REVERT_REASONS pattern checkOnChainEligibility already uses.
    console.error("[engagement] submitEngagementClaim failed:", e instanceof Error ? e.message : e)
    return { success: false, error: parseKnownRevertReason(e, "Claim failed on-chain.") }
  }
}

// ─── Tool wrapper (LangChain-compatible .invoke() interface, matches gooddollar.ts) ──
export const claimEngagementRewardTool = {
  invoke: async (args: { address?: string }): Promise<string> => {
    if (!args.address) return "❌ Please connect your wallet to check engagement reward eligibility."
    const addr = args.address as `0x${string}`

    const activity   = await getActivity(addr)
    const productGate = isEligible(activity)
    if (!productGate.eligible) {
      // The "N/2 actions so far" line only makes sense when the blocker IS the
      // action count/returning-user window — during the post-claim cooldown,
      // actionCount is 0 by design (getActivity() only counts activity since the
      // last claim) and printing "0/2" there reads as "you've never used CeloBank",
      // which is wrong and sends users off to do 2 needless actions.
      const isCooldown = productGate.reason?.startsWith("Engagement reward already claimed")
      return `🎁 Engagement reward not ready yet.
> ${productGate.reason}${isCooldown ? "" : `
> Genuine CeloBank actions so far: ${activity?.actionCount ?? 0}/2 (swap, save, stake, or launch a token — the 3-step unstake counts once as a full cycle; a plain send doesn't count, since it has no CeloBank contract to verify against)
> Also make sure you're GoodDollar-verified: https://wallet.gooddollar.org`}`
    }

    const chainGate = await checkOnChainEligibility(addr)
    if (!chainGate.canClaim) {
      return `🎁 You qualify by CeloBank activity, but the GoodDollar contract says: ${chainGate.reason}
> (Most likely: not GoodDollar-verified yet, or CeloBank's app registration isn't approved yet.)`
    }

    const claim = await prepareEngagementClaim()
    return UNSIGNED_TYPED_DATA_MARKER + JSON.stringify({
      success:     true,
      action:      "claim_engagement_reward",
      userAddress: addr,
      summary:     "Ready to claim your CeloBank x GoodDollar engagement reward. Sign the message in your wallet — this costs no gas and moves none of your funds.",
      ...claim,
    })
  },
}
