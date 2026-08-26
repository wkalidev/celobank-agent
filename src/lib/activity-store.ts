import { pool } from "./db.js"

// ─── Qualifying actions ─────────────────────────────────────────────────────
// Mirrors the `action` field PrepareResult objects carry (src/tools/prepare.ts,
// src/tools/launch.ts) — these are the only actions that represent genuine,
// confirmed use of a CeloBank-specific feature, distinct from GoodDollar identity
// verification itself.
const ATOMIC_ACTIONS = new Set(["send", "swap", "supply_aave", "stake", "launch_token"])

// The 3-step unstake flow (unstake -> complete_unstake -> claim_unstake) is one
// logical cycle on a single stake position. Counting each step separately would
// let a user inflate action_count just by walking through mandatory steps of one
// unstake — so the whole cycle counts once, same weight as any atomic action.
const UNSTAKE_OPEN_ACTION     = "unstake"
const UNSTAKE_CONTINUE_ACTION = "complete_unstake"
const UNSTAKE_CLOSE_ACTION    = "claim_unstake"
const UNSTAKE_CHAIN_ACTIONS   = new Set([UNSTAKE_OPEN_ACTION, UNSTAKE_CONTINUE_ACTION, UNSTAKE_CLOSE_ACTION])

export function isQualifyingAction(action: unknown): action is string {
  return typeof action === "string" && (ATOMIC_ACTIONS.has(action) || UNSTAKE_CHAIN_ACTIONS.has(action))
}

// ─── Cycle-key resolution (pure — no DB) ────────────────────────────────────
// Every confirmed action gets a `cycle_key`; action_count is COUNT(DISTINCT cycle_key).
// Atomic actions are always their own cycle (cycle_key = their own tx hash, so every
// confirmation counts). Unstake-chain actions share one cycle_key across all steps of
// the same position, looked up via the caller-supplied `openCycleKey` (the address's
// currently-open, unclosed unstake cycle, if any).
export interface CycleResolution {
  cycleKey: string
  opensNewCycle: boolean
  closesCycle: boolean
}

export function resolveCycleKey(
  action: string,
  txHash: string,
  openCycleKey: string | null
): CycleResolution {
  if (!UNSTAKE_CHAIN_ACTIONS.has(action)) {
    return { cycleKey: txHash, opensNewCycle: true, closesCycle: false }
  }
  if (action === UNSTAKE_OPEN_ACTION) {
    if (openCycleKey) return { cycleKey: openCycleKey, opensNewCycle: false, closesCycle: false }
    return { cycleKey: `unstake:${txHash}`, opensNewCycle: true, closesCycle: false }
  }
  // complete_unstake / claim_unstake: join the already-open cycle. If none is open
  // (e.g. state drifted, or the opening step's confirm never landed), fall back to
  // treating this step as its own cycle rather than losing the record.
  const cycleKey      = openCycleKey ?? `unstake:${txHash}`
  const opensNewCycle = openCycleKey === null
  return { cycleKey, opensNewCycle, closesCycle: action === UNSTAKE_CLOSE_ACTION }
}

// ─── Eligibility gate (pure — no DB) ────────────────────────────────────────
export interface ActivityRow {
  address:         string
  actionCount:     number
  firstActionAt:   Date | null
  lastActionAt:    Date | null
  rewardClaimedAt: Date | null
}

export const MIN_QUALIFYING_ACTIONS   = 2
export const RETURNING_USER_WINDOW_MS = 2 * 24 * 60 * 60 * 1000 // 2 days

export interface EligibilityResult {
  eligible: boolean
  reason?: string
}

