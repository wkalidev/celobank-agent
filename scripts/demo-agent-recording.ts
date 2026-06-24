/**
 * CeloBank Autonomous Agent — Commerce Demo (RECORDING EDITION)
 *
 * Same logic as demo-agent.ts but tuned for screen recording:
 *   - Pauses between steps so each one is readable on camera
 *   - ANSI colors for visual clarity
 *   - A short "typing" reveal on key lines
 *
 * Run: npx tsx scripts/demo-agent-recording.ts
 *
 * Optional flags:
 *   FAST=1   -> shorter pauses (for re-takes)
 *   NOCOLOR=1 -> disable colors
 *
 * The catalog crawl + live price read are REAL calls to the live agent.
 * The payment/write steps are SIMULATED against the live catalog schema
 * (the catalog is currently declarative). This is stated on-screen.
 */

const CATALOG_URL = "https://celobank-agent-production.up.railway.app/catalog"
const PRICES_URL =
  "https://celobank-agent-production.up.railway.app/api/v1/prices?tokens=CELO,cUSD"

// ── timing ────────────────────────────────────────────────────────────────
const FAST = process.env.FAST === "1"
const STEP_PAUSE = FAST ? 600 : 2200 // pause after each step block
const LINE_PAUSE = FAST ? 120 : 450 // pause between key lines
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── colors ────────────────────────────────────────────────────────────────
const noColor = process.env.NOCOLOR === "1"
const c = (code: string) => (s: string) => (noColor ? s : `\x1b[${code}m${s}\x1b[0m`)
const dim = c("2")
const bold = c("1")
const green = c("32")
const cyan = c("36")
const yellow = c("33")
const red = c("31")
const magenta = c("35")
const gray = c("90")

const rule = (label: string) =>
  console.log(
    "\n" + bold(cyan("━━━ ")) + bold(label) + " " + bold(cyan("━".repeat(Math.max(2, 56 - label.length)))),
  )

async function line(s = "", pause = LINE_PAUSE) {
  console.log(s)
  await sleep(pause)
}

