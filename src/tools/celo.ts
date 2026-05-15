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

// ─── Token Registry ───────────────────────────────────────────────────────────
const TOKENS: Record<string, { address: `0x${string}`; decimals: number; coingeckoId: string }> = {
  CELO:   { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18, coingeckoId: "celo" },
  cUSD:   { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, coingeckoId: "celo-dollar" },
  cEUR:   { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18, coingeckoId: "celo-euro" },
  cREAL:  { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18, coingeckoId: "celo-brazilian-real" },
  USDC:   { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6,  coingeckoId: "usd-coin" },
  USDT:   { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6,  coingeckoId: "tether" },
  STCELO: { address: "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24", decimals: 18, coingeckoId: "staked-celo" },
  G$:     { address: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", decimals: 18, coingeckoId: "good-dollar" },
}

// ─── Mento V2 ─────────────────────────────────────────────────────────────────
const BROKER          = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as `0x${string}`
const BI_POOL_MANAGER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as `0x${string}`

// Vrais Exchange IDs Mento V2 Mainnet
const EXCHANGE_IDS: Record<string, `0x${string}`> = {
  "CELO-cUSD":  "0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c",
  "CELO-cEUR":  "0xb73ffc6b5123de3c8e460490543ab93a3be7d70824f1a343847aa5d49b6f53a8",
  "CELO-cREAL": "0xed0528e42b9ecae538e6d7438b2a05ee21cd4d12c2d266e71e0e0cd0ae0bcf6",
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

const AAVE_POOL = "0x3E59A31363E2a8B85aA1603a85FCe16E4A7B78c6" as `0x${string}`

// ─── Tool 1 : Portefeuille complet ────────────────────────────────────────────
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
            const formatted = formatUnits(balance, token.decimals)
            return `• ${symbol.padEnd(6)}: ${parseFloat(formatted).toFixed(4)}`
          } catch {
            return `• ${symbol.padEnd(6)}: N/A`
          }
        })
      )
      return [
        `💼 Portefeuille ${addr.slice(0, 6)}...${addr.slice(-4)} sur Celo Mainnet :`,
        `• CELO  : ${parseFloat(formatEther(nativeBalance)).toFixed(4)} (natif)`,
        ...tokenBalances,
      ].join("\n")
    } catch (e) {
      return `Erreur lecture portefeuille : ${e}`
    }
  },
  {
    name: "get_portfolio",
    description: "Affiche le portefeuille complet : soldes CELO, cUSD, cEUR, cREAL, USDC, USDT",
    schema: z.object({
      address: z.string().optional().describe("Adresse wallet 0x... (optionnel)"),
    }),
  }
)

// ─── Tool 2 : Prix de plusieurs tokens ───────────────────────────────────────
export const getMultiPriceTool = tool(
  async ({ tokens }) => {
    try {
      const requested = tokens
        ? tokens.toUpperCase().split(",").map((t: string) => t.trim())
        : Object.keys(TOKENS)
      const ids = requested
        .filter((t: string) => TOKENS[t])
        .map((t: string) => TOKENS[t].coingeckoId)
        .join(",")
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
      )
      const data = await res.json()
      const lines = requested
        .filter((t: string) => TOKENS[t])
        .map((symbol: string) => {
          const id = TOKENS[symbol].coingeckoId
          const price = data[id]?.usd ?? "N/A"
          const change = data[id]?.usd_24h_change
          const arrow = change > 0 ? "📈" : "📉"
          const pct = change ? ` (${change.toFixed(2)}% 24h ${arrow})` : ""
          return `• ${symbol.padEnd(6)}: $${price}${pct}`
        })
      return ["💰 Prix en temps réel sur Celo :", ...lines].join("\n")
    } catch (e) {
      return `Erreur prix : ${e}`
    }
  },
  {
    name: "get_multi_price",
    description: "Retourne les prix en USD de plusieurs tokens avec variation 24h",
    schema: z.object({
      tokens: z.string().optional().describe("Tokens séparés par virgule, ex: 'CELO,cUSD'"),
    }),
  }
)

