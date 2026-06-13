/**
 * Generate ERC-8004 registration-v1 metadata data URI, write to metadata-uri.txt,
 * verify the roundtrip, then update the on-chain endpoint to the data URI so that
 * 8004scan can decode the full schema (type, services, MCP health-check endpoint).
 *
 * Run: npx tsx scripts/gen-metadata-uri.ts
 */
import "dotenv/config"
import { writeFileSync, readFileSync } from "fs"
import { createWalletClient, createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { celo } from "viem/chains"

// ── Contract constants ────────────────────────────────────────────────────────
const CONTRACT = "0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1" as `0x${string}`
const CUSD     = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`
const artifact = JSON.parse(
  readFileSync("artifacts/contracts/CeloBankAgent.sol/CeloBankAgent.json", "utf-8"),
)

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

// ── OASF classification ───────────────────────────────────────────────────────
const OASF_SKILLS = [
  "token-swap",
  "aave-lending",
  "celo-staking",
  "erc20-token-launch",
  "gooddollar-identity",
]

const OASF_DOMAINS = [
  "defi",
  "payments",
  "lending",
  "staking",
  "tokenization",
  "identity",
  "financial-inclusion",
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
  x402support:      true,
  registrations:    [],
  supportedTrusts:  ["reputation"],
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

const endpointOk = parsed.services[0].endpoint.endsWith("/mcp")
const toolsOk    = parsed.services[0].mcpTools.length === 21
const typeOk     = parsed.type === "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"

console.log(`type field correct                  : ${typeOk     ? "PASS" : "FAIL"}`)
console.log(`services[0].endpoint ends with /mcp : ${endpointOk ? "PASS" : "FAIL"} (${parsed.services[0].endpoint})`)
console.log(`services[0].mcpTools.length === 21  : ${toolsOk    ? "PASS" : "FAIL"} (got ${parsed.services[0].mcpTools.length})`)

if (!typeOk || !endpointOk || !toolsOk) {
  console.error("Roundtrip FAILED — aborting on-chain update")
  process.exit(1)
}
console.log("Roundtrip OK\n")

// ── On-chain update ───────────────────────────────────────────────────────────
async function updateOnChain() {
  const rawKey    = process.env.PRIVATE_KEY!.trim()
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`
  const account   = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain: celo, transport: http() })
  const walletClient = createWalletClient({ account, chain: celo, transport: http() })

  console.log(`Wallet  : ${account.address}`)
  console.log(`Contract: ${CONTRACT}`)

  // Resolve the active tokenId for this wallet
  const tokenId = await publicClient.readContract({
    address: CONTRACT,
    abi:     artifact.abi,
    functionName: "agentByAddress",
    args:    [account.address],
  }) as bigint

  if (tokenId === 0n) {
    console.error("No active token found for this wallet — run scripts/update-metadata.ts first")
    process.exit(1)
  }
  console.log(`TokenId : ${tokenId}`)

  // Store the data URI as the on-chain endpoint so 8004scan can decode the full schema
  console.log("\nSubmitting updateEndpoint...")
  const hash = await walletClient.writeContract({
    address:     CONTRACT,
    abi:         artifact.abi,
    functionName: "updateEndpoint",
    args:        [tokenId, dataUri],
    account,
    feeCurrency: CUSD,
  } as any)

  console.log(`TX submitted: https://celoscan.io/tx/${hash}`)
  console.log("Waiting for confirmation...")

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`\nOn-chain endpoint updated!`)
  console.log(`  Block : ${receipt.blockNumber}`)
  console.log(`  TX    : https://celoscan.io/tx/${hash}`)
  console.log(`  8004  : https://8004scan.xyz/agents/${account.address}`)
}

updateOnChain().catch(e => {
  console.error("On-chain update failed:", e.message ?? e)
  process.exit(1)
})
