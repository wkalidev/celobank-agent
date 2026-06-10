/**
 * One-time script: register CeloBank Agent with the GoodDollar EngagementRewards contract.
 * Run once: npx ts-node --esm scripts/register-gooddollar.ts
 *
 * After running, the GoodDollar team must approve the app off-chain.
 * Once approved, CeloBank earns $0.50 G$ per new verified user onboarded.
 */
import "dotenv/config"
import { createWalletClient, createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { defineChain } from "viem"

const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
})

const ENGAGEMENT_REWARDS = "0x25db74CF4E7BA120526fd87e159CF656d94bAE43" as `0x${string}`

const APPLY_APP_ABI = [
  {
    name: "applyApp",
    type: "function",
    inputs: [
      { name: "_app",         type: "address" },
      { name: "_receiver",    type: "address" },
      { name: "_rewardPct",   type: "uint256" },
      { name: "_description", type: "string"  },
      { name: "_url",         type: "string"  },
      { name: "_contact",     type: "string"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

async function main() {
  const rawKey = process.env.PRIVATE_KEY!.trim()
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain: celo, transport: http() })
  const walletClient = createWalletClient({ account, chain: celo, transport: http() })

  console.log(`\n🌱 GoodDollar EngagementRewards Registration`)
  console.log(`   App (agent wallet): ${account.address}`)
  console.log(`   Contract: ${ENGAGEMENT_REWARDS}`)
  console.log(`   Network: Celo Mainnet (42220)\n`)

  const { request } = await publicClient.simulateContract({
    address: ENGAGEMENT_REWARDS,
    abi: APPLY_APP_ABI,
    functionName: "applyApp",
    args: [
      account.address,  // _app: CeloBank's agent wallet
      account.address,  // _receiver: wallet to receive reward share
      80n,              // _rewardPct: 80% to users, 20% to platform
      "CeloBank Agent — Non-custodial AI DeFi agent on Celo. Built for GoodBuilders Season 4.",
      "https://celobank-agent-production.up.railway.app",
      "wkalidev@gmail.com",
    ],
    account,
  })

  console.log("✅ Simulation passed. Submitting transaction...")
  const hash = await walletClient.writeContract(request)
  console.log(`\n📤 TX submitted: https://celoscan.io/tx/${hash}`)
  console.log(`\n⏳ Waiting for confirmation...`)

  await publicClient.waitForTransactionReceipt({ hash })
  console.log(`\n✅ Registration submitted! GoodDollar team will review and approve.`)
  console.log(`   Once approved, CeloBank earns $0.50 G$ per new verified user onboarded.`)
  console.log(`   Check status: https://celoscan.io/address/${ENGAGEMENT_REWARDS}`)
}

main().catch(e => { console.error("❌ Registration failed:", e.message); process.exit(1) })
