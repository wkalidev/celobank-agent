import "dotenv/config"
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  formatUnits,
  parseUnits,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { defineChain } from "viem"
import { tool } from "@langchain/core/tools"
import { z } from "zod"

// ─── Chain ────────────────────────────────────────────────────────────────────
const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC ?? "https://forno.celo.org"] } },
})

const rawKey = process.env.PRIVATE_KEY!.trim()
const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
const account = privateKeyToAccount(privateKey as `0x${string}`)
const publicClient = createPublicClient({ chain: celo, transport: http() })
const walletClient = createWalletClient({ account, chain: celo, transport: http() })

// ─── Staked CELO (stCELO) ────────────────────────────────────────────────────
const STAKED_CELO_MANAGER = "0x0239b96D10a434a56CC9E09383077A0490cF9398" as `0x${string}`
const STAKED_CELO_TOKEN   = "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24" as `0x${string}`

const STAKED_CELO_MANAGER_ABI = [
  {
    name: "deposit",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [{ name: "stakedCeloAmount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const

// ─── Ubeswap Pools (top yield) ────────────────────────────────────────────────
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

// ─── Tool: Stake CELO ─────────────────────────────────────────────────────────
export const stakeCeloTool = tool(
  async ({ amount }: { amount: string }) => {
    try {
      const amountWei = parseEther(amount)

      // Check balance
      const balance = await publicClient.getBalance({ address: account.address })
      if (balance < amountWei + parseEther("0.01")) {
        return `❌ Insufficient CELO balance. You have ${formatEther(balance)} CELO, need ${amount} + gas.`
      }

      // Deposit to Staked CELO Manager
      const hash = await walletClient.writeContract({
        address: STAKED_CELO_MANAGER,
        abi: STAKED_CELO_MANAGER_ABI,
        functionName: "deposit",
        value: amountWei,
      })

      // Get stCELO balance after
      const stCeloBalance = await publicClient.readContract({
        address: STAKED_CELO_TOKEN,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      })

      return `✅ Staked ${amount} CELO successfully!
> TX Hash: ${hash}
> Explorer: https://celoscan.io/tx/${hash}
> stCELO Balance: ${formatEther(stCeloBalance)} stCELO
> APY: ~4% (Celo validator rewards)
> Lockup: None — unstake anytime`
    } catch (e: unknown) {
      return `❌ Staking failed: ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "stake_celo",
    description: "Stake CELO to earn ~4% APY via Staked CELO (stCELO). Liquid staking, no lockup.",
    schema: z.object({
      amount: z.string().describe("Amount of CELO to stake (e.g. '10')"),
    }),
  }
)

// ─── Tool: Unstake CELO ───────────────────────────────────────────────────────
export const unstakeCeloTool = tool(
  async ({ amount }: { amount: string }) => {
    try {
      const amountWei = parseEther(amount)

      // Check stCELO balance
      const stBalance = await publicClient.readContract({
        address: STAKED_CELO_TOKEN,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      })

      if (stBalance < amountWei) {
        return `❌ Insufficient stCELO balance. You have ${formatEther(stBalance)} stCELO.`
      }

      // Approve Manager to spend stCELO
      const approveTx = await walletClient.writeContract({
        address: STAKED_CELO_TOKEN,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [STAKED_CELO_MANAGER, amountWei],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })

      // Withdraw
      const hash = await walletClient.writeContract({
        address: STAKED_CELO_MANAGER,
        abi: STAKED_CELO_MANAGER_ABI,
        functionName: "withdraw",
        args: [amountWei],
      })

      return `✅ Unstaked ${amount} stCELO successfully!
> TX Hash: ${hash}
> Explorer: https://celoscan.io/tx/${hash}
> CELO will be received after unbonding period (~3 days)`
    } catch (e: unknown) {
      return `❌ Unstaking failed: ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "unstake_celo",
    description: "Unstake stCELO back to CELO. Unbonding period ~3 days.",
    schema: z.object({
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