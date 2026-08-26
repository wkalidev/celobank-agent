import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { toDataSuffix } from "@celo/attribution-tags"
import { concat, type Hex } from "viem"

// OWN_ATTRIBUTION_CODE/ATTRIBUTION_TAG are read into module-level consts at import
// time (see attribution.ts), so each scenario needs a fresh module instance —
// vi.resetModules() + dynamic import after stubbing env, per test.
async function freshAttributionModule() {
  vi.resetModules()
  return import("./attribution.js")
}

describe("txCarriesOurAttribution", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.unstubAllEnvs()
  })
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("fails open (returns true) when no attribution code is configured — nothing to verify against", async () => {
    vi.stubEnv("ATTRIBUTION_TAG", "")
    vi.stubEnv("OWN_ATTRIBUTION_CODE", "")
    const { txCarriesOurAttribution } = await freshAttributionModule()

    expect(txCarriesOurAttribution(null)).toBe(true)
    expect(txCarriesOurAttribution("0xdeadbeef")).toBe(true)
  })

  it("accepts calldata carrying our configured suffix", async () => {
    vi.stubEnv("ATTRIBUTION_TAG", "celo_abcdef123456")
    vi.stubEnv("OWN_ATTRIBUTION_CODE", "")
    const { txCarriesOurAttribution } = await freshAttributionModule()

    const suffix = toDataSuffix("celo_abcdef123456")
    const taggedInput = concat(["0x1234" as Hex, suffix])

    expect(txCarriesOurAttribution(taggedInput)).toBe(true)
  })

  it("rejects a tx with no suffix at all — the shared-infra / unrelated-dApp bypass this closes", async () => {
    vi.stubEnv("ATTRIBUTION_TAG", "celo_abcdef123456")
    vi.stubEnv("OWN_ATTRIBUTION_CODE", "")
    const { txCarriesOurAttribution } = await freshAttributionModule()

    expect(txCarriesOurAttribution("0x1234")).toBe(false)
    expect(txCarriesOurAttribution(null)).toBe(false)
    expect(txCarriesOurAttribution(undefined)).toBe(false)
  })

  it("rejects calldata carrying a different app's attribution code", async () => {
    vi.stubEnv("ATTRIBUTION_TAG", "celo_abcdef123456")
    vi.stubEnv("OWN_ATTRIBUTION_CODE", "")
    const { txCarriesOurAttribution } = await freshAttributionModule()

    const someoneElsesSuffix = toDataSuffix("celo_someoneelse01")
    const taggedInput = concat(["0x1234" as Hex, someoneElsesSuffix])

    expect(txCarriesOurAttribution(taggedInput)).toBe(false)
  })

  it("rejects malformed/garbage trailing bytes that don't decode as a suffix", async () => {
    vi.stubEnv("ATTRIBUTION_TAG", "celo_abcdef123456")
    vi.stubEnv("OWN_ATTRIBUTION_CODE", "")
    const { txCarriesOurAttribution } = await freshAttributionModule()

    expect(txCarriesOurAttribution("0x1234ffffffffffffffffffffffffffffffff")).toBe(false)
  })
})
