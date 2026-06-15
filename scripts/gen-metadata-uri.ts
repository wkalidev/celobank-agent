/**
 * Generate ERC-8004 registration-v1 metadata data URI, write to metadata-uri.txt,
 * and verify the roundtrip. Does NOT update on-chain — paste metadata-uri.txt content
 * into the 8004scan Management UI to update the on-chain endpoint manually.
 *
 * Run: npx tsx scripts/gen-metadata-uri.ts
 */
import { writeFileSync, readFileSync } from "fs"

// ── MCP tools (21) — must match server.ts MCP_TOOLS ──────────────────────────
const MCP_TOOLS = [
  "get_balance",
  "get_portfolio",
  "get_celo_price",
  "get_multi_price",
  "send_celo",
  "swap_celo",
  "swap_tokens",
  "save_cusd",
  "get_aave_position",
  "stake_celo",
  "unstake_celo",
  "get_staking_position",
  "get_yield_options",
  "trade_ideas",
  "get_market_overview",
  "get_bridge_info",
  "get_dailydrop_status",
  "launch_token",
  "get_tokens",
  "check_gooddollar",
  "get_engagement_rewards",
]

// ── OASF classification — confirmed paths from github.com/agntcy/oasf ────────
const OASF_SKILLS = [
  "tool_interaction",
  "analytical_skills",
  "agent_orchestration",
  "natural_language_processing",
]

const OASF_DOMAINS = [
  "technology/blockchain/defi",
  "technology/blockchain/cryptocurrency",
  "technology/blockchain/smart_contracts",
  "finance_and_business/finance",
  "finance_and_business/investment_services",
  "trust_and_safety/fraud_prevention",
]

// ── Registration-v1 metadata ──────────────────────────────────────────────────
const metadata = {
  name:   "CeloBank Agent",
  type:   "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  image:  "https://celobank-agent.vercel.app/logo.svg",
  active: true,
  services: [
    {
      name:         "MCP",
      endpoint:     "https://celobank-agent-production.up.railway.app/mcp",
      version:      "2024-11-05",
      capabilities: ["tools"],
      mcpTools:     MCP_TOOLS,
      mcpPrompts: [
        "swap CELO to cUSD",
        "check my balance",
        "stake CELO",
        "save cUSD on Aave",
        "daily check-in",
        "trade ideas",
        "launch a token",
        "check GoodDollar G$ balance",
      ],
      mcpResources: ["api_docs", "swagger_ui", "npm_sdk"],
    },
    {
      name:     "A2A",
      endpoint: "https://celobank-agent-production.up.railway.app/.well-known/agent-card.json",
      version:  "0.3.0",
    },
    {
      name:     "OASF",
      skills:   OASF_SKILLS,
      domains:  OASF_DOMAINS,
      endpoint: "https://github.com/agntcy/oasf/",
    },
  ],
  // ASCII-only — avoids Windows console encoding corruption in transit
  description:
    "Non-custodial AI DeFi agent on Celo Mainnet. Universal swap (26 tokens via " +
    "Mento V2 + Uniswap V3), Aave V3 lending, Token Launcher (ERC-20 deploy), " +
    "GoodDollar G$ integration, DailyDrop streak rewards. 21 onchain tools. " +
    "ERC-8004 compliant. x402 supported.",
  updatedAt:        1781568000,  // 2026-06-16 UTC
  x402Support:      true,
  registrations:    [],
  supportedTrust:   ["reputation"],
}

// ── Encode ────────────────────────────────────────────────────────────────────
const json    = JSON.stringify(metadata)
const b64     = Buffer.from(json, "utf8").toString("base64")
const dataUri = `data:application/json;base64,${b64}`

// Write only to file — never print the URI (avoids Windows chcp/encoding corruption)
writeFileSync("metadata-uri.txt", dataUri, { encoding: "ascii" })
console.log(`Wrote ${dataUri.length} chars to metadata-uri.txt`)

// ── Roundtrip verification ────────────────────────────────────────────────────
const PREFIX   = "data:application/json;base64,"
const readBack = readFileSync("metadata-uri.txt", "ascii")

if (!readBack.startsWith(PREFIX)) {
  console.error("FAIL: file does not start with expected data URI prefix")
  process.exit(1)
}

const decoded = Buffer.from(readBack.slice(PREFIX.length), "base64").toString("utf8")
const parsed  = JSON.parse(decoded) as typeof metadata

const endpointOk     = parsed.services[0].endpoint.endsWith("/mcp")
const toolsOk        = parsed.services[0].mcpTools.length === 21
const typeOk         = parsed.type === "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"
const capabilitiesOk = Array.isArray(parsed.services[0].capabilities) && parsed.services[0].capabilities.includes("tools")
const versionOk      = parsed.services[0].version === "2024-11-05"
const x402Ok         = parsed.x402Support === true
const trustOk        = Array.isArray(parsed.supportedTrust)
const updatedAtOk    = parsed.services && parsed.updatedAt === 1781568000
const a2aOk          = parsed.services[1]?.name === "A2A" && parsed.services[1]?.endpoint.includes("agent-card.json")
const oasfOk         = parsed.services[2]?.name === "OASF" && Array.isArray(parsed.services[2]?.domains) && parsed.services[2].domains.includes("technology/blockchain/defi")

console.log(`type field correct                  : ${typeOk         ? "PASS" : "FAIL"}`)
console.log(`services[0].endpoint ends with /mcp : ${endpointOk     ? "PASS" : "FAIL"} (${parsed.services[0].endpoint})`)
console.log(`services[0].mcpTools.length === 21  : ${toolsOk        ? "PASS" : "FAIL"} (got ${parsed.services[0].mcpTools.length})`)
console.log(`services[0].capabilities = ["tools"]: ${capabilitiesOk ? "PASS" : "FAIL"}`)
console.log(`services[0].version = "2024-11-05"  : ${versionOk      ? "PASS" : "FAIL"}`)
console.log(`x402Support = true                  : ${x402Ok         ? "PASS" : "FAIL"}`)
console.log(`supportedTrust is array             : ${trustOk        ? "PASS" : "FAIL"}`)
console.log(`updatedAt = 1781568000              : ${updatedAtOk    ? "PASS" : "FAIL"}`)
console.log(`services[1] = A2A agent-card        : ${a2aOk          ? "PASS" : "FAIL"}`)
console.log(`services[2] = OASF with domains     : ${oasfOk         ? "PASS" : "FAIL"}`)

if (!typeOk || !endpointOk || !toolsOk || !capabilitiesOk || !versionOk || !x402Ok || !trustOk || !updatedAtOk || !a2aOk || !oasfOk) {
  console.error("Roundtrip FAILED")
  process.exit(1)
}
console.log("Roundtrip OK")
console.log("\nmetadata-uri.txt written. Update on-chain manually via the 8004scan Management UI.")
