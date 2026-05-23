import "dotenv/config"
import { getBalanceTool, sendCeloTool, getCeloPriceTool } from "../tools/celo.js"
import {
  getAavePositionTool,
  saveCUSDTool,
  swapCeloTool,
  getPortfolioTool,
  getMultiPriceTool,
} from "../tools/defi.js"

const GROQ_API_KEY = process.env.GROQ_API_KEY!
const MODEL        = "llama-3.1-8b-instant"
const BASE_URL     = "https://api.groq.com/openai"

// ─── Tool registry ────────────────────────────────────────────────────────────
const tools = {
  get_balance:       getBalanceTool,
  send_celo:         sendCeloTool,
  get_celo_price:    getCeloPriceTool,
  get_portfolio:     getPortfolioTool,
  get_multi_price:   getMultiPriceTool,
  swap_celo:         swapCeloTool,
  get_aave_position: getAavePositionTool,
  save_cusd:         saveCUSDTool,
}

// ─── Tool schemas (OpenAI format) ─────────────────────────────────────────────
const toolSchemas = [
  {
    type: "function",
    function: {
      name: "get_balance",
      description: "Get native CELO balance of a wallet address",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Wallet address 0x..." },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_celo",
      description: "Send CELO to a wallet address",
      parameters: {
        type: "object",
        properties: {
          to:     { type: "string", description: "Recipient address 0x..." },
          amount: { type: "string", description: "Amount in CELO, ex: 0.5" },
        },
        required: ["to", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_celo_price",
      description: "Get current CELO price in USD",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_portfolio",
      description:
        "Show full wallet portfolio: balances of CELO, cUSD, cEUR, cREAL, USDC, USDT for an address",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Wallet address 0x... (optional, uses default wallet if omitted)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_multi_price",
      description:
        "Get real-time USD prices with 24h change for multiple tokens: CELO, cUSD, cEUR, cREAL, USDC, USDT",
      parameters: {
        type: "object",
        properties: {
          tokens: {
            type: "string",
            description:
              "Comma-separated token symbols, ex: 'CELO,cUSD,USDC'. Omit to get all prices.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "swap_celo",
      description:
        "Swap CELO for a stablecoin (cUSD, cEUR, cREAL) via Mento V2 on Celo Mainnet",
      parameters: {
        type: "object",
        properties: {
          amount:   { type: "string", description: "Amount of CELO to swap, ex: 1" },
          tokenOut: { type: "string", description: "Output token: cUSD, cEUR or cREAL" },
        },
        required: ["amount", "tokenOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_aave_position",
      description:
        "Check DeFi position on Aave Celo Mainnet: collateral, debt, available borrow, health factor",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Wallet address 0x... (optional)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_cusd",
      description: "Deposit cUSD on Aave to earn interest automatically",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "string", description: "Amount in cUSD, ex: 10" },
        },
        required: ["amount"],
      },
    },
  },
]

// ─── Groq chat (OpenAI-compatible) ────────────────────────────────────────────
async function groqChat(messages: any[]) {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, tools: toolSchemas, temperature: 0 }),
  })
  return res.json()
}

// ─── Agent loop ───────────────────────────────────────────────────────────────
export async function runAgent(input: string): Promise<string> {
  const messages: any[] = [
    {
      role: "system",
      content: `You are CeloBank Agent — an autonomous AI bank for the unbanked in Africa, Asia and Latin America.

You have access to these tools on Celo Mainnet:
- get_balance       : native CELO balance of any address
- send_celo         : send CELO to any address
- get_celo_price    : current CELO price in USD
- get_portfolio     : ALL token balances (CELO, cUSD, cEUR, cREAL, USDC, USDT) at once
- get_multi_price   : real-time prices + 24h change for all tokens
- swap_celo         : swap CELO → cUSD / cEUR / cREAL via Mento V2
- get_aave_position : DeFi position on Aave (collateral, debt, health factor)
- save_cusd         : deposit cUSD on Aave to earn yield

RULES:
1. ALWAYS call the appropriate tool — never invent data or prices.
2. Detect the user's language and ALWAYS respond in that same language (French→French, English→English, Arabic→Arabic, Spanish→Spanish, Swahili→Swahili, Italian→Italian).
3. When the user asks about "my balance" or "my portfolio", use get_portfolio.
4. When the user asks about prices of multiple tokens, use get_multi_price.
5. When the user says "swap", "exchange", "convert" CELO, use swap_celo.
6. Be warm, simple, and avoid technical jargon.`,
    },
    { role: "user", content: input },
  ]

  for (let i = 0; i < 5; i++) {
    const data = await groqChat(messages)
    const msg  = data.choices?.[0]?.message

    if (!msg) {
      console.log("Raw response:", JSON.stringify(data))
      return "Erreur de réponse"
    }

    if (msg.tool_calls?.length > 0) {
      messages.push(msg)
      for (const call of msg.tool_calls) {
        const toolName = call.function.name as keyof typeof tools
        const args     = JSON.parse(call.function.arguments || "{}")
        console.log(`  🔧 Tool appelé: ${toolName}`, args)
        const result = await (tools[toolName] as any).invoke(args)
        messages.push({
          role:         "tool",
          tool_call_id: call.id,
          content:      String(result),
        })
      }
      continue
    }

    return msg.content
  }

  return "Limite de tours atteinte"
}