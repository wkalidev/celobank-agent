import "dotenv/config"
import { getBalanceTool, sendCeloTool, getCeloPriceTool } from "../tools/celo.js"
import {
  getAavePositionTool,
  saveCUSDTool,
  swapCeloTool,
  swapTokensTool,
  getPortfolioTool,
  getMultiPriceTool,
} from "../tools/defi.js"
import {
  stakeCeloTool,
  unstakeCeloTool,
  getStakingPositionTool,
  getYieldOptionsTool,
} from "../tools/staking.js"
import {
  tradeIdeasTool,
  getMarketOverviewTool,
  getBridgeInfoTool,
  getDailyDropStatusTool,
} from "../tools/advanced.js"
import { launchTokenTool, getTokensTool, getTrendingTokensTool } from "../tools/launch.js"
import { checkGoodDollarTool, getEngagementRewardsTool } from "../tools/gooddollar.js"

const GROQ_API_KEY = process.env.GROQ_API_KEY!
const MODEL        = "llama-3.3-70b-versatile"
const BASE_URL     = "https://api.groq.com/openai"

const tools = {
  // ── Core ──────────────────────────────────────────────
  get_balance:          getBalanceTool,
  send_celo:            sendCeloTool,
  get_celo_price:       getCeloPriceTool,
  get_portfolio:        getPortfolioTool,
  get_multi_price:      getMultiPriceTool,
  // ── DeFi ──────────────────────────────────────────────
  swap_celo:            swapCeloTool,
  swap_tokens:          swapTokensTool,
  get_aave_position:    getAavePositionTool,
  save_cusd:            saveCUSDTool,
  // ── Staking ───────────────────────────────────────────
  stake_celo:           stakeCeloTool,
  unstake_celo:         unstakeCeloTool,
  get_staking_position: getStakingPositionTool,
  get_yield_options:    getYieldOptionsTool,
  // ── Advanced ──────────────────────────────────────────
  trade_ideas:          tradeIdeasTool,
  get_market_overview:  getMarketOverviewTool,
  get_bridge_info:      getBridgeInfoTool,
  get_dailydrop_status: getDailyDropStatusTool,
  // Token Launcher
  launch_token:         launchTokenTool,
  get_tokens:           getTokensTool,
  get_trending_tokens:  getTrendingTokensTool,
  // GoodDollar
  check_gooddollar:        checkGoodDollarTool,
  get_engagement_rewards:  getEngagementRewardsTool,
}

const DIRECT_RETURN_TOOLS = new Set([
  "swap_celo",
  "swap_tokens",
  "save_cusd",
  "send_celo",
  "get_celo_price",
  "get_multi_price",
  "get_portfolio",
  "get_balance",
  "get_aave_position",
  "stake_celo",
  "unstake_celo",
  "get_staking_position",
  "get_yield_options",
  "trade_ideas",
  "get_market_overview",
  "get_bridge_info",
  "get_dailydrop_status",
  "launch_token",
  "get_tokens",
  "get_trending_tokens",
  "check_gooddollar",
  "get_engagement_rewards",
])

const toolSchemas = [
  // ── Core ────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_balance",
      description: "Get CELO balance of an address",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_celo",
      description: "Send CELO to an address",
      parameters: {
        type: "object",
        properties: {
          to:     { type: "string" },
          amount: { type: "string" },
        },
        required: ["to", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_portfolio",
      description: "Get full portfolio: CELO + all token balances for an address",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_multi_price",
      description: "Get real-time prices for CELO and all Celo tokens with 24h change",
      parameters: { type: "object", properties: {} },
    },
  },
  // ── DeFi ────────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "swap_celo",
      description: "Swap CELO for a stablecoin (cUSD, cEUR, cREAL, USDC, USDT) via Mento V2",
      parameters: {
        type: "object",
        properties: {
          amount:   { type: "string", description: "Amount of CELO to swap" },
          tokenOut: { type: "string", description: "Target token: cUSD, cEUR, cREAL, USDC, USDT" },
        },
        required: ["amount", "tokenOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "swap_tokens",
      description: "Swap ANY token pair on Celo mainnet. Routes CELO↔stablecoins through Mento V2, all other pairs through Uniswap V3 (0.3% fee). Supports: CELO, cUSD/USDm, cEUR/EURm, cREAL/BRLm, KESm, NGNm, GHSm, XOFm, ZARm, GBPm, PHPm, COPm, CADm, AUDm, CHFm, JPYm, USDC, USDT, WETH, WBTC, stCELO, UBE, USDGLO, EURC.",
      parameters: {
        type: "object",
        properties: {
          amount:   { type: "string", description: "Amount of tokenIn to swap" },
          tokenIn:  { type: "string", description: "Source token symbol (default: CELO)" },
          tokenOut: { type: "string", description: "Destination token symbol" },
        },
        required: ["amount", "tokenOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_aave_position",
      description: "Get Aave V3 lending position: collateral, debt, health factor",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_cusd",
      description: "Supply cUSD to Aave V3 to earn yield (~3-5% APY)",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "string", description: "Amount of cUSD to supply" },
          asset:  { type: "string", description: "Asset to supply: cUSD (default), USDC" },
        },
        required: ["amount"],
      },
    },
  },
  // ── Staking ─────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "stake_celo",
      description: "Stake CELO to earn ~4% APY via Staked CELO (stCELO). Liquid, no lockup.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "string", description: "Amount of CELO to stake" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unstake_celo",
      description: "Unstake stCELO back to CELO. Unbonding period ~3 days.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "string", description: "Amount of stCELO to unstake" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_staking_position",
      description: "Get staking position: CELO + stCELO balance and APY",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_yield_options",
      description: "Get all yield options on Celo with APY, risk, and instructions",
      parameters: {
        type: "object",
        properties: {
          riskLevel: { type: "string", description: "Filter by risk: low, medium, very low" },
        },
      },
    },
  },
  // ── Advanced ────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "trade_ideas",
      description: "Analyze portfolio and generate personalized DeFi trade ideas and recommendations",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_market_overview",
      description: "Get real-time market overview for all Celo tokens with 24h price change",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bridge_info",
      description: "Get bridge options to move tokens to/from Celo network",
      parameters: {
        type: "object",
        properties: {
          from:  { type: "string" },
          to:    { type: "string" },
          token: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dailydrop_status",
      description: "Check DailyDrop streak status — check-in streak, badge, and reward eligibility",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
      },
    },
  },
  // Token Launcher
  {
    type: "function",
    function: {
      name: "launch_token",
      description: "Launch a new ERC20 token on Celo. Returns an unsigned transaction for the user to sign.",
      parameters: {
        type: "object",
        properties: {
          name:        { type: "string", description: "Full token name (e.g. 'My Token')" },
          symbol:      { type: "string", description: "Ticker symbol, max 11 chars (e.g. 'MTK')" },
          totalSupply: { type: "string", description: "Total token supply as a plain number (e.g. '1000000')" },
          userAddress: { type: "string", description: "Creator wallet address" },
        },
        required: ["name", "symbol", "totalSupply"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tokens",
      description: "List all ERC20 tokens launched via CeloBank Token Factory",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trending_tokens",
      description: "Get the 5 most recently launched tokens on CeloBank Token Factory",
      parameters: { type: "object", properties: {} },
    },
  },
  // GoodDollar
  {
    type: "function",
    function: {
      name: "check_gooddollar",
      description: "Check a wallet's G$ (GoodDollar) balance and human verification status on Celo. Shows verification status, expiry, and how to earn G$ rewards.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Wallet address to check" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_engagement_rewards",
      description: "Show CeloBank's GoodDollar engagement reward stats: total G$ distributed and users onboarded via referrals.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "App address to query (optional, defaults to CeloBank)" },
        },
      },
    },
  },
]

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are CeloBank Agent — an advanced autonomous DeFi assistant on Celo blockchain.

