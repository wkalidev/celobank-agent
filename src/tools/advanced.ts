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

// ─── Token Registry ───────────────────────────────────────────────────────────
const TOKENS: Record<string, { address: `0x${string}`; decimals: number; coingeckoId: string }> = {
  CELO:  { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18, coingeckoId: "celo" },
  cUSD:  { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, coingeckoId: "celo-dollar" },
  cEUR:  { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18, coingeckoId: "celo-euro" },
  USDC:  { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6,  coingeckoId: "usd-coin" },
  USDT:  { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6,  coingeckoId: "tether" },
  stCELO: { address: "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24", decimals: 18, coingeckoId: "staked-celo" },
}

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const

// ─── Fetch prices from CoinGecko ──────────────────────────────────────────────
async function fetchPrices(): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  try {
    const ids = Object.values(TOKENS).map(t => t.coingeckoId).join(",")
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
    const res = await fetch(url)
    return await res.json()
  } catch {
    return {}
  }
}

// ─── Tool: Trade Ideas ────────────────────────────────────────────────────────
export const tradeIdeasTool = tool(
  async ({ address }: { address?: string }) => {
    try {
      const addr = (address ?? account.address) as `0x${string}`

      // Fetch portfolio + prices in parallel
      const [celoBalance, prices] = await Promise.all([
        publicClient.getBalance({ address: addr }),
        fetchPrices(),
      ])

      // Get token balances
      const tokenBalances: Record<string, number> = {}
      for (const [symbol, token] of Object.entries(TOKENS)) {
        if (symbol === "stCELO") continue
        try {
          const bal = await publicClient.readContract({
            address: token.address,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [addr],
          })
          tokenBalances[symbol] = parseFloat(formatUnits(bal, token.decimals))
        } catch {
          tokenBalances[symbol] = 0
        }
      }

      const celoBal    = parseFloat(formatEther(celoBalance))
      const celoPrice  = prices["celo"]?.usd ?? 0
      const celoChange = prices["celo"]?.usd_24h_change ?? 0
      const totalUSD   = celoBal * celoPrice + (tokenBalances["cUSD"] ?? 0) + (tokenBalances["USDC"] ?? 0)

      // ─── Generate trade ideas based on portfolio ───────────────────────────
      const ideas: string[] = []

      // Idea 1: Too much idle CELO → suggest staking
      if (celoBal > 10) {
        ideas.push(`🔒 STAKE ${Math.floor(celoBal * 0.5)} CELO → stCELO
   You have ${celoBal.toFixed(2)} CELO idle. Stake 50% to earn ~4% APY while keeping liquidity.
   Command: stake_celo amount="${Math.floor(celoBal * 0.5)}"`)
      }

      // Idea 2: No stablecoin → suggest converting some CELO
      if ((tokenBalances["cUSD"] ?? 0) < 5 && celoBal > 5) {
        ideas.push(`💵 SWAP ${Math.floor(celoBal * 0.2)} CELO → cUSD
   You have very little stablecoin. Convert 20% of CELO to cUSD to reduce volatility risk.
   Command: swap_celo amount="${Math.floor(celoBal * 0.2)}" tokenOut="cUSD"`)
      }

      // Idea 3: Has cUSD → suggest Aave
      if ((tokenBalances["cUSD"] ?? 0) > 10) {
        ideas.push(`📈 SAVE ${Math.floor(tokenBalances["cUSD"] ?? 0)} cUSD → Aave V3
   Your cUSD is sitting idle. Put it to work earning ~3-5% APY on Aave V3.
   Command: save_cusd amount="${Math.floor(tokenBalances["cUSD"] ?? 0)}"`)
      }

      // Idea 4: Market momentum
      if (celoChange > 3) {
        ideas.push(`🚀 BULLISH SIGNAL: CELO is up ${celoChange.toFixed(1)}% in 24h
   Consider reducing stablecoin exposure and holding more CELO if you're bullish.`)
      } else if (celoChange < -3) {
        ideas.push(`🛡️ DIP ALERT: CELO is down ${Math.abs(celoChange).toFixed(1)}% in 24h
   Consider DCA: swap some cUSD → CELO at this lower price if you're long-term bullish.
   Command: swap_celo amount="5" tokenOut="CELO" (via Mento — buy cUSD first)`)
      }

      // Idea 5: Portfolio diversification
      if (totalUSD > 50 && (tokenBalances["cEUR"] ?? 0) < 1) {
        ideas.push(`🌍 DIVERSIFY into cEUR
   Your portfolio is all USD. Consider 10% in cEUR for EUR exposure and Mento yield.
   Command: swap_celo amount="5" tokenOut="cEUR"`)
      }

      if (ideas.length === 0) {
        ideas.push(`✅ Your portfolio looks balanced! No urgent actions needed.
   Keep stacking and check back tomorrow.`)
      }

      return `💡 Trade Ideas for ${addr}:
📊 Portfolio Snapshot:
> CELO: ${celoBal.toFixed(4)} ($${(celoBal * celoPrice).toFixed(2)}) | 24h: ${celoChange > 0 ? "+" : ""}${celoChange.toFixed(1)}%
> cUSD: ${(tokenBalances["cUSD"] ?? 0).toFixed(2)} | USDC: ${(tokenBalances["USDC"] ?? 0).toFixed(2)}
> Total: ~$${totalUSD.toFixed(2)}

🎯 Recommended Actions:
${ideas.map((idea, i) => `${i + 1}. ${idea}`).join("\n\n")}`
    } catch (e: unknown) {
      return `❌ Failed to generate trade ideas: ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "trade_ideas",
    description: "Analyze portfolio and generate personalized DeFi trade ideas and recommendations for Celo.",
    schema: z.object({
      address: z.string().optional().describe("Wallet address to analyze (optional)"),
    }),
  }
)

// ─── Tool: Market Overview ────────────────────────────────────────────────────
export const getMarketOverviewTool = tool(
  async () => {
    try {
      const prices = await fetchPrices()

      let result = `📈 Celo Market Overview:\n\n`

      for (const [symbol, token] of Object.entries(TOKENS)) {
        const data = prices[token.coingeckoId]
        if (!data) continue
        const change = data.usd_24h_change ?? 0
        const arrow  = change > 0 ? "▲" : change < 0 ? "▼" : "─"
        const sign   = change > 0 ? "+" : ""
        result += `${symbol.padEnd(8)} $${data.usd.toFixed(6).padEnd(12)} ${arrow} ${sign}${change.toFixed(2)}% 24h\n`
      }

      result += `\n🔗 Trade on: https://app.mento.org | https://ubeswap.org`
      return result
    } catch (e: unknown) {
      return `❌ Failed to get market data: ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "get_market_overview",
    description: "Get real-time price overview for all Celo tokens with 24h change.",
    schema: z.object({}),
  }
)

// ─── Tool: Bridge Info ────────────────────────────────────────────────────────
export const getBridgeInfoTool = tool(
  async ({ from, to, token }: { from?: string; to?: string; token?: string }) => {
    const bridges = [
      {
        name: "Squid Router",
        url: "https://app.squidrouter.com",
        routes: ["Ethereum → Celo", "Base → Celo", "Polygon → Celo", "Arbitrum → Celo"],
        tokens: ["USDC", "USDT", "ETH", "CELO"],
        time: "~2-5 min",
        fee: "~0.1-0.5%",
      },
      {
        name: "Jumper Exchange",
        url: "https://jumper.exchange",
        routes: ["Any EVM → Celo"],
        tokens: ["USDC", "USDT", "ETH", "MATIC", "AVAX"],
        time: "~1-10 min",
        fee: "~0.1-1%",
      },
      {
        name: "Mento",
        url: "https://app.mento.org",
        routes: ["Celo internal swaps only"],
        tokens: ["CELO", "cUSD", "cEUR", "cREAL", "USDC"],
        time: "~instant",
        fee: "~0.25%",
      },
      {
        name: "Wormhole",
        url: "https://portalbridge.com",
        routes: ["Ethereum → Celo", "Solana → Celo"],
        tokens: ["USDC", "ETH", "SOL"],
        time: "~15 min",
        fee: "~$2-5 flat",
      },
    ]

    let result = `🌉 Bridge Options to/from Celo:\n\n`

    bridges.forEach(bridge => {
      result += `${bridge.name}
> URL: ${bridge.url}
> Routes: ${bridge.routes.join(", ")}
> Tokens: ${bridge.tokens.join(", ")}
> Time: ${bridge.time} | Fee: ${bridge.fee}\n\n`
    })

    result += `💡 Recommendation:
> Fast & cheap: Squid Router or Jumper Exchange
> Stablecoins: Squid Router (best rates for USDC)
> Internal Celo: Mento (instant, lowest fee)`

    return result
  },
  {
    name: "get_bridge_info",
    description: "Get information about bridges to/from Celo network — how to move tokens between chains.",
    schema: z.object({
      from: z.string().optional().describe("Source chain (e.g. 'Base', 'Ethereum')"),
      to: z.string().optional().describe("Destination chain"),
      token: z.string().optional().describe("Token to bridge"),
    }),
  }
)

// ─── Tool: DailyDrop Check-in Status ─────────────────────────────────────────
export const getDailyDropStatusTool = tool(
  async ({ address }: { address?: string }) => {
    try {
      const addr = (address ?? account.address) as `0x${string}`
      const url  = `https://dailydrop-five.vercel.app/api/verify?address=${addr}&minStreak=1`
      const res  = await fetch(url)
      const data = await res.json()

      const streak     = data.streak?.current ?? 0
      const canCheckIn = data.checkins?.canCheckIn ?? false
      const canClaim   = data.checkins?.canClaim ?? false
      const total      = data.checkins?.total ?? 0
      const badge      = data.badges?.label ?? "none"
      const nextCheckIn = data.checkins?.nextCheckIn
        ? new Date(data.checkins.nextCheckIn * 1000).toLocaleTimeString()
        : "now"

      return `🔥 DailyDrop Status for ${addr}:
> Current Streak: ${streak} day${streak !== 1 ? "s" : ""}
> Badge: ${badge}
> Total Check-ins: ${total}
> Can Check-in: ${canCheckIn ? "✅ Yes — go to dailydrop-five.vercel.app" : `❌ No — next at ${nextCheckIn}`}
> Can Claim DROP: ${canClaim ? "✅ Yes! Claim 10 DROP tokens now" : `❌ Need ${7 - streak} more days`}
> Proof of Presence: https://dailydrop-five.vercel.app/api/verify?address=${addr}`
    } catch (e: unknown) {
      return `❌ Failed to get DailyDrop status: ${e instanceof Error ? e.message : String(e)}`
    }
  },
  {
    name: "get_dailydrop_status",
    description: "Check DailyDrop streak status — how many days checked in, can claim reward, badge level.",
    schema: z.object({
      address: z.string().optional().describe("Wallet address to check"),
    }),
  }
)