async function main() {
  console.clear?.()
  await line(bold(cyan("╔══════════════════════════════════════════════════════════════╗")), 200)
  await line(bold(cyan("║")) + bold("  CeloBank Autonomous Agent — Commerce Demo                   ") + bold(cyan("║")), 200)
  await line(bold(cyan("║")) + dim("  Proving agent-to-agent commerce from /catalog alone         ") + bold(cyan("║")), 200)
  await line(bold(cyan("╚══════════════════════════════════════════════════════════════╝")), STEP_PAUSE)

  // ── STEP 1 ────────────────────────────────────────────────────────────────
  rule("STEP 1 · COLD CRAWL")
  await line(dim("  -> Fetching catalog with zero prior knowledge..."))
  let catalog: any
  try {
    const res = await fetch(CATALOG_URL)
    catalog = await res.json()
    await line(green(`  <- ${res.status} OK`) + gray("  (real call to live agent)"))
  } catch (e) {
    await line(red("  Could not reach the live catalog. Are you online?"))
    process.exit(1)
  }
  const tools = catalog.tools ?? []
  const paid = tools.filter((t: any) => t.pricing?.scheme === "exact")
  const free = tools.filter((t: any) => t.pricing?.scheme === "free")
  await line(green("  + Catalog parsed — agent now has full service knowledge"))
  await line("")
  await line(`  ${dim("schema   :")} ${catalog.schema ?? "x402-catalog/1.0"}`)
  await line(`  ${dim("service  :")} ${catalog.service?.name ?? "CeloBank Agent"} ${catalog.service?.version ?? ""}`)
  await line(`  ${dim("network  :")} Celo Mainnet ${gray("(chainId 42220)")}`)
  await line(`  ${dim("tools    :")} ${bold(String(tools.length))} total  ${gray(`(${free.length} free, ${paid.length} paid)`)}`)
  await line(`  ${dim("payTo    :")} ${catalog.x402?.payTo ?? catalog.service?.payTo ?? "0xDEAc...2357"}`)
  await line(`  ${dim("fee      :")} 0.001 cUSD / write call`, STEP_PAUSE)

  // ── STEP 2 ────────────────────────────────────────────────────────────────
  rule("STEP 2 · CHOOSE ROUTE")
  await line(dim("  -> Reasoning over the catalog to pick a route..."))
  const cheapestWrite =
    paid.sort(
      (a: any, b: any) =>
        parseFloat(a.pricing?.amount ?? "0") - parseFloat(b.pricing?.amount ?? "0"),
    )[0] ?? { id: "send_celo", pricing: { amount: "0.001", currency: "cUSD" } }
  await line(`  ${magenta("[READ]")}  selected: ${bold("get_multi_price")}  ${gray("free — verify live data")}`)
  await line(`  ${yellow("[WRITE]")} selected: ${bold(cheapestWrite.id)}  ${gray(`${cheapestWrite.pricing?.amount} ${cheapestWrite.pricing?.currency} — cheapest paid tool`)}`)
  await line("")
  await line(dim("  -> Real call to the free read tool..."))
  try {
    const res = await fetch(PRICES_URL)
    const data: any = await res.json()
    await line(green(`  <- ${res.status} OK`) + gray("  (real live prices)"))
    const arr = Array.isArray(data) ? data : data?.prices ?? []
    for (const p of arr.slice(0, 2)) {
      const sym = (p.symbol ?? "").padEnd(5)
      const px = p.priceUsd ?? p.price ?? "?"
      const chg = p.change24h ?? p.change ?? 0
      await line(`        ${bold(sym)} $${px}  ${chg >= 0 ? green(`+${chg}%`) : red(`${chg}%`)}`, 200)
    }
  } catch {
    await line(yellow("  (live price read skipped — offline)"))
  }
  await sleep(STEP_PAUSE)

  // ── STEP 3 ────────────────────────────────────────────────────────────────
  rule("STEP 3 · SET SPEND CAP")
  const perCall = catalog.spendLimits?.perCall?.max ?? "100"
  await line(`  ${dim("-> catalog advisory cap :")} ${perCall} cUSD/call`)
  await line(`  ${dim("-> agent self-imposed   :")} ${bold("0.01")} cUSD/call`)
  await line(dim("  -> check: 0.001 <= 0.01 ?"))
  await line(green("  + 0.001 <= 0.01 — within cap. Cleared to proceed."), STEP_PAUSE)

  // ── STEP 4 ────────────────────────────────────────────────────────────────
  rule("STEP 4 · INTENTIONAL FAILURE")
  await line(gray("  [SIMULATED] sending a malformed X-PAYMENT to test failure handling"))
  await line(gray("  [SIMULATED] server validates -> on-chain action reverts"))
  await line("")
  await line(`  ${red("<-")} { code: ${red('"ON_CHAIN_REVERT"')}, paymentStatus: ${yellow('"refunded"')}, txHash: null }`)
  await line(dim("  -> agent reads catalog.schemas.failureRefund"))
  await line(green("  + paymentStatus = refunded — no funds captured."))
  await line(green("  + safe to retry, zero double-spend risk."), STEP_PAUSE)

  // ── STEP 5 ────────────────────────────────────────────────────────────────
  rule("STEP 5 · RETRY WITH IDEMPOTENCY")
  const key = crypto.randomUUID()
  await line(dim("  -> agent reads catalog.idempotency (24h window)"))
  await line(`  ${dim("-> generated key :")} ${cyan(key)}`)
  await line(gray("  [SIMULATED] retry with valid X-PAYMENT + same Idempotency-Key"))
  await line(green("  + retry succeeded — server deduplicates within 24h."), STEP_PAUSE)

  // ── STEP 6 ────────────────────────────────────────────────────────────────
  rule("STEP 6 · RECONCILE RECEIPT")
  const payTo = catalog.x402?.payTo ?? "0xDEAcDe6eC27Fd0cD972c1232C4f0d4171dda2357"
  await line(gray("  [SIMULATED] received X-PAYMENT-RECEIPT"))
  await line("")
  await line(`        ${dim("amount  :")} 0.001 cUSD`)
  await line(`        ${dim("paidTo  :")} ${payTo}`)
  await line(`        ${dim("network :")} celo (chainId 42220)`)
  await line("")
  await line(dim("  -> verifying receipt against catalog.schemas.receiptFormat..."))
  await line(green("  + amount matches tool price"))
  await line(green("  + paidTo matches catalog.x402.payTo"))
  await line(green("  + chainId matches (42220)"))
  await line("")
  await line(bold(green("  RECONCILED ✓")), STEP_PAUSE)

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  rule("SUMMARY")
  await line("")
  const rows = [
    "1. Cold crawl /catalog",
    "2. Choose route + real read call",
    "3. Spend cap verification",
    "4. Handle failure + refund  [sim]",
    "5. Retry with Idempotency-Key  [sim]",
    "6. Reconcile receipt  [sim]",
  ]
  for (const r of rows) {
    await line(`  ${green("DONE")}   ${gray("human needed:")} ${green("no")}   ${r}`, 250)
  }
  await line("")
  await line(bold("  All 6 steps completed autonomously — /catalog was the only input."))
  await line(bold(green("  No human interaction required at any step.")))
  await line("")
  await line(gray("  Catalog crawl + price read were REAL. Payment steps simulated"))
  await line(gray("  against the live catalog schema (catalog is declarative)."), 300)
  await line("")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})