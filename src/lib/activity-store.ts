import { pool } from "./db.js"
import { BROKER, AAVE_POOL, STAKED_CELO_MANAGER, STAKED_CELO_ACCOUNT, UNISWAP_V3_ROUTER } from "../tools/prepare.js"
import { FACTORY_ADDRESS } from "../tools/launch.js"

// ─── Qualifying actions & on-chain target verification ──────────────────────
// Mirrors the `action` field PrepareResult objects carry (src/tools/prepare.ts,
// src/tools/launch.ts) — these are the only actions that represent genuine,
// confirmed use of a CeloBank-specific feature, distinct from GoodDollar identity
// verification itself. Each one always sends its final signed tx to one of a
// small, fixed set of contracts — matchesActionTarget() verifies a confirmed
// receipt's `to` actually matches what the claimed action is supposed to hit
// (/activity/confirm previously trusted the client-supplied label outright, so
// any successful tx could be relabeled as e.g. "swap" to satisfy the gate).
//
// isQualifyingAction() is deliberately *derived* from this map's keys, not a
// separately-maintained set: that way a future action can't become "qualifying"
// without also getting a target-contract entry, so matchesActionTarget's
// `!allowed` fallback can never silently start passing verification-free actions.
//
// "send" has no entry and is therefore not qualifying, even though prepareSend()
// emits it: unlike every other action here, a send has no fixed CeloBank contract
// to verify against (the `to` is an arbitrary recipient, or an arbitrary ERC20
// token contract) — so matchesActionTarget() can't distinguish a CeloBank-prepared
// send from any unrelated successful tx the user ever signed. Counting it would
// let 2 dust self-transfers (or any 2 historical txs) satisfy the whole gate with
// zero genuine CeloBank usage.
const ACTION_TARGET_CONTRACTS: Record<string, ReadonlySet<string>> = {
  swap:             new Set([BROKER, UNISWAP_V3_ROUTER].map(a => a.toLowerCase())),
  supply_aave:      new Set([AAVE_POOL].map(a => a.toLowerCase())),
  stake:            new Set([STAKED_CELO_MANAGER].map(a => a.toLowerCase())),
  // The 3-step unstake flow (unstake -> complete_unstake -> claim_unstake) is one
  // logical cycle on a single stake position — resolveCycleKey() below folds all
  // three into one cycle_key so it counts once, same weight as any atomic action.
  unstake:          new Set([STAKED_CELO_MANAGER].map(a => a.toLowerCase())),
  complete_unstake: new Set([STAKED_CELO_ACCOUNT].map(a => a.toLowerCase())),
  claim_unstake:    new Set([STAKED_CELO_ACCOUNT].map(a => a.toLowerCase())),
  launch_token:     new Set([FACTORY_ADDRESS].map(a => a.toLowerCase())),
}

const UNSTAKE_OPEN_ACTION     = "unstake"
const UNSTAKE_CONTINUE_ACTION = "complete_unstake"
const UNSTAKE_CLOSE_ACTION    = "claim_unstake"
const UNSTAKE_CHAIN_ACTIONS   = new Set([UNSTAKE_OPEN_ACTION, UNSTAKE_CONTINUE_ACTION, UNSTAKE_CLOSE_ACTION])

const QUALIFYING_ACTIONS = new Set(Object.keys(ACTION_TARGET_CONTRACTS))

export function isQualifyingAction(action: unknown): action is string {
  return typeof action === "string" && QUALIFYING_ACTIONS.has(action)
}

