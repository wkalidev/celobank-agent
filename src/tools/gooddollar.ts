import "dotenv/config"
import { formatUnits } from "viem"
import { publicClient } from "./prepare.js"

// ─── Addresses ────────────────────────────────────────────────────────────────
const G_DOLLAR           = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as `0x${string}`
const ENGAGEMENT_REWARDS = "0x25db74CF4E7BA120526fd87e159CF656d94bAE43" as `0x${string}`
const IDENTITY_V4        = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42" as `0x${string}`

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const

const IDENTITY_ABI = [
  {
    name: "isVerified",
    type: "function",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "getIdentityExpiry",
    type: "function",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const

const ENGAGEMENT_ABI = [
  {
    name: "appsStats",
    type: "function",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "numberOfRewards",    type: "uint96" },
      { name: "totalAppRewards",    type: "uint96" },
      { name: "totalUserRewards",   type: "uint96" },
      { name: "totalInviterRewards", type: "uint96" },
    ],
    stateMutability: "view",
  },
  {
    name: "rewardAmount",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint96" }],
    stateMutability: "view",
  },
] as const

// ─── checkGoodDollar ──────────────────────────────────────────────────────────
async function checkGoodDollar(address: string): Promise<string> {
  const addr = address as `0x${string}`

  const [balResult, verifiedResult, expiryResult] = await Promise.allSettled([
    publicClient.readContract({ address: G_DOLLAR, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }),
    publicClient.readContract({ address: IDENTITY_V4, abi: IDENTITY_ABI, functionName: "isVerified", args: [addr] }),
    publicClient.readContract({ address: IDENTITY_V4, abi: IDENTITY_ABI, functionName: "getIdentityExpiry", args: [addr] }),
  ])

  if (balResult.status === "rejected")
    console.error("[checkGoodDollar] balanceOf failed:", balResult.reason)
  if (verifiedResult.status === "rejected")
    console.error("[checkGoodDollar] isVerified failed:", verifiedResult.reason)
  if (expiryResult.status === "rejected")
    console.error("[checkGoodDollar] getIdentityExpiry failed:", expiryResult.reason)

  const gBal     = balResult.status === "fulfilled"
    ? parseFloat(formatUnits(balResult.value as bigint, 18)).toFixed(4) : "0.0000"
  const verified = verifiedResult.status === "fulfilled" ? Boolean(verifiedResult.value) : false
  const expiryTs = expiryResult.status === "fulfilled" ? Number(expiryResult.value as bigint) : 0
  const expiry   = expiryTs > 0 ? new Date(expiryTs * 1000).toLocaleDateString() : "N/A"

  return `🌱 GoodDollar (G$) Status:
> Address: ${addr}
> G$ Balance: ${gBal} G$
> Verified Human: ${verified ? `✅ Yes — identity expires ${expiry}` : "❌ Not verified"}
> Token: https://celoscan.io/token/${G_DOLLAR}?a=${addr}

${verified
    ? "💡 Your identity is verified! Invite friends to CeloBank to earn $0.50 G$ per new user you onboard."
    : "💡 Verify your identity (2 min, free): https://wallet.gooddollar.org\n   Verified users earn G$ UBI daily on Ethereum & Fuse networks."
  }`
}

// ─── getEngagementRewards ─────────────────────────────────────────────────────
async function getEngagementRewards(appAddress?: string): Promise<string> {
  const appAddr = (
    appAddress ?? process.env.CELOBANK_APP_ADDRESS ?? process.env.AGENT_ADDRESS
    ?? "0x0000000000000000000000000000000000000000"
  ) as `0x${string}`

  try {
    const [stats, rewardAmt] = await Promise.all([
      publicClient.readContract({
        address: ENGAGEMENT_REWARDS,
        abi: ENGAGEMENT_ABI,
        functionName: "appsStats",
        args: [appAddr],
      }) as Promise<[bigint, bigint, bigint, bigint]>,
      publicClient.readContract({
        address: ENGAGEMENT_REWARDS,
        abi: ENGAGEMENT_ABI,
        functionName: "rewardAmount",
      }) as Promise<bigint>,
    ])

    const [numberOfRewards, totalApp, totalUser, totalInviter] = stats
    const perReward = parseFloat(formatUnits(rewardAmt, 18)).toFixed(4)
    const totalDist = parseFloat(formatUnits(totalApp, 18)).toFixed(2)

    return `🎁 CeloBank × GoodDollar Engagement Rewards:
> Users Onboarded: ${numberOfRewards.toString()}
> Total G$ Distributed: ${totalDist} G$
>   └ To Users: ${parseFloat(formatUnits(totalUser, 18)).toFixed(2)} G$
>   └ To Inviters: ${parseFloat(formatUnits(totalInviter, 18)).toFixed(2)} G$
> Reward per New User: ${perReward} G$ (~$0.50)
> Contract: https://celoscan.io/address/${ENGAGEMENT_REWARDS}

💡 Share CeloBank with friends. Every new verified user you bring earns you G$ rewards.`
  } catch (e: unknown) {
    console.error("[getEngagementRewards] Error:", e instanceof Error ? e.message : e)
    return "❌ Failed to fetch engagement rewards. Please try again."
  }
}

// ─── Tool wrappers (LangChain-compatible .invoke() interface) ─────────────────
export const checkGoodDollarTool = {
  invoke: async (args: { address?: string }) => {
    if (!args.address) return "❌ Please provide a wallet address to check G$ status."
    return checkGoodDollar(args.address)
  },
}

export const getEngagementRewardsTool = {
  invoke: async (args: { address?: string }) => getEngagementRewards(args.address),
}
