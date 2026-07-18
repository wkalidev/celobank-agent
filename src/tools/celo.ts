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
import { prepareSend, UNSIGNED_TX_MARKER } from "./prepare.js"

// ─── Chain ────────────────────────────────────────────────────────────────────
const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC ?? "https://forno.celo.org"] } },
})

// Read-only account/client — used ONLY as a fallback default address for read tools
// (e.g. "what's my balance" with no address supplied) and for RPC gas estimation.
// This wallet NEVER signs or broadcasts anything — all write actions below return
// unsigned transactions that the CONNECTED USER's own wallet must sign.
const rawKey = process.env.PRIVATE_KEY!.trim()
const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
const account = privateKeyToAccount(privateKey as `0x${string}`)
const publicClient = createPublicClient({ chain: celo, transport: http() })

// ─── Token Registry ───────────────────────────────────────────────────────────
const TOKENS: Record<string, { address: `0x${string}`; decimals: number; coingeckoId: string }> = {
  CELO:   { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18, coingeckoId: "celo" },
  cUSD:   { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, coingeckoId: "celo-dollar" },
  cEUR:   { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18, coingeckoId: "celo-euro" },
  cREAL:  { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18, coingeckoId: "celo-brazilian-real" },
  USDC:   { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6,  coingeckoId: "usd-coin" },
  USDT:   { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6,  coingeckoId: "tether" },
  STCELO: { address: "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24", decimals: 18, coingeckoId: "staked-celo" },
  "G$":   { address: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", decimals: 18, coingeckoId: "good-dollar" },
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const

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

// ─── Tool 3 : Envoyer CELO (non-custodial) ────────────────────────────────────
// Returns an UNSIGNED_TX_MARKER-prefixed JSON blob (a PrepareResult) instead of
// signing anything itself. server.ts detects the marker and hands the unsigned
// transaction to the frontend, which the connected user's own wallet signs.
// NEVER sign or broadcast here — the agent wallet must stay read-only.
export const sendCeloTool = tool(
  async ({ userAddress, to, amount, token }) => {
    try {
      const result = await prepareSend(userAddress, to, amount, token ?? "CELO")
      return UNSIGNED_TX_MARKER + JSON.stringify(result)
    } catch (e) {
      return `Erreur préparation envoi : ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "send_celo",
    description: "Prepare an unsigned transaction to send CELO or any registered token (cUSD, cEUR, USDC, ...) to an address. The connected user's wallet signs it — this tool never moves funds itself.",
    schema: z.object({
      userAddress: z.string().describe("The CONNECTED USER's wallet address 0x... (signer) — required"),
      to: z.string().describe("Adresse destinataire 0x..."),
      amount: z.string().describe("Montant à envoyer, ex: 0.5"),
      token: z.string().optional().describe("Symbole du token à envoyer (défaut: CELO). cUSD, cEUR, USDC, etc. sont envoyés via un transfert ERC20."),
    }),
  }
)

// ─── Tool 4 : Solde CELO natif uniquement ─────────────────────────────────────
// Distinct from get_portfolio (which returns CELO + all ERC20 tokens) — this is
// the lightweight single-value lookup its name/description promise.
export const getBalanceTool = tool(
  async ({ address }) => {
    try {
      const addr = (address || account.address) as `0x${string}`
      const nativeBalance = await publicClient.getBalance({ address: addr })
      return `${addr.slice(0, 6)}...${addr.slice(-4)}: ${parseFloat(formatEther(nativeBalance)).toFixed(4)} CELO`
    } catch (e) {
      return `Erreur lecture solde : ${e}`
    }
  },
  {
    name: "get_balance",
    description: "Get CELO native balance of an address (single value — use get_portfolio for all tokens)",
    schema: z.object({
      address: z.string().optional().describe("Adresse wallet 0x... (optionnel)"),
    }),
  }
)

// ─── Exports ──────────────────────────────────────────────────────────────────
export const getCeloPriceTool = getMultiPriceTool
