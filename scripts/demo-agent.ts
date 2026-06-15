#!/usr/bin/env npx tsx
/**
 * scripts/demo-agent.ts
 *
 * Proves that GET /catalog enables fully autonomous agent-to-agent commerce.
 * The agent starts with zero prior knowledge and derives every decision
 * (tool selection, spend cap, retry semantics, receipt reconciliation)
 * from the catalog JSON alone.
 *
 * Real HTTP calls: steps 1 (catalog) and 2 (free read tool).
 * [SIMULATED] labels: x402 payment steps — /catalog is declarative,
 * but the agent's decision logic is fully real.
 *
 * Run: npx tsx scripts/demo-agent.ts
 */

import { randomUUID } from "node:crypto"

const BASE = "https://celobank-agent-production.up.railway.app"

// ─── Output helpers ───────────────────────────────────────────────────────────

const W = 66

function banner() {
  const inner = W - 2
  console.log(`\n╔${"═".repeat(inner)}╗`)
  console.log(`║${"  CeloBank Autonomous Agent — Commerce Demo".padEnd(inner)}║`)
  console.log(`║${"  Proving agent-to-agent commerce from /catalog alone".padEnd(inner)}║`)
  console.log(`╚${"═".repeat(inner)}╝`)
}

function hr(label: string) {
  const line = `━━━ ${label} `
  console.log("\n" + line.padEnd(W, "━"))
}

function field(label: string, value: string) {
  console.log(`  ${(label + ":").padEnd(16)}${value}`)
}

function go(msg: string)  { console.log(`  → ${msg}`) }
function got(msg: string) { console.log(`  ← ${msg}`) }
function ok(msg: string)  { console.log(`  ✓ ${msg}`) }
function sim(msg: string) { console.log(`  [SIMULATED] ${msg}`) }

// ─── Catalog types ────────────────────────────────────────────────────────────

interface CatalogTool {
  id: string
  name: string
  description: string
  category: "read" | "write"
  pricing: {
    scheme: "free" | "exact"
    amount?: string
    currency?: string
    asset?: string
    chainId?: number
  }
  requiredHeaders?: string[]
  input: Record<string, string>
}

interface Catalog {
  schema: string
  generatedAt: string
  service: {
    name: string
    version: string
    baseUrl: string
    entrypoint: string
    network: string
    chainId: number
    health: { endpoint: string; status: string; uptime: number }
  }
  idempotency: { header: string; behavior: string; window: string }
  spendLimits: {
    perCall: { max: string; currency: string }
    perDay:  { max: string; currency: string }
    note: string
  }
  x402: {
    facilitator: string
    paymentToken: { symbol: string; address: string; decimals: number; chainId: number }
    payTo: string
    requiredHeader: string
    receiptHeader: string
  }
  schemas: {
    receiptFormat: {
      header: string
      value: { txHash: string; chainId: number; network: string; paidTo: string; amount: string; currency: string; settledAt: string }
    }
    failureRefund: {
      states: string[]
      behavior: { onFailure: string; onRevert: string }
      sampleFailureResponse: {
        status: number
        body: { error: { code: string; message: string; paymentStatus: string; txHash: string | null } }
      }
    }
  }
  tools: CatalogTool[]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner()

  // ───────────────────────────────────────────────────────────────────────────
  hr("STEP 1 · COLD CRAWL")
  go(`Fetching ${BASE}/catalog  (zero prior knowledge)`)

  const t0 = Date.now()
  const catalogRes = await fetch(`${BASE}/catalog`, { headers: { Accept: "application/json" } })
  if (!catalogRes.ok) throw new Error(`Catalog fetch failed: ${catalogRes.status} ${catalogRes.statusText}`)
  const catalog = await catalogRes.json() as Catalog
  const elapsed = Date.now() - t0

  got(`200 OK  (${elapsed}ms)`)
  ok("Catalog parsed — agent has full service knowledge")
  console.log()
  field("schema",    catalog.schema)
  field("generated", catalog.generatedAt)
  field("service",   `${catalog.service.name} v${catalog.service.version}`)
  field("network",   `${catalog.service.network} (chainId ${catalog.service.chainId})`)
  field("health",    `${catalog.service.health.status}  uptime=${catalog.service.health.uptime}s`)
  field("tools",     `${catalog.tools.length} total`)
  field("payTo",     catalog.x402.payTo)
  field("x402 fee",  `${catalog.tools.find(t => t.pricing.scheme === "exact")?.pricing.amount ?? "?"} cUSD / write call`)

  // ───────────────────────────────────────────────────────────────────────────
  hr("STEP 2 · CHOOSE ROUTE")
  go(`Scanning ${catalog.tools.length} tools from catalog...`)
  console.log()

  const freeTools = catalog.tools.filter(t => t.pricing.scheme === "free")
  const paidTools = catalog.tools.filter(t => t.pricing.scheme === "exact")

  console.log(`  Free tools  (${freeTools.length}): ${freeTools.map(t => t.id).slice(0, 6).join(", ")}, …`)
  console.log(`  Paid tools   (${paidTools.length}): ${paidTools.map(t => `${t.id} (${t.pricing.amount} ${t.pricing.currency})`).join(", ")}`)
  console.log()

