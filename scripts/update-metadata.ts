/**
 * Update CeloBank Agent ERC-8004 on-chain metadata to reflect 21 tools.
 * Strategy: deactivate existing token → registerAgent again with updated metadata.
 * (The contract has no updateDescription/updateCapabilities; re-registering
 *  overwrites agentByAddress[sender] to point to the new token.)
 *
 * Run: npx ts-node --esm scripts/update-metadata.ts
 */
import "dotenv/config"
import { createWalletClient, createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { celo } from "viem/chains"
import { readFileSync } from "fs"

// cUSD on Celo mainnet — paid as feeCurrency via CIP-64 so CELO balance isn't needed
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`

// Canonical ERC-8004 Identity Registry on Celo Mainnet (vanity address) — NOT
// the project's own CeloBankAgent.sol contract (0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1).
// 8004scan and Aigora resolve agent identity against this registry (agent #9225).
const CONTRACT = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as `0x${string}`
const artifact = JSON.parse(readFileSync("artifacts/contracts/CeloBankAgent.sol/CeloBankAgent.json", "utf-8"))

// ─── Updated metadata ─────────────────────────────────────────────────────────
const NEW_NAME = "CeloBank Agent"
const NEW_DESCRIPTION =
  "Non-custodial AI DeFi agent on Celo Mainnet. Universal swap (26 tokens via Mento V2 + Uniswap V3), " +
  "Aave V3 lending, Token Launcher (ERC-20 deploy), GoodDollar G$ integration " +
  "(human verification + EngagementRewards), DailyDrop streak rewards. " +
  "21 onchain tools. ERC-8004 compliant. x402 supported."
const NEW_ENDPOINT = "https://celobank-agent-production.up.railway.app/mcp"
const NEW_TOOLS = [
  "get_portfolio",
  "get_prices",
  "swap_celo",
  "swap_tokens",
  "save_cusd",
  "stake_celo",
  "send_celo",
  "trade_ideas",
  "get_bridge_info",
  "get_dailydrop_status",
  "get_yield_options",
  "daily_checkin",
  "launch_token",
  "get_tokens",
  "get_trending",
  "get_aave_position",
  "get_market_overview",
  "check_streak",
  "check_gooddollar",
  "get_engagement_rewards",
  "prepare_tx",
]

async function main() {
  const rawKey = process.env.PRIVATE_KEY!.trim()
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain: celo, transport: http() })
  const walletClient = createWalletClient({ account, chain: celo, transport: http() })

  console.log(`\n⬡ CeloBank Agent — ERC-8004 Metadata Update`)
  console.log(`   Wallet: ${account.address}`)
  console.log(`   Contract: ${CONTRACT}`)
  console.log(`   Network: Celo Mainnet (42220)\n`)

  // ── Step 1: Read current on-chain state ────────────────────────────────────
  const existingTokenId = await publicClient.readContract({
    address: CONTRACT, abi: artifact.abi,
    functionName: "agentByAddress",
    args: [account.address],
  }) as bigint

  if (existingTokenId === 0n) {
    console.log("ℹ️  No existing registration found. Proceeding with fresh registration.")
  } else {
    const existing = await publicClient.readContract({
      address: CONTRACT, abi: artifact.abi,
      functionName: "getAgent",
      args: [existingTokenId],
    }) as { name: string; description: string; endpoint: string; registeredAt: bigint; active: boolean }

    const existingCaps = await publicClient.readContract({
      address: CONTRACT, abi: artifact.abi,
      functionName: "getCapabilities",
      args: [existingTokenId],
    }) as string[]

    console.log(`📋 Current on-chain state (tokenId: ${existingTokenId})`)
    console.log(`   Name:        ${existing.name}`)
    console.log(`   Description: ${existing.description.slice(0, 80)}...`)
    console.log(`   Endpoint:    ${existing.endpoint}`)
    console.log(`   Active:      ${existing.active}`)
    console.log(`   Tools (${existingCaps.length}): ${existingCaps.join(", ")}\n`)

    // ── Step 2: Deactivate old token ──────────────────────────────────────────
    if (existing.active) {
      console.log(`🔴 Deactivating old token #${existingTokenId}...`)
      const deactivateHash = await walletClient.writeContract({
        address: CONTRACT, abi: artifact.abi,
        functionName: "deactivateAgent",
        args: [existingTokenId],
        account,
        feeCurrency: CUSD,
      } as any)
      await publicClient.waitForTransactionReceipt({ hash: deactivateHash })
      console.log(`   ✅ Deactivated — TX: https://celoscan.io/tx/${deactivateHash}\n`)
    } else {
      console.log(`ℹ️  Old token already inactive, skipping deactivation.\n`)
    }
  }

  // ── Step 3: Register with updated metadata ─────────────────────────────────
  console.log(`🆕 Registering updated metadata...`)
  console.log(`   Name:        ${NEW_NAME}`)
  console.log(`   Description: ${NEW_DESCRIPTION.slice(0, 80)}...`)
  console.log(`   Endpoint:    ${NEW_ENDPOINT}`)
  console.log(`   Tools (${NEW_TOOLS.length}): ${NEW_TOOLS.join(", ")}\n`)

  const { request } = await publicClient.simulateContract({
    address: CONTRACT, abi: artifact.abi,
    functionName: "registerAgent",
    args: [NEW_NAME, NEW_DESCRIPTION, NEW_ENDPOINT, NEW_TOOLS],
    account,
  })

  console.log("✅ Simulation passed. Submitting transaction...")
  // CIP-64: pay gas in cUSD (feeCurrency) — wallet has cUSD but limited CELO
  const hash = await walletClient.writeContract({
    ...request,
    feeCurrency: CUSD,
    gas: 2_000_000n,
  } as any)
  console.log(`\n📤 TX submitted: https://celoscan.io/tx/${hash}`)
  console.log(`⏳ Waiting for confirmation...`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`\n✅ Metadata updated on-chain!`)
  console.log(`   Block: ${receipt.blockNumber}`)
  console.log(`   TX:    https://celoscan.io/tx/${hash}`)
  console.log(`   📡 8004scan: https://8004scan.xyz/agents/${account.address}`)

  // ── Step 4: Verify new state ──────────────────────────────────────────────
  const newTokenId = await publicClient.readContract({
    address: CONTRACT, abi: artifact.abi,
    functionName: "agentByAddress",
    args: [account.address],
  }) as bigint

  const newCaps = await publicClient.readContract({
    address: CONTRACT, abi: artifact.abi,
    functionName: "getCapabilities",
    args: [newTokenId],
  }) as string[]

  console.log(`\n🔍 Verified on-chain (tokenId: ${newTokenId})`)
  console.log(`   Tools: ${newCaps.length} ✅`)
  console.log(`   ${newCaps.join(", ")}`)
}

main().catch(e => { console.error("❌ Update failed:", e.message); process.exit(1) })
