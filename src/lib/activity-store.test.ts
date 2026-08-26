import { describe, it, expect } from "vitest"
import { isEligible, resolveCycleKey, isQualifyingAction, RETURNING_USER_WINDOW_MS, MIN_QUALIFYING_ACTIONS } from "./activity-store.js"
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

  it("rejects when already claimed, even if otherwise eligible", () => {
    const result = isEligible(row({
      actionCount: 5,
      firstActionAt: new Date(NOW.getTime() - 30 * DAY_MS),
      rewardClaimedAt: new Date(NOW.getTime() - DAY_MS),
    }), NOW)
    expect(result).toEqual({ eligible: false, reason: "Engagement reward already claimed." })
  })
})

describe("isQualifyingAction", () => {
  it("accepts atomic actions", () => {
    for (const a of ["send", "swap", "supply_aave", "stake", "launch_token"]) {
      expect(isQualifyingAction(a)).toBe(true)
    }
  })

  it("accepts unstake-chain actions", () => {
    for (const a of ["unstake", "complete_unstake", "claim_unstake"]) {
      expect(isQualifyingAction(a)).toBe(true)
    }
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
    expect(resolveCycleKey("send", "0xaaa", null)).toEqual({ cycleKey: "0xaaa", opensNewCycle: true, closesCycle: false })
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
