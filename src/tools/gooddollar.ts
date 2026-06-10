import "dotenv/config"
import { formatUnits } from "viem"
import { publicClient } from "./prepare.js"

// ─── Addresses ────────────────────────────────────────────────────────────────
const G_DOLLAR           = "0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A" as `0x${string}`
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
    name: "getAppRewards",
    type: "function",
    inputs: [{ name: "_app", type: "address" }],
    outputs: [
      { name: "total", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
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
    const result = await publicClient.readContract({
      address: ENGAGEMENT_REWARDS,
      abi: ENGAGEMENT_ABI,
      functionName: "getAppRewards",
      args: [appAddr],
    }) as [bigint, bigint]

    const [total, count] = result
    const totalG = parseFloat(formatUnits(total, 18)).toFixed(2)

    return `🎁 CeloBank × GoodDollar Engagement Rewards:
> Total G$ Distributed: ${totalG} G$
> Users Onboarded: ${count.toString()}
> Reward Rate: $0.50 G$ per new verified user
> Contract: https://celoscan.io/address/${ENGAGEMENT_REWARDS}

💡 Share CeloBank with friends. Every new verified user you bring earns you G$ rewards.`
  } catch (e: unknown) {
    return `❌ Failed to fetch engagement rewards: ${e instanceof Error ? e.message : String(e)}`
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
