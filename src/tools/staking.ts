import "dotenv/config"
import {
  createPublicClient,
  http,
  formatEther,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { defineChain } from "viem"
import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { prepareStake, prepareUnstake, UNSIGNED_TX_MARKER } from "./prepare.js"

// ─── Chain ────────────────────────────────────────────────────────────────────
const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC ?? "https://forno.celo.org"] } },
})

// Read-only account/client — fallback default address for read tools only.
// This wallet NEVER signs or broadcasts write transactions (non-custodial v2).
const rawKey = process.env.PRIVATE_KEY!.trim()
const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
const account = privateKeyToAccount(privateKey as `0x${string}`)
const publicClient = createPublicClient({ chain: celo, transport: http() })

// ─── Staked CELO (stCELO) ────────────────────────────────────────────────────
const STAKED_CELO_TOKEN = "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24" as `0x${string}`

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const

// ─── Yield options (informational) ────────────────────────────────────────────
const YIELD_OPTIONS = [
  {
    protocol: "Staked CELO",
    asset: "CELO → stCELO",
    apy: "~4%",
    risk: "low",
    lockup: "none",
    description: "Stake CELO and earn staking rewards. Liquid staking — no lockup.",
    action: "stake_celo",
  },
  {
    protocol: "Aave V3",
    asset: "cUSD",
    apy: "~3-5%",
    risk: "low",
    lockup: "none",
    description: "Supply cUSD to Aave V3 lending pool and earn interest automatically.",
    action: "save_cusd",
  },
  {
    protocol: "Aave V3",
    asset: "USDC",
    apy: "~4-6%",
    risk: "low",
    lockup: "none",
    description: "Supply USDC to Aave V3. Higher yield than cUSD usually.",
    action: "save_usdc",
  },
  {
    protocol: "Ubeswap V3",
    asset: "CELO/cUSD LP",
    apy: "~8-15%",
    risk: "medium",
    lockup: "none",
    description: "Provide liquidity on Ubeswap. Earn trading fees + UBE rewards. IL risk.",
    action: "info_only",
    url: "https://ubeswap.org",
  },
  {
    protocol: "Ubeswap V3",
    asset: "CELO/USDC LP",
    apy: "~10-20%",
    risk: "medium",
    lockup: "none",
    description: "Higher APY LP pool. More IL risk due to CELO volatility.",
    action: "info_only",
    url: "https://ubeswap.org",
  },
  {
    protocol: "Mento",
    asset: "cUSD/USDC",
    apy: "~2-3%",
    risk: "very low",
    lockup: "none",
    description: "Stable-stable swap fees on Mento. Lowest risk yield on Celo.",
    action: "info_only",
    url: "https://app.mento.org",
  },
]

// ─── Tool: Stake CELO (non-custodial) ─────────────────────────────────────────
// Delegates to prepare.ts — returns an unsigned transaction the connected user
// signs. The agent wallet never deposits its own funds on the user's behalf.
export const stakeCeloTool = tool(
  async ({ userAddress, amount }: { userAddress: string; amount: string }) => {
    try {
      const result = await prepareStake(userAddress, amount)
      return UNSIGNED_TX_MARKER + JSON.stringify(result)
    } catch (e: unknown) {
      return `❌ Staking failed: ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "stake_celo",
    description: "Prepare an unsigned transaction to stake CELO and earn ~4% APY via Staked CELO (stCELO). The connected user signs it.",
    schema: z.object({
      userAddress: z.string().describe("The CONNECTED USER's wallet address 0x... (signer) — required"),
      amount: z.string().describe("Amount of CELO to stake (e.g. '10')"),
    }),
  }
)

// ─── Tool: Unstake CELO (non-custodial) ───────────────────────────────────────
export const unstakeCeloTool = tool(
  async ({ userAddress, amount }: { userAddress: string; amount: string }) => {
    try {
      const result = await prepareUnstake(userAddress, amount)
      return UNSIGNED_TX_MARKER + JSON.stringify(result)
    } catch (e: unknown) {
      return `❌ Unstaking failed: ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "unstake_celo",
    description: "Prepare an unsigned transaction to unstake stCELO back to CELO. Unbonding period ~3 days. The connected user signs it.",
    schema: z.object({
      userAddress: z.string().describe("The CONNECTED USER's wallet address 0x... (signer) — required"),
      amount: z.string().describe("Amount of stCELO to unstake"),
    }),
  }
)

// ─── Tool: Get stCELO Balance ─────────────────────────────────────────────────
export const getStakingPositionTool = tool(
  async ({ address }: { address?: string }) => {
    try {
      const addr = (address ?? account.address) as `0x${string}`

      const [celoBalance, stCeloBalance] = await Promise.all([
        publicClient.getBalance({ address: addr }),
        publicClient.readContract({
          address: STAKED_CELO_TOKEN,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [addr],
        }),
      ])

      const celoFmt   = parseFloat(formatEther(celoBalance)).toFixed(4)
      const stCeloFmt = parseFloat(formatEther(stCeloBalance)).toFixed(4)
      const totalCelo = parseFloat(celoFmt) + parseFloat(stCeloFmt)

      return `📊 Staking Position for ${addr}:
> CELO (liquid):  ${celoFmt} CELO
> stCELO (staked): ${stCeloFmt} stCELO (~${stCeloFmt} CELO)
> Total:          ${totalCelo.toFixed(4)} CELO
> Staking APY:    ~4%
> Protocol:       Staked Celo (https://docs.stcelo.xyz)`
    } catch (e: unknown) {
      return `❌ Failed to get staking position: ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "get_staking_position",
    description: "Get CELO staking position — CELO balance + stCELO (staked CELO) balance and APY.",
    schema: z.object({
      address: z.string().optional().describe("Wallet address (optional, defaults to agent wallet)"),
    }),
  }
)

// ─── Tool: Get Yield Options ──────────────────────────────────────────────────
export const getYieldOptionsTool = tool(
  async ({ riskLevel }: { riskLevel?: string }) => {
    try {
      const filter = riskLevel?.toLowerCase()
      const options = filter
        ? YIELD_OPTIONS.filter(o => o.risk.includes(filter))
        : YIELD_OPTIONS

      let result = `💰 Yield Options on Celo (${filter ?? "all risk levels"}):\n\n`

      options.forEach((opt, i) => {
        result += `${i + 1}. ${opt.protocol} — ${opt.asset}
   APY: ${opt.apy} | Risk: ${opt.risk} | Lockup: ${opt.lockup}
   ${opt.description}
   ${opt.url ? `→ ${opt.url}` : `→ Use command: ${opt.action}`}\n\n`
      })

      result += `💡 Tip: Start with Aave V3 cUSD (lowest risk) or Staked CELO (liquid staking).`
      return result
    } catch (e: unknown) {
      return `❌ Failed: ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "get_yield_options",
    description: "Get all yield/staking options on Celo with APY, risk level, and how to use them.",
    schema: z.object({
      riskLevel: z.string().optional().describe("Filter by risk: 'low', 'medium', 'very low'"),
    }),
  }
)
