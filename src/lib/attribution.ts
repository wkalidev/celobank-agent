import "dotenv/config"
import { toDataSuffix, fromDataSuffix } from "@celo/attribution-tags"
import { concat, type Hex } from "viem"
import type { UnsignedTx, PrepareResult } from "../tools/prepare.js"

// ─── Celo Builders Attribution Tag (ERC-8021) ─────────────────────────────────
// Every transaction CeloBank Agent prepares for a user to sign gets an
// attribution suffix appended to its calldata. The EVM discards trailing
// bytes it doesn't consume, so this never changes execution semantics — it
// just makes on-chain activity identifiable as coming from this app for
// programs like Proof of Ship, MiniPay leaderboards, and hackathon tracking.
//
// Set ATTRIBUTION_TAG in .env once you've registered at celobuilders.xyz and
// received your assigned code (format: "celo_" + 12 hex chars). Registration:
//   npx skills add https://celobuilders.xyz
//   → ask the connected skill to register you for the "agentic-payments-defai"
//     hackathon (projectName, githubUrl, telegram) — the response returns
//     your attributionTag.
// See https://docs.celo.org/build-on-celo/attribution-tags
//
// If a user already carries their own code, list both — only the assigned
// tag is credited by the leaderboard, but ERC-8021 suffixes can carry
// multiple codes at once (e.g. OWN_CODE=your_own_code alongside the
// hackathon-issued ATTRIBUTION_TAG).

const OWN_CODE = process.env.OWN_ATTRIBUTION_CODE
const ASSIGNED_TAG = process.env.ATTRIBUTION_TAG

function resolveCodes(): string[] | null {
  const codes = [OWN_CODE, ASSIGNED_TAG].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  )
  return codes.length > 0 ? codes : null
}

let cachedSuffix: Hex | null | undefined = undefined

// Lazily computes (and caches) the ERC-8021 data suffix for the configured
// codes. Returns null when no attribution codes are configured, in which
// case callers should leave calldata untouched.
function getCeloBuildersSuffix(): Hex | null {
  if (cachedSuffix !== undefined) return cachedSuffix
  const codes = resolveCodes()
  cachedSuffix = codes ? toDataSuffix(codes.length === 1 ? codes[0] : codes) : null
  if (cachedSuffix) {
    console.log(`🏷️  [attribution] Celo Builders tag: ${resolveCodes()!.join(", ")}`)
  }
  return cachedSuffix
}

// NOTE: a Divvi referral-tag integration was evaluated here (July 2026) and
// removed — @divvi/referral-sdk was deprecated on npm and the divvi-xyz
// GitHub org archived, with app.divvi.xyz no longer resolving. See
// CHANGELOG.md. Only the Celo Builders tag above remains.

// Appends the configured Celo Builders attribution suffix to every prepared
// transaction's calldata. No-op (returns the input unchanged) when neither
// ATTRIBUTION_TAG nor OWN_ATTRIBUTION_CODE is set.
function tagTransactions(transactions: UnsignedTx[]): UnsignedTx[] {
  const suffix = getCeloBuildersSuffix()
  if (!suffix) return transactions

  return transactions.map(tx => ({
    ...tx,
    data: tx.data ? concat([tx.data, suffix]) : tx.data,
  }))
}

/**
 * Single choke point for on-chain attribution tagging. Call this once, on
 * every successful PrepareResult, right before it's returned — from every
 * prepare* / launch* function in tools/prepare.ts and tools/launch.ts. Because
 * every entry point (REST /api/v1/prepare, chat /api/v1/chat & /chat, and MCP
 * tools/call) ultimately calls those same prepare* / launch* functions, tagging
 * happens exactly once per transaction with no per-route special-casing and
 * no way for a new entry point to accidentally skip it.
 *
 * No-op (returns `result` unchanged) if the result wasn't successful, has no
 * transactions, or ATTRIBUTION_TAG/OWN_ATTRIBUTION_CODE isn't configured —
 * safe to call unconditionally.
 */
export function applyAttribution(result: PrepareResult): PrepareResult {
  if (!result.success || result.transactions.length === 0) return result

  const transactions = tagTransactions(result.transactions)
  if (transactions === result.transactions) return result

  return { ...result, transactions }
}

// ─── Verification (the other direction) ─────────────────────────────────────
// /activity/confirm (server.ts) needs to tell "a tx CeloBank prepared" apart from
// "any successful tx to the same shared contract (Broker, Aave pool, ...) signed
// through some other dApp" — matchesActionTarget (lib/activity-store.ts) alone
// can't, since those contracts are used by dozens of other Celo frontends. The
// attribution suffix every prepared tx carries (tagTransactions above) doubles as
// that fingerprint.
//
// When no attribution code is configured, there is nothing of ours to check a
// suffix against — CeloBank's own prepared txs wouldn't carry one either in that
// case, so requiring it would reject genuine users instead of just blocking
// spoofers. This deliberately fails open in that one case; it's the same
// trade-off tagTransactions already makes (no-op without a configured code).
export function txCarriesOurAttribution(input: string | null | undefined): boolean {
  const codes = resolveCodes()
  if (!codes) return true // attribution not configured — nothing to verify against
  if (!input) return false
  let decoded: ReturnType<typeof fromDataSuffix>
  try {
    decoded = fromDataSuffix(input as Hex)
  } catch {
    return false
  }
  if (!decoded) return false
  return decoded.codes.some(c => codes.includes(c))
}