// A single action plus an elapsed timer isn't a real "returning user" signal —
// someone could act once, close the app, and come back purely to claim. Requiring
// >=2 distinct qualifying actions (see MIN_QUALIFYING_ACTIONS) spread across the
// 2-day window makes the gate reflect actual re-engagement, not just elapsed time.
export function isEligible(row: ActivityRow | null, now: Date = new Date()): EligibilityResult {
  if (!row || row.actionCount === 0 || !row.firstActionAt) {
    return { eligible: false, reason: "No qualifying CeloBank activity yet." }
  }
  if (row.rewardClaimedAt) {
    return { eligible: false, reason: "Engagement reward already claimed." }
  }
  if (row.actionCount < MIN_QUALIFYING_ACTIONS) {
    return { eligible: false, reason: `Needs at least ${MIN_QUALIFYING_ACTIONS} distinct qualifying actions (has ${row.actionCount}).` }
  }
  const elapsedMs = now.getTime() - row.firstActionAt.getTime()
  if (elapsedMs < RETURNING_USER_WINDOW_MS) {
    const hoursLeft = Math.ceil((RETURNING_USER_WINDOW_MS - elapsedMs) / (60 * 60 * 1000))
    return { eligible: false, reason: `Returning-user window not reached yet (~${hoursLeft}h remaining).` }
  }
  return { eligible: true }
}

// ─── DB-backed operations ───────────────────────────────────────────────────
export async function recordConfirmedAction(address: string, action: string, txHash: string): Promise<void> {
  if (!isQualifyingAction(action)) throw new Error(`"${action}" is not a qualifying action`)
  const addr = address.toLowerCase()

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const existing = await client.query("SELECT 1 FROM confirmed_actions WHERE tx_hash = $1", [txHash])
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK")
      return // already recorded — idempotent no-op
    }

    let openCycleKey: string | null = null
    if (UNSTAKE_CHAIN_ACTIONS.has(action)) {
      const open = await client.query(
        `SELECT cycle_key FROM unstake_cycles
         WHERE address = $1 AND closed_at IS NULL
         ORDER BY opened_at DESC LIMIT 1 FOR UPDATE`,
        [addr]
      )
      openCycleKey = open.rows[0]?.cycle_key ?? null
    }

    const { cycleKey, opensNewCycle, closesCycle } = resolveCycleKey(action, txHash, openCycleKey)

    if (UNSTAKE_CHAIN_ACTIONS.has(action) && opensNewCycle) {
      await client.query(
        "INSERT INTO unstake_cycles (cycle_key, address) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [cycleKey, addr]
      )
    }
    if (closesCycle) {
      await client.query("UPDATE unstake_cycles SET closed_at = now() WHERE cycle_key = $1", [cycleKey])
    }

    await client.query(
      "INSERT INTO confirmed_actions (address, action, cycle_key, tx_hash) VALUES ($1, $2, $3, $4)",
      [addr, action, cycleKey, txHash]
    )

    await client.query("COMMIT")
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

export async function getActivity(address: string): Promise<ActivityRow | null> {
  const addr = address.toLowerCase()

  const activity = await pool.query(
    `SELECT COUNT(DISTINCT cycle_key) AS action_count,
            MIN(confirmed_at)         AS first_action_at,
            MAX(confirmed_at)         AS last_action_at
     FROM confirmed_actions WHERE address = $1`,
    [addr]
  )
  const claim = await pool.query("SELECT claimed_at FROM engagement_claims WHERE address = $1", [addr])

  const row = activity.rows[0]
  const actionCount = row ? Number(row.action_count) : 0

  return {
    address,
    actionCount,
    firstActionAt:   actionCount > 0 ? row.first_action_at : null,
    lastActionAt:    actionCount > 0 ? row.last_action_at : null,
    rewardClaimedAt: claim.rows[0]?.claimed_at ?? null,
  }
}

export async function markRewardClaimed(address: string, txHash: string): Promise<void> {
  await pool.query(
    "INSERT INTO engagement_claims (address, tx_hash) VALUES ($1, $2) ON CONFLICT (address) DO NOTHING",
    [address.toLowerCase(), txHash]
  )
}
