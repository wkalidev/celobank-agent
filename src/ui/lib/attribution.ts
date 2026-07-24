import { toDataSuffix } from "@celo/attribution-tags"
import { concat, type Hex } from "viem"

// ─── Browser-side attribution ──────────────────────────────────────────────────
// Every other prepared flow (swap, save, send, stake, unstake, launch) is
// tagged server-side in src/lib/attribution.ts, inside src/tools/prepare.ts's
// applyAttribution() choke point, before the unsigned transaction ever
// reaches this app. The DailyDrop check-in/claim-reward flows are the one
// exception: they build and broadcast their own calldata directly in this
// file (see doCheckIn/doClaimReward), entirely outside prepare.ts — so they
// need their own copy of the same tagging logic, reading Vite's browser-safe
// VITE_-prefixed env vars instead of process.env.
//
// A Divvi referral-tag integration was evaluated here (July 2026) and
// removed — @divvi/referral-sdk was deprecated on npm and the divvi-xyz
// GitHub org archived, with app.divvi.xyz no longer resolving. See
// CHANGELOG.md. Only the Celo Builders tag remains.
//
// Do NOT call appendAttributionSuffix on a tx that already went through
// server-side applyAttribution() — that would double-tag it.

const OWN_CODE     = import.meta.env.VITE_OWN_ATTRIBUTION_CODE as string | undefined
const ASSIGNED_TAG = import.meta.env.VITE_ATTRIBUTION_TAG as string | undefined

function resolveCeloBuildersCodes(): string[] | null {
  const codes = [OWN_CODE, ASSIGNED_TAG].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  )
  return codes.length > 0 ? codes : null
}

let cachedCeloBuildersSuffix: Hex | null | undefined = undefined

function getCeloBuildersSuffix(): Hex | null {
  if (cachedCeloBuildersSuffix !== undefined) return cachedCeloBuildersSuffix
  const codes = resolveCeloBuildersCodes()
  cachedCeloBuildersSuffix = codes ? (toDataSuffix(codes.length === 1 ? codes[0] : codes) as Hex) : null
  return cachedCeloBuildersSuffix
}

/**
 * Appends the configured Celo Builders attribution suffix to a single
 * transaction's calldata (or to "0x" for a value-only transfer, same as the
 * server-side prepareSend/CELO path does). No-op — returns `data` unchanged
 * — if neither VITE_ATTRIBUTION_TAG nor VITE_OWN_ATTRIBUTION_CODE is
 * configured.
 */
export function appendAttributionSuffix(data: `0x${string}`): `0x${string}` {
  const suffix = getCeloBuildersSuffix()
  if (!suffix) return data
  return concat([data, suffix]) as `0x${string}`
}
