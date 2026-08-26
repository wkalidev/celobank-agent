import { describe, it, expect, vi, beforeEach, afterAll } from "vitest"

vi.mock("./db.js", () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  runMigrations: vi.fn(),
}))

import { isEligible, resolveCycleKey, isQualifyingAction, matchesActionTarget, getActivity, RETURNING_USER_WINDOW_MS, MIN_QUALIFYING_ACTIONS, REWARD_COOLDOWN_MS } from "./activity-store.js"
import { pool } from "./db.js"
import type { ActivityRow } from "./activity-store.js"

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date("2026-08-26T00:00:00.000Z")

function row(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    address: "0xabc",
    actionCount: 0,
    firstActionAt: null,
    lastActionAt: null,
    rewardClaimedAt: null,
    ...overrides,
  }
}

describe("isEligible", () => {
  it("rejects no activity at all", () => {
    expect(isEligible(null, NOW)).toEqual({ eligible: false, reason: "No qualifying CeloBank activity yet." })
    expect(isEligible(row({ actionCount: 0 }), NOW).eligible).toBe(false)
  })

  it("rejects a single qualifying action even if it's old enough (no re-engagement signal)", () => {
    const result = isEligible(row({ actionCount: 1, firstActionAt: new Date(NOW.getTime() - 10 * DAY_MS) }), NOW)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain(`at least ${MIN_QUALIFYING_ACTIONS}`)
  })

  it("rejects 2+ actions when the first is too recent (< 2 days)", () => {
    const result = isEligible(row({ actionCount: 2, firstActionAt: new Date(NOW.getTime() - 1 * DAY_MS) }), NOW)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain("Returning-user window")
  })

  it("rejects exactly at the boundary just under the window", () => {
    const result = isEligible(row({ actionCount: 2, firstActionAt: new Date(NOW.getTime() - RETURNING_USER_WINDOW_MS + 1000) }), NOW)
    expect(result.eligible).toBe(false)
  })

  it("accepts 2+ actions once the returning-user window has elapsed", () => {
    const result = isEligible(row({ actionCount: 2, firstActionAt: new Date(NOW.getTime() - RETURNING_USER_WINDOW_MS) }), NOW)
    expect(result).toEqual({ eligible: true })
  })

  it("accepts more than the minimum action count", () => {
    const result = isEligible(row({ actionCount: 5, firstActionAt: new Date(NOW.getTime() - 30 * DAY_MS) }), NOW)
    expect(result.eligible).toBe(true)
  })

  it("rejects when claimed within the cooldown window, even if otherwise eligible", () => {
    const result = isEligible(row({
      actionCount: 5,
      firstActionAt: new Date(NOW.getTime() - 30 * DAY_MS),
      rewardClaimedAt: new Date(NOW.getTime() - DAY_MS),
    }), NOW)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain("already claimed")
  })

  it("rejects exactly at the boundary just under the reward cooldown", () => {
    const result = isEligible(row({
      actionCount: 5,
      firstActionAt: new Date(NOW.getTime() - 200 * DAY_MS),
      rewardClaimedAt: new Date(NOW.getTime() - REWARD_COOLDOWN_MS + 1000),
    }), NOW)
    expect(result.eligible).toBe(false)
  })

  it("allows a re-claim once the reward cooldown has fully elapsed", () => {
    const result = isEligible(row({
      actionCount: 5,
      firstActionAt: new Date(NOW.getTime() - 200 * DAY_MS),
      rewardClaimedAt: new Date(NOW.getTime() - REWARD_COOLDOWN_MS),
    }), NOW)
    expect(result).toEqual({ eligible: true })
  })
})

describe("matchesActionTarget", () => {
  it("fails closed for an unrecognized/non-qualifying action — no target to check means no pass", () => {
    expect(matchesActionTarget("send", null)).toBe(false)
    expect(matchesActionTarget("get_balance", "0x000000000000000000000000000000000000ff")).toBe(false)
  })

  it("rejects a swap-labeled tx that didn't hit the Broker or Uniswap router", () => {
    expect(matchesActionTarget("swap", "0x000000000000000000000000000000000000ff")).toBe(false)
    expect(matchesActionTarget("swap", null)).toBe(false)
  })

  it("accepts a swap-labeled tx that hit the Broker, case-insensitively", () => {
    expect(matchesActionTarget("swap", "0x777a8255ca72412f0d706dc03c9d1987306b4cad")).toBe(true)
  })

  it("rejects a supply_aave-labeled tx that didn't hit the Aave pool", () => {
    expect(matchesActionTarget("supply_aave", "0x000000000000000000000000000000000000ff")).toBe(false)
  })
})