// ─── Tool 3 : Swap CELO → stablecoin via Mento V2 ────────────────────────────
export const swapCeloTool = tool(
  async ({ amount, tokenOut }) => {
    try {
      const symbol = tokenOut.toUpperCase()
      const token = TOKENS[symbol]
      if (!token) return `Token ${symbol} non supporté. Disponibles : cUSD, cEUR, cREAL`

      const exchangeKey = `CELO-${symbol}`
      const exchangeId = EXCHANGE_IDS[exchangeKey]
      if (!exchangeId) return `Swap CELO→${symbol} non disponible via Mento V2`

      const parsed = parseEther(amount)

      const approveHash = await walletClient.writeContract({
        address: TOKENS.CELO.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BROKER, parsed],
      })
      console.log(`  ✅ Approve TX : ${approveHash}`)

      const hash = await walletClient.writeContract({
        address: BROKER,
        abi: BROKER_ABI,
        functionName: "swapIn",
        args: [BI_POOL_MANAGER, exchangeId, TOKENS.CELO.address, token.address, parsed, 0n],
      })

      return [
        `✅ Swap réussi ! ${amount} CELO → ${symbol}`,
        `TX : https://celoscan.io/tx/${hash}`,
      ].join("\n")
    } catch (e) {
      return `Erreur swap : ${e}`
    }
  },
  {
    name: "swap_celo",
    description: "Échange des CELO contre un stablecoin (cUSD, cEUR, cREAL) via Mento V2",
    schema: z.object({
      amount: z.string().describe("Montant CELO à échanger, ex : 1"),
      tokenOut: z.string().describe("Token de sortie : cUSD, cEUR ou cREAL"),
    }),
  }
)

// ─── Tool 4 : Envoyer CELO ────────────────────────────────────────────────────
export const sendCeloTool = tool(
  async ({ to, amount }) => {
    try {
      const hash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        value: parseEther(amount),
      })
      return `✅ Envoi réussi ! ${amount} CELO → ${to}\nTX : https://celoscan.io/tx/${hash}`
    } catch (e) {
      return `Erreur envoi : ${e}`
    }
  },
  {
    name: "send_celo",
    description: "Envoie des CELO à une adresse wallet",
    schema: z.object({
      to: z.string().describe("Adresse destinataire 0x..."),
      amount: z.string().describe("Montant en CELO, ex: 0.5"),
    }),
  }
)

// ─── Tool 5 : Position Aave ───────────────────────────────────────────────────
export const getAavePositionTool = tool(
  async ({ address }) => {
    try {
      const addr = (address || account.address) as `0x${string}`
      const data = await publicClient.readContract({
        address: AAVE_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "getUserAccountData",
        args: [addr],
      })
      const [collateral, debt, available, , , healthFactor] = data
      return [
        "📊 Position Aave sur Celo Mainnet :",
        `• Collateral    : $${formatUnits(collateral, 8)} USD`,
        `• Dette         : $${formatUnits(debt, 8)} USD`,
        `• Disponible    : $${formatUnits(available, 8)} USD`,
        `• Health Factor : ${formatUnits(healthFactor, 18)}`,
      ].join("\n")
    } catch (e) {
      return `Erreur lecture position Aave : ${e}`
    }
  },
  {
    name: "get_aave_position",
    description: "Vérifie la position DeFi sur Aave (collateral, dette, health factor)",
    schema: z.object({
      address: z.string().optional().describe("Adresse wallet 0x... (optionnel)"),
    }),
  }
)

// ─── Tool 6 : Épargne sur Aave ────────────────────────────────────────────────
export const saveCUSDTool = tool(
  async ({ amount }) => {
    try {
      const parsed = parseUnits(amount, 18)
      const approveHash = await walletClient.writeContract({
        address: TOKENS.cUSD.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [AAVE_POOL, parsed],
      })
      console.log(`  ✅ Approve TX : ${approveHash}`)
      const supplyHash = await walletClient.writeContract({
        address: AAVE_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "supply",
        args: [TOKENS.cUSD.address, parsed, account.address, 0],
      })
      return [
        `✅ ${amount} cUSD déposés sur Aave !`,
        `TX : https://celoscan.io/tx/${supplyHash}`,
        "Vous gagnez des intérêts automatiquement. 💰",
      ].join("\n")
    } catch (e) {
      return `Erreur dépôt Aave : ${e}`
    }
  },
  {
    name: "save_cusd",
    description: "Dépose des cUSD sur Aave pour générer des intérêts automatiquement",
    schema: z.object({
      amount: z.string().describe("Montant en cUSD, ex : 10"),
    }),
  }
)

// ─── Exports ──────────────────────────────────────────────────────────────────
export const swapCeloToCUSDTool = swapCeloTool
export const getBalanceTool = getPortfolioTool
export const getCeloPriceTool = getMultiPriceTool