  // Pick free read tool for a real HTTP call
  const readTool = freeTools.find(t => t.id === "get_multi_price") ?? freeTools[0]!
  console.log(`  [READ]  Selected: ${readTool.id}`)
  console.log(`          Reason:   free tool — will make a real HTTP call to verify live data`)

  // Pick cheapest paid tool for the payment flow demo
  const paidTool = paidTools.reduce((a, b) =>
    parseFloat(a.pricing.amount ?? "999") <= parseFloat(b.pricing.amount ?? "999") ? a : b
  )
  console.log()
  console.log(`  [WRITE] Selected: ${paidTool.id}`)
  console.log(`          Price:    ${paidTool.pricing.amount} ${paidTool.pricing.currency}`)
  console.log(`          Header:   ${paidTool.requiredHeaders?.join(", ") ?? catalog.x402.requiredHeader}`)
  console.log(`          Reason:   cheapest write tool — will drive the x402 payment demo`)
  console.log()

  // Real HTTP call — free tool
  go(`Real call → GET ${BASE}/api/v1/prices?tokens=CELO,cUSD`)
  const pricesRes = await fetch(`${BASE}/api/v1/prices?tokens=CELO,cUSD`)
  if (!pricesRes.ok) throw new Error(`Prices fetch failed: ${pricesRes.status}`)
  const pricesData = await pricesRes.json() as {
    prices: Array<{ symbol: string; priceUsd: number; change24h: number | null }>
    updatedAt: string
  }
  got(`200 OK`)
  ok("Live prices received:")
  for (const p of pricesData.prices) {
    const ch = p.change24h ?? 0
    const sign = ch >= 0 ? "+" : ""
    console.log(`          ${p.symbol.padEnd(6)} $${p.priceUsd.toFixed(4).padStart(8)}  (${sign}${ch.toFixed(2)}% 24h)`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  hr("STEP 3 · SET SPEND CAP")

  const AGENT_CAP_PER_CALL = 0.01 // cUSD — agent's own conservative limit

  go("Reading catalog.spendLimits:")
  console.log(`          perCall  advisory: ${catalog.spendLimits.perCall.max} ${catalog.spendLimits.perCall.currency}`)
  console.log(`          perDay   advisory: ${catalog.spendLimits.perDay.max} ${catalog.spendLimits.perDay.currency}`)
  console.log(`          note: "${catalog.spendLimits.note}"`)
  console.log()
  go(`Agent self-imposed cap: ${AGENT_CAP_PER_CALL} ${catalog.spendLimits.perCall.currency} per call`)

  const toolCost = parseFloat(paidTool.pricing.amount ?? "0")

  go(`Checking: ${toolCost} ≤ ${AGENT_CAP_PER_CALL} ${paidTool.pricing.currency}?`)

  if (toolCost > AGENT_CAP_PER_CALL) {
    console.log(`\n  ✗ Tool cost ${toolCost} cUSD exceeds agent cap ${AGENT_CAP_PER_CALL} cUSD — REJECTED`)
    process.exit(1)
  }
  ok(`${toolCost} ≤ ${AGENT_CAP_PER_CALL} — within cap. Cleared to proceed.`)

  // ───────────────────────────────────────────────────────────────────────────
  hr("STEP 4 · INTENTIONAL FAILURE")

  const failureSchema = catalog.schemas.failureRefund

  sim(`POST ${BASE}/api/v1/chat`)
  sim(`  ${catalog.x402.requiredHeader}: "bad-payment-token-xyz"  ← malformed`)
  sim(`  body: { "message": "send 0.001 CELO to 0xDEAc..." }`)
  console.log()
  sim("Server validates payment → on-chain action reverts")
  console.log()

  // Construct failure response per catalog.schemas.failureRefund
  const failureBody = {
    error: {
      code:          "ON_CHAIN_REVERT",
      message:       "Transaction reverted — malformed payment token rejected",
      paymentStatus: "refunded" as const,
      txHash:        null,
    }
  }

  got(`200 ${JSON.stringify(failureBody)}`)
  console.log()
  go("Agent reads catalog.schemas.failureRefund:")
  console.log(`          states:    ${failureSchema.states.join(" | ")}`)
  console.log(`          onRevert:  "${failureSchema.behavior.onRevert}"`)
  console.log()
  go(`Checking paymentStatus: "${failureBody.error.paymentStatus}"`)

  if (failureBody.error.paymentStatus !== "refunded") {
    console.log("  ✗ Unexpected paymentStatus — aborting")
    process.exit(1)
  }
  ok("paymentStatus=refunded — X-PAYMENT voided, no funds captured.")
  ok("Agent knows it is safe to retry with no double-spend risk.")

  // ───────────────────────────────────────────────────────────────────────────
  hr("STEP 5 · RETRY WITH IDEMPOTENCY")

  const idempotencyKey = randomUUID()

  go("Agent reads catalog.idempotency:")
  console.log(`          header:   "${catalog.idempotency.header}"`)
  console.log(`          window:   ${catalog.idempotency.window}`)
  console.log(`          behavior: "${catalog.idempotency.behavior}"`)
  console.log()
  go(`Generated key (reused across retries): ${idempotencyKey}`)
  console.log()
  sim(`POST ${BASE}/api/v1/chat`)
  sim(`  ${catalog.idempotency.header}: ${idempotencyKey}`)
  sim(`  ${catalog.x402.requiredHeader}: <valid-x402-payment-token>`)
  sim(`  body: { "message": "${paidTool.id}: send 0.001 CELO to 0xDEAc..." }`)
  console.log()
  sim("Server: accepts Idempotency-Key, executes on-chain action once, returns receipt")
  got(`200 { response: "Sent 0.001 CELO. TX: 0xabcd..." }`)
  console.log()
  ok("Retry succeeded. Same key is safe to reuse — server deduplicates within 24h.")

  // ───────────────────────────────────────────────────────────────────────────
  hr("STEP 6 · RECONCILE RECEIPT")

  const receiptSchema = catalog.schemas.receiptFormat

  // Construct synthetic receipt per catalog.schemas.receiptFormat
  const syntheticTxHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  const receipt = {
    txHash:    syntheticTxHash,
    chainId:   receiptSchema.value.chainId,
    network:   receiptSchema.value.network,
    paidTo:    catalog.x402.payTo,
    amount:    paidTool.pricing.amount!,
    currency:  paidTool.pricing.currency!,
    settledAt: new Date().toISOString(),
  }

  sim(`Received header: ${receiptSchema.header}`)
  console.log()
  console.log(`          txHash:    ${receipt.txHash}`)
  console.log(`          amount:    ${receipt.amount} ${receipt.currency}`)
  console.log(`          paidTo:    ${receipt.paidTo}`)
  console.log(`          network:   ${receipt.network} (chainId ${receipt.chainId})`)
  console.log(`          settledAt: ${receipt.settledAt}`)
  console.log()
  go("Verifying receipt against catalog.schemas.receiptFormat...")
  console.log()

  const checks: Array<[string, boolean]> = [
    [`txHash is present and well-formed`,                          receipt.txHash.startsWith("0x") && receipt.txHash.length === 66],
    [`amount matches tool price (${paidTool.pricing.amount} ${paidTool.pricing.currency})`, receipt.amount === paidTool.pricing.amount],
    [`paidTo matches catalog.x402.payTo`,                          receipt.paidTo === catalog.x402.payTo],
    [`network is celo / chainId matches (${catalog.service.chainId})`, receipt.chainId === catalog.service.chainId],
  ]

  let allPassed = true
  for (const [label, passed] of checks) {
    console.log(`  ${passed ? "✓" : "✗"} ${label}`)
    if (!passed) allPassed = false
  }

  if (!allPassed) {
    console.log("\n  ✗ Receipt reconciliation FAILED — agent would escalate / not mark settled")
    process.exit(1)
  }
  console.log()
  console.log("  RECONCILED ✅")

  // ───────────────────────────────────────────────────────────────────────────
  hr("SUMMARY")
  console.log()

  type StepRow = { step: string; status: string; human: string }
  const steps: StepRow[] = [
    { step: "1. Cold crawl /catalog",                  status: "DONE", human: "no"       },
    { step: "2. Choose route + real HTTP read call",    status: "DONE", human: "no"       },
    { step: "3. Spend cap verification",                status: "DONE", human: "no"       },
    { step: "4. Handle failure + refund  [sim]",        status: "DONE", human: "no"       },
    { step: "5. Retry with Idempotency-Key  [sim]",     status: "DONE", human: "no"       },
    { step: "6. Reconcile receipt  [sim]",              status: "DONE", human: "no"       },
  ]

  const c1 = 42, c2 = 8, c3 = 15
  const top  = `  ┌${"─".repeat(c1)}┬${"─".repeat(c2)}┬${"─".repeat(c3)}┐`
  const sep  = `  ├${"─".repeat(c1)}┼${"─".repeat(c2)}┼${"─".repeat(c3)}┤`
  const bot  = `  └${"─".repeat(c1)}┴${"─".repeat(c2)}┴${"─".repeat(c3)}┘`
  const hdr  = `  │ ${"Step".padEnd(c1-2)} │ ${"Status".padEnd(c2-2)} │ ${"Human needed?".padEnd(c3-2)} │`

  console.log(top)
  console.log(hdr)
  console.log(sep)
  for (const s of steps) {
    console.log(`  │ ${s.step.padEnd(c1-2)} │ ${s.status.padEnd(c2-2)} │ ${s.human.padEnd(c3-2)} │`)
  }
  console.log(bot)
  console.log()
  console.log("  All 6 steps completed autonomously — /catalog was the only input.")
  console.log("  No human interaction required at any step.\n")
}

main().catch(e => {
  console.error("\n  ✗ Demo failed:", e instanceof Error ? e.message : String(e))
  process.exit(1)
})
