import "dotenv/config"
import { toDataSuffix } from "@celo/attribution-tags"
import { concat, type Hex } from "viem"
import type { UnsignedTx } from "../tools/prepare.js"

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
function getSuffix(): Hex | null {
  if (cachedSuffix !== undefined) return cachedSuffix
  const codes = resolveCodes()
  cachedSuffix = codes ? toDataSuffix(codes.length === 1 ? codes[0] : codes) : null
  if (cachedSuffix) {
    console.log(`🏷️  [attribution] tagging transactions with: ${resolveCodes()!.join(", ")}`)
  }
  return cachedSuffix
}

// Appends the configured attribution suffix to every prepared transaction's
// calldata. No-op (returns the input unchanged) when ATTRIBUTION_TAG /
// OWN_ATTRIBUTION_CODE aren't set, so this is safe to call unconditionally.
export function tagTransactions(transactions: UnsignedTx[]): UnsignedTx[] {
  const suffix = getSuffix()
  if (!suffix) return transactions

  return transactions.map(tx => ({
    ...tx,
    data: tx.data ? concat([tx.data, suffix]) : tx.data,
  }))
}
