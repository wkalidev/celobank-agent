import "dotenv/config"
import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { defineChain } from "viem"
import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { prepareSwap, prepareSupplyAave, UNSIGNED_TX_MARKER } from "./prepare.js"

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

// ─── Token Registry ───────────────────────────────────────────────────────────
const TOKENS: Record<string, { address: `0x${string}`; decimals: number; coingeckoId: string }> = {
  CELO:  { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18, coingeckoId: "celo" },
  cUSD:  { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, coingeckoId: "celo-dollar" },
  cEUR:  { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18, coingeckoId: "celo-euro" },
  cREAL: { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18, coingeckoId: "celo-brazilian-real" },
  USDC:  { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6,  coingeckoId: "usd-coin" },
  USDT:  { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6,  coingeckoId: "tether" },
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const AAVE_POOL_ABI = [
  {
    name: "getUserAccountData",
    type: "function",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase",         type: "uint256" },
      { name: "totalDebtBase",               type: "uint256" },
      { name: "availableBorrowsBase",        type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv",                         type: "uint256" },
      { name: "healthFactor",                type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const

const AAVE_POOL = "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402" as `0x${string}`

// ─── Tool 1 : Portefeuille ────────────────────────────────────────────────────
export const getPortfolioTool = tool(
  async ({ address }) => {
    try {
      const addr = (address || account.address) as `0x${string}`
      const nativeBalance = await publicClient.getBalance({ address: addr })
      return `Wallet ${addr.slice(0, 8)}... on Celo | CELO: ${parseFloat(formatEther(nativeBalance)).toFixed(4)} (native)`
    } catch (e) {
      return `Portfolio error: ${e}`
    }
  },
  {
    name: "get_portfolio",
    description: "Get token balances (CELO, cUSD, cEUR, cREAL, USDC, USDT) for an address",
    schema: z.object({
      address: z.string().optional(),
    }),
  }
)

// ─── Tool 2 : Prix ────────────────────────────────────────────────────────────
export const getMultiPriceTool = tool(
  async ({ tokens }) => {
    try {
      const requested = tokens
        ? tokens.toUpperCase().split(",").map((t: string) => t.trim()).filter((t: string) => TOKENS[t])
        : Object.keys(TOKENS)

      const ids = requested.map((t: string) => TOKENS[t].coingeckoId).join(",")
      const res  = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
      )
      const data = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>

      const lines = requested.map((symbol: string) => {
        const id     = TOKENS[symbol].coingeckoId
        const price  = data[id]?.usd ?? "N/A"
        const change = data[id]?.usd_24h_change
        const pct    = change ? ` (${change.toFixed(2)}%)` : ""
        return `${symbol}: $${price}${pct}`
      })

      return lines.join(" | ")
    } catch (e) {
      return `Price error: ${e}`
    }
  },
  {
    name: "get_multi_price",
    description: "Get USD prices for tokens: CELO, cUSD, cEUR, cREAL, USDC, USDT",
    schema: z.object({
      tokens: z.string().optional(),
    }),
  }
)

// ─── Tool 3 : Swap CELO → stablecoin via Mento V2 (non-custodial) ────────────
// Delegates to prepare.ts — returns an unsigned transaction for the connected
// user's wallet to sign. The agent never holds or moves the swap output.
export const swapCeloTool = tool(
  async ({ userAddress, amount, tokenOut }) => {
    try {
      const result = await prepareSwap(userAddress, amount, tokenOut, "CELO")
      return UNSIGNED_TX_MARKER + JSON.stringify(result)
    } catch (e: any) {
      return `Swap error: ${e?.message ?? e}`
    }
  },
  {
    name: "swap_celo",
    description: "Prepare an unsigned transaction to swap CELO to cUSD, cEUR or cREAL via Mento V2. The connected user signs it.",
    schema: z.object({
      userAddress: z.string().describe("The CONNECTED USER's wallet address 0x... (signer) — required"),
      amount:      z.string(),
      tokenOut:    z.string(),
    }),
  }
)

// ─── Tool 4 : Position Aave ───────────────────────────────────────────────────
export const getAavePositionTool = tool(
  async ({ address }) => {
    try {
      const addr = (address || account.address) as `0x${string}`
      const data = await publicClient.readContract({
        address: AAVE_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "getUserAccountData",
        args: [addr],
      }) as [bigint, bigint, bigint, bigint, bigint, bigint]

      const [collateral, debt, available, , , healthFactor] = data
      const hfDisplay = healthFactor > BigInt("1000000000000000000000") ? "∞" : parseFloat(formatUnits(healthFactor, 18)).toFixed(2)
      return [
        `Aave position:`,
        `Collateral: $${formatUnits(collateral, 8)}`,
        `Debt: $${formatUnits(debt, 8)}`,
        `Available: $${formatUnits(available, 8)}`,
        `Health: ${hfDisplay}`,
      ].join(" | ")
    } catch (e) {
      return `Aave error: ${e}`
    }
  },
  {
    name: "get_aave_position",
    description: "Check Aave position: collateral, debt, health factor",
    schema: z.object({
      address: z.string().optional(),
    }),
  }
)

// ─── Tool 5 : Épargne sur Aave (non-custodial) ───────────────────────────────
export const saveCUSDTool = tool(
  async ({ userAddress, amount, asset }) => {
    try {
      const result = await prepareSupplyAave(userAddress, amount, asset ?? "cUSD")
      return UNSIGNED_TX_MARKER + JSON.stringify(result)
    } catch (e) {
      return `Aave deposit error: ${e}`
    }
  },
  {
    name: "save_cusd",
    description: "Prepare an unsigned transaction to deposit cUSD or USDC on Aave V3 to earn yield. The connected user signs it.",
    schema: z.object({
      userAddress: z.string().describe("The CONNECTED USER's wallet address 0x... (signer) — required"),
      amount:      z.string(),
      asset:       z.string().optional().describe("Asset to supply: cUSD (default) or USDC"),
    }),
  }
)

// ─── Tool 6 : Universal Swap (Mento V2 + Uniswap V3) — non-custodial ────────
export const swapTokensTool = tool(
  async ({ userAddress, amount, tokenIn = "CELO", tokenOut }) => {
    try {
      const result = await prepareSwap(userAddress, amount, tokenOut, tokenIn)
      return UNSIGNED_TX_MARKER + JSON.stringify(result)
    } catch (e: any) {
      return `Swap error: ${e?.message ?? e}`
    }
  },
  {
    name: "swap_tokens",
    description: "Prepare an unsigned transaction to swap ANY token pair on Celo. Uses Mento V2 for CELO↔stablecoins, Uniswap V3 for all other pairs. The connected user signs it.",
    schema: z.object({
      userAddress: z.string().describe("The CONNECTED USER's wallet address 0x... (signer) — required"),
      amount:      z.string().describe("Amount of tokenIn to swap"),
      tokenIn:     z.string().default("CELO").describe("Source token symbol (default: CELO)"),
      tokenOut:    z.string().describe("Destination token symbol"),
    }),
  }
)
