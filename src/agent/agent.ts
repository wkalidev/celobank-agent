import "dotenv/config"
import { getBalanceTool, sendCeloTool, getCeloPriceTool } from "../tools/celo.js"
import { getAavePositionTool, saveCUSDTool, swapCeloToCUSDTool } from "../tools/defi.js"

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY!
const MODEL = "ministral-3:8b"
const BASE_URL = "https://ollama.com"

const tools = {
  get_celo_price: getCeloPriceTool,
  get_balance: getBalanceTool,
  send_celo: sendCeloTool,
  get_aave_position: getAavePositionTool,
  save_cusd: saveCUSDTool,
  swap_celo_to_cusd: swapCeloToCUSDTool,
}

const toolSchemas = [
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
      name: "get_balance",
      description: "Get CELO balance of a wallet address",
      parameters: {
        type: "object",
        properties: { address: { type: "string", description: "Wallet address 0x..." } },
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
          to: { type: "string", description: "Recipient address" },
          amount: { type: "string", description: "Amount in CELO" },
        },
        required: ["to", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_aave_position",
      description: "Check user DeFi position on Aave (collateral, debt, health factor)",
      parameters: {
        type: "object",
        properties: { address: { type: "string", description: "Wallet address 0x..." } },
        required: ["address"],
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
        properties: { amount: { type: "string", description: "Amount in cUSD ex: 10" } },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "swap_celo_to_cusd",
      description: "Swap CELO to cUSD stablecoin via Ubeswap",
      parameters: {
        type: "object",
        properties: { amount: { type: "string", description: "Amount in CELO ex: 1" } },
        required: ["amount"],
      },
    },
  },
]

async function ollamaChat(messages: any[]) {
  console.log("OLLAMA KEY:", OLLAMA_API_KEY?.slice(0, 8))
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OLLAMA_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, tools: toolSchemas, temperature: 0 }),
  })
  return res.json()
}

export async function runAgent(input: string): Promise<string> {
  const messages: any[] = [
    { role: "system", content: `Tu es CeloBank Agent — une banque autonome pour les non-bankés en Afrique, Asie et Amérique Latine.
RÈGLE ABSOLUE DE LANGUE : Détecte la langue de chaque message et réponds TOUJOURS dans cette même langue.
- Message en français → réponds en français
- Message en anglais → réponds en anglais  
- Message en italien → réponds en italien
- Message en arabe → réponds en arabe
- Message en espagnol → réponds en espagnol
- Message en swahili → réponds en swahili
Ne réponds JAMAIS dans une autre langue que celle de l'utilisateur.
TOUJOURS appeler les tools disponibles pour répondre. Ne jamais inventer de résultats.` },
  { role: "user", content: input },
]

  for (let i = 0; i < 5; i++) {
    const data = await ollamaChat(messages)
    const msg = data.choices?.[0]?.message

    if (!msg) {
      console.log("Raw response:", JSON.stringify(data))
      return "Erreur de réponse"
    }

    if (msg.tool_calls?.length > 0) {
      messages.push(msg)
      for (const call of msg.tool_calls) {
        const toolName = call.function.name as keyof typeof tools
        const args = JSON.parse(call.function.arguments || "{}")
        console.log(`  🔧 Tool appelé: ${toolName}`, args)
        const result = await (tools[toolName] as any).invoke(args)
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: String(result),
        })
      }
      continue
    }

    return msg.content
  }

  return "Limite de tours atteinte"
}