describe("isQualifyingAction", () => {
  it("accepts atomic actions", () => {
    for (const a of ["swap", "supply_aave", "stake", "launch_token"]) {
      expect(isQualifyingAction(a)).toBe(true)
    }
  })

  it("accepts unstake-chain actions", () => {
    for (const a of ["unstake", "complete_unstake", "claim_unstake"]) {
      expect(isQualifyingAction(a)).toBe(true)
    }
  })

  it("rejects send — no fixed CeloBank contract to verify the target against", () => {
    expect(isQualifyingAction("send")).toBe(false)
  })

  it("rejects unrecognized or non-string actions", () => {
    expect(isQualifyingAction("get_balance")).toBe(false)
    expect(isQualifyingAction("")).toBe(false)
    expect(isQualifyingAction(undefined)).toBe(false)
    expect(isQualifyingAction(42)).toBe(false)
  })
})

describe("resolveCycleKey", () => {
  it("gives every atomic action its own cycle, keyed by its tx hash", () => {
    expect(resolveCycleKey("stake", "0xaaa", null)).toEqual({ cycleKey: "0xaaa", opensNewCycle: true, closesCycle: false })
    expect(resolveCycleKey("swap", "0xbbb", "some-open-cycle")).toEqual({ cycleKey: "0xbbb", opensNewCycle: true, closesCycle: false })
  })

  it("opens a new cycle on the first unstake step when none is open", () => {
    const result = resolveCycleKey("unstake", "0xaaa", null)
    expect(result.opensNewCycle).toBe(true)
    expect(result.closesCycle).toBe(false)
    expect(result.cycleKey).toBe("unstake:0xaaa")
  })

  it("reuses the open cycle if unstake is called again while one is already open", () => {
    const result = resolveCycleKey("unstake", "0xnew", "unstake:0xaaa")
    expect(result).toEqual({ cycleKey: "unstake:0xaaa", opensNewCycle: false, closesCycle: false })
  })

  it("joins the open cycle for complete_unstake without opening a new one", () => {
    const result = resolveCycleKey("complete_unstake", "0xbbb", "unstake:0xaaa")
    expect(result).toEqual({ cycleKey: "unstake:0xaaa", opensNewCycle: false, closesCycle: false })
  })

  it("joins and closes the open cycle on claim_unstake", () => {
    const result = resolveCycleKey("claim_unstake", "0xccc", "unstake:0xaaa")
    expect(result).toEqual({ cycleKey: "unstake:0xaaa", opensNewCycle: false, closesCycle: true })
  })

  it("falls back to a fresh cycle if complete/claim_unstake arrive with no open cycle on record", () => {
    const complete = resolveCycleKey("complete_unstake", "0xddd", null)
    expect(complete.opensNewCycle).toBe(true)
    expect(complete.cycleKey).toBe("unstake:0xddd")

    const claim = resolveCycleKey("claim_unstake", "0xeee", null)
    expect(claim.opensNewCycle).toBe(true)
    expect(claim.closesCycle).toBe(true)
    expect(claim.cycleKey).toBe("unstake:0xeee")
  })

  it("never counts a full 3-step unstake cycle as more than one distinct cycle_key", () => {
    const step1 = resolveCycleKey("unstake", "0x1", null)
    const step2 = resolveCycleKey("complete_unstake", "0x2", step1.cycleKey)
    const step3 = resolveCycleKey("claim_unstake", "0x3", step2.cycleKey)
    expect(new Set([step1.cycleKey, step2.cycleKey, step3.cycleKey]).size).toBe(1)
  })
})

describe("getActivity", () => {
  const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL

  beforeEach(() => {
    vi.mocked(pool.query).mockReset()
  })
  afterAll(() => {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL
  })

  it("returns null and never touches the DB when DATABASE_URL is unset", async () => {
    delete process.env.DATABASE_URL
    const result = await getActivity("0xabc")
    expect(result).toBeNull()
    expect(pool.query).not.toHaveBeenCalled()
  })

  it("filters the activity aggregate to actions confirmed after the address's most recent claim", async () => {
    process.env.DATABASE_URL = "postgres://test"
    vi.mocked(pool.query).mockImplementation(async (sql: unknown) => {
      const text = sql as string
      if (text.includes("FROM confirmed_actions")) {
        return { rows: [{ action_count: "2", first_action_at: new Date("2026-08-01"), last_action_at: new Date("2026-08-10") }] } as any
      }
      return { rows: [{ claimed_at: new Date("2026-07-01") }] } as any
    })

    const result = await getActivity("0xABC")

    expect(pool.query).toHaveBeenCalledTimes(2)
    const activityCall = vi.mocked(pool.query).mock.calls.find(([sql]) => (sql as string).includes("FROM confirmed_actions"))!
    // Locks in the bug_001 fix: without this filter, actions "spent" on claim #1
    // would trivially re-satisfy the returning-user gate on every claim after.
    expect(activityCall[0]).toContain("engagement_claims")
    expect(activityCall[0]).toContain("COALESCE")
    expect(activityCall[1]).toEqual(["0xabc"]) // lowercased address, bound once for both the outer WHERE and the subquery

    expect(result).toEqual({
      address: "0xABC",
      actionCount: 2,
      firstActionAt: new Date("2026-08-01"),
      lastActionAt: new Date("2026-08-10"),
      rewardClaimedAt: new Date("2026-07-01"),
    })
  })
})
