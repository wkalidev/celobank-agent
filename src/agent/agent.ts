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

const DIRECT_RETURN_TOOLS = new Set([
  "swap_celo",
  "save_cusd",
  "send_celo",
  "get_celo_price",
  "get_multi_price",
  "get_portfolio",
  "get_balance",
  "get_aave_position",
])

const toolSchemas = [
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
      name: "get_celo_price",
      description: "Get CELO price in USD",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_portfolio",
      description: "Get token balances (CELO, cUSD, cEUR, cREAL, USDC, USDT) for an address",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_multi_price",
      description: "Get USD prices for tokens: CELO, cUSD, cEUR, cREAL, USDC, USDT",
      parameters: {
        type: "object",
        properties: { tokens: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "swap_celo",
      description: "Swap CELO to cUSD, cEUR or cREAL via Mento V2",
      parameters: {
        type: "object",
        properties: {
          amount:   { type: "string" },
          tokenOut: { type: "string", enum: ["cUSD", "cEUR", "cREAL"] },
        },
        required: ["amount", "tokenOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_aave_position",
      description: "Check Aave position: collateral, debt, health factor",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_cusd",
      description: "Deposit cUSD on Aave to earn yield",
      parameters: {
        type: "object",
        properties: { amount: { type: "string" } },
        required: ["amount"],
      },
    },
  },
]

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

function truncateResult(result: string, maxChars = 400): string {
  if (result.length <= maxChars) return result
  return result.slice(0, maxChars) + "\n...(truncated)"
}

export async function runAgent(input: string): Promise<string> {
  const messages: any[] = [
    {
      role: "system",
      content: `You are CeloBank, an AI bank on Celo Mainnet. Always use tools, never invent data. Reply in the user's language. Be warm and concise. Call each tool ONCE only.

IMPORTANT RULES:
- If the user wants to deposit on Aave but does NOT specify an amount, ask them how much they want to deposit BEFORE calling save_cusd.
- If the user wants to send CELO but does NOT specify an amount or recipient, ask for the missing info BEFORE calling send_celo.
- If the user wants to swap but does NOT specify an amount, ask how much BEFORE calling swap_celo.
- Never assume or invent amounts. Always confirm with the user first.`,
    },
    { role: "user", content: input },
  ]

  const calledToolsAcrossTurns = new Set<string>()

  for (let i = 0; i < 5; i++) {
    const data = await groqChat(messages)
    const msg  = data.choices?.[0]?.message

    if (!msg) {
      console.log("Raw Groq response:", JSON.stringify(data))
      return "Erreur de réponse"
    }

    if (!msg.tool_calls?.length) {
      return msg.content ?? "Erreur de réponse"
    }

    messages.push(msg)

    const seenCallIds = new Set<string>()

    for (const call of msg.tool_calls) {
      const toolName = call.function.name as keyof typeof tools

      if (seenCallIds.has(call.id)) {
        messages.push({ role: "tool", tool_call_id: call.id, content: "Duplicate call skipped." })
        continue
      }
      seenCallIds.add(call.id)

      if (calledToolsAcrossTurns.has(toolName)) {
        console.log(`  ⚠️ Tool ${toolName} already called in a previous turn, skip`)
        messages.push({ role: "tool", tool_call_id: call.id, content: "Already executed." })
        continue
      }
      calledToolsAcrossTurns.add(toolName)

      const rawArgs = call.function.arguments
      const args    = (rawArgs && rawArgs !== "null") ? (JSON.parse(rawArgs) ?? {}) : {}
      console.log(`  🔧 Tool: ${toolName}`, args)

      const result    = await (tools[toolName] as any).invoke(args)
      const resultStr = String(result)

      if (DIRECT_RETURN_TOOLS.has(toolName)) {
        return resultStr
      }

      messages.push({
        role:         "tool",
        tool_call_id: call.id,
        content:      truncateResult(resultStr),
      })
    }
  }

  return "Limite de tours atteinte"
}