You can help users with:
- 💼 PORTFOLIO: Check balances, token holdings, net worth
- 💱 SWAP: Swap ANY token pair on Celo mainnet
    • CELO ↔ Mento stablecoins via Mento V2: cUSD/USDm, cEUR/EURm, cREAL/BRLm, KESm, NGNm, GHSm, XOFm, ZARm, GBPm, PHPm, COPm, CADm, AUDm, CHFm, JPYm
    • All other pairs via Uniswap V3 (0.3%): USDC, USDT, WETH, WBTC, stCELO, UBE, USDGLO, EURC + more
    • Use swap_tokens for universal routing; use swap_celo for legacy CELO→stablecoin
- 🔒 STAKING: Stake CELO for ~4% APY via Staked CELO (stCELO)
- 📈 AAVE: Supply cUSD/USDC to Aave V3 for yield (~3-5% APY)
- 💡 TRADE IDEAS: Personalized portfolio analysis and DeFi recommendations
- 📊 MARKET: Real-time prices and market overview for all Celo tokens
- 🌉 BRIDGE: Info on how to move tokens between chains to/from Celo
- 🔥 DAILYDROP: Check streak status and Proof of Presence badge
- 🚀 TOKEN LAUNCHER: Deploy a new ERC20 token on Celo in one transaction; browse all launched tokens
- 🌱 GOODDOLLAR: Check G$ balance, human verification status, and referral engagement rewards

Always:
- Be concise and actionable
- Show transaction hashes and explorer links when available
- Suggest the next best action after completing one
- Detect language and respond accordingly
- For any swap request, prefer swap_tokens over swap_celo as it supports all pairs

You support: English, French, Spanish, Portuguese, Swahili, Arabic, Italian, Chinese.`

// ─── Run Agent ────────────────────────────────────────────────────────────────
export async function runAgent(userMessage: string): Promise<string> {
  const messages: { role: string; content: string; tool_call_id?: string; name?: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user",   content: userMessage },
  ]

  for (let i = 0; i < 5; i++) {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       MODEL,
        messages,
        tools:       toolSchemas,
        tool_choice: "auto",
      }),
    })

    const data = await response.json()
    const msg  = data.choices?.[0]?.message

    if (!msg) return "❌ No response from AI model."

    // No tool call → return text directly
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? "✅ Done."
    }

    // Process tool calls
    messages.push({ role: "assistant", content: JSON.stringify(msg) })

    for (const call of msg.tool_calls) {
      const toolName = call.function.name
      const toolArgs = JSON.parse(call.function.arguments ?? "{}")
      const toolFn   = (tools as Record<string, { invoke: (args: unknown) => Promise<string> }>)[toolName]

      let result = "❌ Tool not found."
      if (toolFn) {
        result = await toolFn.invoke(toolArgs)
      }

      // Direct return for action tools
      if (DIRECT_RETURN_TOOLS.has(toolName)) {
        return result
      }

      messages.push({
        role:        "tool",
        content:     result,
        tool_call_id: call.id,
        name:        toolName,
      })
    }
  }

  return "❌ Agent loop limit reached."
}