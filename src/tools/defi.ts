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
const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`
const account      = privateKeyToAccount(privateKey)
const publicClient = createPublicClient({ chain: celo, transport: http() })
const walletClient = createWalletClient({ account, chain: celo, transport: http() })

// ─── Token Registry ───────────────────────────────────────────────────────────
const TOKENS: Record<string, { address: `0x${string}`; decimals: number; coingeckoId: string }> = {
  CELO:  { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18, coingeckoId: "celo" },
  cUSD:  { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, coingeckoId: "celo-dollar" },
  cEUR:  { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18, coingeckoId: "celo-euro" },
  cREAL: { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18, coingeckoId: "celo-brazilian-real" },
  USDC:  { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6,  coingeckoId: "usd-coin" },
  USDT:  { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6,  coingeckoId: "tether" },
}

const EXTRA_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  KESm: { address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", decimals: 18 },
  GBPm: { address: "0xCCF663b1fF11028f0b19058d0f7B674004a40746", decimals: 18 },
  NGNm: { address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", decimals: 18 },
  GHSm: { address: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313", decimals: 18 },
  XOFm: { address: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08", decimals: 18 },
  ZARm: { address: "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6", decimals: 18 },
}

const ALL_SWAP_TOKENS = { ...TOKENS, ...EXTRA_TOKENS }

// ─── Mento V2 ─────────────────────────────────────────────────────────────────
const BROKER          = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as `0x${string}`
const BI_POOL_MANAGER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as `0x${string}`

const BI_POOL_MANAGER_ABI = [
  {
    name: "getExchanges",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "exchangeId", type: "bytes32" },
          { name: "assets",     type: "address[]" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const

let exchangeCache: Map<string, `0x${string}`> | null = null

async function getExchangeId(tokenInAddr: string, tokenOutAddr: string): Promise<`0x${string}` | null> {
  if (!exchangeCache) {
    console.log("  📡 Chargement des exchange IDs depuis BiPoolManager...")
    try {
      const exchanges = await publicClient.readContract({
        address: BI_POOL_MANAGER,
        abi: BI_POOL_MANAGER_ABI,
        functionName: "getExchanges",
      }) as Array<{ exchangeId: `0x${string}`; assets: `0x${string}`[] }>

      exchangeCache = new Map()
      for (const ex of exchanges) {
        if (ex.assets.length >= 2) {
          const key1 = `${ex.assets[0].toLowerCase()}-${ex.assets[1].toLowerCase()}`
          const key2 = `${ex.assets[1].toLowerCase()}-${ex.assets[0].toLowerCase()}`
          exchangeCache.set(key1, ex.exchangeId)
          exchangeCache.set(key2, ex.exchangeId)
        }
      }
      console.log(`  ✅ ${exchanges.length} exchange pools chargés`)
    } catch (e) {
      console.error("  ❌ Erreur chargement exchanges:", e)
      exchangeCache = new Map()
    }
  }

  const key = `${tokenInAddr.toLowerCase()}-${tokenOutAddr.toLowerCase()}`
  return exchangeCache.get(key) ?? null
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const

const BROKER_ABI = [
  {
    name: "swapIn",
    type: "function",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId",       type: "bytes32"  },
      { name: "tokenIn",          type: "address"  },
      { name: "tokenOut",         type: "address"  },
      { name: "amountIn",         type: "uint256"  },
      { name: "amountOutMin",     type: "uint256"  },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const

const AAVE_POOL_ABI = [
  {
    name: "supply",
    type: "function",
    inputs: [
      { name: "asset",        type: "address" },
      { name: "amount",       type: "uint256" },
      { name: "onBehalfOf",   type: "address" },
      { name: "referralCode", type: "uint16"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
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

      const tokenBalances = await Promise.all(
        Object.entries(TOKENS).map(async ([symbol, token]) => {
          try {
            const balance = await publicClient.readContract({
              address: token.address,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [addr],
            })
            const formatted = parseFloat(formatUnits(balance, token.decimals)).toFixed(4)
            return `${symbol}: ${formatted}`
          } catch {
            return `${symbol}: N/A`
          }
        })
      )

      return [
        `Wallet ${addr.slice(0, 8)}... on Celo:`,
        `CELO: ${parseFloat(formatEther(nativeBalance)).toFixed(4)} (native)`,
        ...tokenBalances,
      ].join(" | ")
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

// ─── Tool 3 : Swap CELO → stablecoin via Mento V2 ────────────────────────────
export const swapCeloTool = tool(
  async ({ amount, tokenOut }) => {
    try {
      const symbol = Object.keys(ALL_SWAP_TOKENS).find(
        k => k.toLowerCase() === tokenOut.toLowerCase()
      )
      if (!symbol) return `Token "${tokenOut}" not supported. Available: cUSD, cEUR, cREAL, KESm, NGNm, GHSm, XOFm, ZARm`

      const token      = ALL_SWAP_TOKENS[symbol]
      const exchangeId = await getExchangeId(TOKENS.CELO.address, token.address)

      if (!exchangeId) {
        return `No Mento V2 pool found for CELO→${symbol}.`
      }

      console.log(`  🔍 Exchange ID pour CELO→${symbol}: ${exchangeId}`)

      const parsed = parseEther(amount)

      // ✅ ÉTAPE 1 : Approve
      const approveHash = await walletClient.writeContract({
        address: TOKENS.CELO.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BROKER, parsed],
      })
      console.log(`  ✅ Approve TX : ${approveHash}`)

      // ⏳ Attendre que l'approve soit minée AVANT d'envoyer le swap
      // (sinon les deux TX ont le même nonce → "replacement transaction underpriced")
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
      console.log(`  ✅ Approve confirmée, envoi du swap...`)

      // ✅ ÉTAPE 2 : Swap
      const hash = await walletClient.writeContract({
        address: BROKER,
        abi: BROKER_ABI,
        functionName: "swapIn",
        args: [BI_POOL_MANAGER, exchangeId, TOKENS.CELO.address, token.address, parsed, 0n],
      })
      console.log(`  ✅ Swap TX : ${hash}`)

      return `Swap done: ${amount} CELO → ${symbol} | TX: https://celoscan.io/tx/${hash}`
    } catch (e: any) {
      exchangeCache = null
      console.error("❌ SWAP ERROR:", e?.message)
      console.error("❌ SWAP CAUSE:", e?.cause)
      return `Swap error: ${e?.message ?? e}`
    }
  },
  {
    name: "swap_celo",
    description: "Swap CELO to cUSD, cEUR or cREAL via Mento V2",
    schema: z.object({
      amount:   z.string(),
      tokenOut: z.string(),
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

// ─── Tool 5 : Épargne sur Aave ────────────────────────────────────────────────
export const saveCUSDTool = tool(
  async ({ amount }) => {
    try {
      const parsed = parseUnits(amount, 18)

      // ✅ ÉTAPE 1 : Approve
      const approveHash = await walletClient.writeContract({
        address: TOKENS.cUSD.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [AAVE_POOL, parsed],
      })
      console.log(`  ✅ Approve TX : ${approveHash}`)

      // ⏳ Attendre que l'approve soit minée AVANT le dépôt
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
      console.log(`  ✅ Approve confirmée, envoi du dépôt Aave...`)

      // ✅ ÉTAPE 2 : Supply
      const supplyHash = await walletClient.writeContract({
        address: AAVE_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "supply",
        args: [TOKENS.cUSD.address, parsed, account.address, 0],
      })
      console.log(`  ✅ Supply TX : ${supplyHash}`)

      return `Deposited ${amount} cUSD on Aave. TX: https://celoscan.io/tx/${supplyHash}`
    } catch (e) {
      return `Aave deposit error: ${e}`
    }
  },
  {
    name: "save_cusd",
    description: "Deposit cUSD on Aave to earn yield",
    schema: z.object({
      amount: z.string(),
    }),
  }
)

// ─── Exports ──────────────────────────────────────────────────────────────────
export const swapCeloToCUSDTool = swapCeloTool
export const getBalanceTool     = getPortfolioTool
export const getCeloPriceTool   = getMultiPriceTool