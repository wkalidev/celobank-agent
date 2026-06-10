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
      { name: "app",                    type: "address" },
      { name: "rewardReceiver",         type: "address" },
      { name: "userAndInviterPercentage", type: "uint8"   },
      { name: "userPercentage",         type: "uint8"   },
      { name: "description",            type: "string"  },
      { name: "url",                    type: "string"  },
      { name: "email",                  type: "string"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "registeredApps",
    type: "function",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "owner",                  type: "address" },
      { name: "rewardReceiver",         type: "address" },
      { name: "totalRewardsClaimed",    type: "uint96"  },
      { name: "registeredAt",           type: "uint32"  },
      { name: "lastResetAt",            type: "uint32"  },
      { name: "userAndInviterPercentage", type: "uint8" },
      { name: "userPercentage",         type: "uint8"   },
      { name: "isRegistered",           type: "bool"    },
      { name: "isApproved",             type: "bool"    },
      { name: "description",            type: "string"  },
      { name: "url",                    type: "string"  },
      { name: "email",                  type: "string"  },
    ],
    stateMutability: "view",
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

  // Check if already registered
  const existing = await publicClient.readContract({
    address: ENGAGEMENT_REWARDS,
    abi: APPLY_APP_ABI,
    functionName: "registeredApps",
    args: [account.address],
  }) as { isRegistered: boolean; isApproved: boolean; description: string }

  if (existing.isRegistered) {
    console.log(`ℹ️  Already registered!`)
    console.log(`   Approved: ${existing.isApproved ? "✅ Yes" : "⏳ Pending GoodDollar approval"}`)
    console.log(`   Description: ${existing.description}`)
    process.exit(0)
  }

  const { request } = await publicClient.simulateContract({
    address: ENGAGEMENT_REWARDS,
    abi: APPLY_APP_ABI,
    functionName: "applyApp",
    args: [
      account.address,  // app: CeloBank's agent wallet
      account.address,  // rewardReceiver: same wallet receives reward share
      80,               // userAndInviterPercentage: 80% split between user+inviter
      60,               // userPercentage: 60% of that 80% to user, 40% to inviter
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