export function matchesActionTarget(action: string, to: string | null | undefined): boolean {
  const allowed = ACTION_TARGET_CONTRACTS[action]
  if (!allowed) return false // no fixed target defined — fail closed, not open
  return typeof to === "string" && allowed.has(to.toLowerCase())
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

// Mirrors the GoodDollar EngagementRewards contract's own per-user cooldown (see
// tools/engagement.ts) so the DB gate matches what canClaim() will eventually allow
// again, instead of permanently locking a user out after their first claim.
export const REWARD_COOLDOWN_MS = 180 * 24 * 60 * 60 * 1000 // 180 days

export interface EligibilityResult {
  eligible: boolean
  reason?: string
}

// A single action plus an elapsed timer isn't a real "returning user" signal —
// someone could act once, close the app, and come back purely to claim. Requiring
// >=2 distinct qualifying actions (see MIN_QUALIFYING_ACTIONS) spread across the
// 2-day window makes the gate reflect actual re-engagement, not just elapsed time.
export function isEligible(row: ActivityRow | null, now: Date = new Date()): EligibilityResult {
  if (!row) {
    return { eligible: false, reason: "No qualifying CeloBank activity yet." }
  }
  // Checked before the empty-activity branch below: getActivity()'s SQL only counts
  // actions confirmed after the address's most recent claim, so a user who claimed
  // and hasn't acted since (the common post-claim state) has actionCount === 0 —
  // the real blocker there is the cooldown, not "never used CeloBank".
  if (row.rewardClaimedAt) {
    const sinceClaimMs = now.getTime() - row.rewardClaimedAt.getTime()
    if (sinceClaimMs < REWARD_COOLDOWN_MS) {
      const daysLeft = Math.ceil((REWARD_COOLDOWN_MS - sinceClaimMs) / (24 * 60 * 60 * 1000))
      return { eligible: false, reason: `Engagement reward already claimed — next claim available in ~${daysLeft} day(s).` }
    }
  }
  if (row.actionCount === 0 || !row.firstActionAt) {
    return { eligible: false, reason: "No qualifying CeloBank activity yet." }
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
// db.ts's runMigrations() already skips schema setup when DATABASE_URL is unset
// (a deliberately supported "no DB configured" mode — see .env.example) but that
// guard lived only there; these functions used to hit `pool.query`/`pool.connect`
// unconditionally regardless, which throws ECONNREFUSED against pg's localhost
// fallback. Guard each entry point the same way so the rest of the app keeps
// working — with engagement tracking simply disabled — when no DB is configured.
function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export async function recordConfirmedAction(address: string, action: string, txHash: string): Promise<void> {
  if (!isQualifyingAction(action)) throw new Error(`"${action}" is not a qualifying action`)
  if (!isDbConfigured()) return
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
      // `SELECT ... FOR UPDATE` locks nothing when it returns 0 rows (no open cycle
      // yet) — under READ COMMITTED that's a real gap, not a lock: two concurrent
      // "unstake" confirms (e.g. a double-clicked button) could both see "no open
      // cycle" and each open their own, double-counting one logical unstake toward
      // the action-count gate. An advisory xact lock serializes per-address so the
      // second transaction actually waits and then sees the first one's committed row.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [addr])
      const open = await client.query(
        `SELECT cycle_key FROM unstake_cycles
         WHERE address = $1 AND closed_at IS NULL
         ORDER BY opened_at DESC LIMIT 1`,
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
  if (!isDbConfigured()) return null
  const addr = address.toLowerCase()

  // Independent round-trips (the subquery below runs inside Postgres, so the
  // activity query needs no separate lookup of the last claim first) — run in
  // parallel instead of paying two sequential round-trips.
  const [activity, claim] = await Promise.all([
    // Only count activity since the user's most recent claim (if any) — otherwise
    // the same actions that unlocked claim #1 would trivially re-satisfy the
    // returning-user gate on every claim after the cooldown lapses, with zero new
    // engagement. 'epoch' makes the filter a no-op before any claim exists.
    pool.query(
      `SELECT COUNT(DISTINCT cycle_key) AS action_count,
              MIN(confirmed_at)         AS first_action_at,
              MAX(confirmed_at)         AS last_action_at
       FROM confirmed_actions
       WHERE address = $1
         AND confirmed_at > COALESCE(
           (SELECT MAX(claimed_at) FROM engagement_claims WHERE address = $1),
           'epoch'::timestamptz
         )`,
      [addr]
    ),
    // Most recent claim only — engagement_claims now keeps one row per claim
    // (see db.ts) so a user can re-claim once the cooldown in isEligible() lapses.
    pool.query(
      "SELECT claimed_at FROM engagement_claims WHERE address = $1 ORDER BY claimed_at DESC LIMIT 1",
      [addr]
    ),
  ])

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
  if (!isDbConfigured()) return
  // tx_hash is UNIQUE (db.ts) so this stays a no-op if called twice for the same
  // confirmed claim; address is no longer the primary key, so re-claims after the
  // cooldown insert a new row instead of being silently dropped.
  await pool.query(
    "INSERT INTO engagement_claims (address, tx_hash) VALUES ($1, $2) ON CONFLICT (tx_hash) DO NOTHING",
    [address.toLowerCase(), txHash]
  )
}
