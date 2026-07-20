import "dotenv/config"
import express from "express"
import cors from "cors"
import { rateLimit } from "express-rate-limit"
import { fileURLToPath } from "url"
import { join, dirname } from "path"
import { existsSync } from "fs"
import { runAgent, toolRegistry } from "./agent/agent.js"
import { privateKeyToAccount } from "viem/accounts"
import { verifyMessage } from "viem"
import { prepareSwap, prepareSupplyAave, prepareSend, prepareStake, prepareUnstake, prepareCompleteUnstake, prepareClaimUnstake, UNSIGNED_TX_MARKER } from "./tools/prepare.js"
import type { PrepareResult } from "./tools/prepare.js"
import { prepareLaunchToken, getTokens, getTrendingTokens } from "./tools/launch.js"
import { getSelfAgentStatus, initiateRegistration } from "./lib/self-agent-id.js"
import { tagTransactions } from "./lib/attribution.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const app = express()

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://celobank-agent.vercel.app",
  "https://celobank-agent-git-main.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
]

app.use(cors({
  origin: (origin, cb) => {
    // Non-browser clients (curl, Node SDKs, mobile) don't send Origin — allow them
    if (!origin) return cb(null, true)
    // Browser requests must come from a known origin
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error("Not allowed by CORS"))
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-PAYMENT", "X-PAYMENT-RECEIPT", "Idempotency-Key"],
  exposedHeaders: ["X-PAYMENT-RECEIPT"],
  credentials: false,
}))

app.set("trust proxy", 1)
app.disable("x-powered-by")

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  next()
})

app.use(express.json({ limit: "64kb" }))

// ─── Rate limiting ────────────────────────────────────────────────────────────
const chatLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
})

const prepareLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
})

// Endpoints that call runAgent (LLM) — same budget as chat
const agentReadLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
})

// Endpoints that proxy external APIs (CoinGecko, token list)
const externalReadLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
})

// ─── Input validation helpers ─────────────────────────────────────────────────
function isValidAddress(addr: unknown): addr is string {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr)
}

function isValidAmount(amount: unknown): boolean {
  if (typeof amount !== "string") return false
  if (!/^\d+(\.\d+)?$/.test(amount)) return false   // strict: digits and optional decimal only
  const n = parseFloat(amount)
  return !isNaN(n) && n > 0 && isFinite(n)
}

function safeError(e: unknown): string {
  // Log full error server-side, return generic message to client
  console.error("Internal error:", e instanceof Error ? e.message : String(e))
  if (e instanceof Error && (
    e.message.includes("Token") ||
    e.message.includes("token") ||
    e.message.includes("required") ||
    e.message.includes("supply") ||
    e.message.includes("symbol")
  )) {
    return e.message  // safe validation messages
  }
  return "Internal server error"
}

const account = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`)
const AGENT_ADDRESS = account.address

// If a write tool prepared an unsigned transaction (marked by UNSIGNED_TX_MARKER,
// see tools/prepare.ts), extract it so the frontend can route it through the same
// wallet-signing flow used by /api/v1/prepare — instead of dumping raw JSON as chat
// text, or worse, silently doing nothing useful.
function extractUnsignedTx(agentResponse: string): PrepareResult | null {
  if (!agentResponse.startsWith(UNSIGNED_TX_MARKER)) return null
  try {
    return JSON.parse(agentResponse.slice(UNSIGNED_TX_MARKER.length)) as PrepareResult
  } catch (e) {
    console.error("[chat] Failed to parse unsigned tx payload:", e instanceof Error ? e.message : e)
    return null
  }
}

// ─── x402 payment infrastructure ──────────────────────────────────────────────
const CUSD_ADDRESS     = "0x765DE816845861e75A25fCA122bb6898B8B1282a"
const PAYMENT_WEI      = "1000000000000000" // 0.001 cUSD at 18 decimals
const X402_FACILITATOR = "https://x402.org/facilitator"
const AGENT_BASE_URL   = "https://celobank-agent-production.up.railway.app"

const WRITE_TOOL_NAMES = new Set([
  "send_celo", "swap_celo", "swap_tokens", "save_cusd",
  "stake_celo", "unstake_celo", "continue_unstake", "claim_unstake", "launch_token",
])

function paymentRequired402(toolName: string) {
  return {
    x402Version: 1,
    error:       "Payment Required",
    accepts: [{
      scheme:            "exact",
      chainId:           42220,
      asset:             CUSD_ADDRESS,
      maxAmountRequired: PAYMENT_WEI,
      payTo:             AGENT_ADDRESS,
      description:       `CeloBank Agent write tool: ${toolName} (0.001 cUSD)`,
      resource:          `${AGENT_BASE_URL}/mcp`,
      maxTimeoutSeconds: 300,
    }],
    catalog: `${AGENT_BASE_URL}/catalog`,
  }
}

async function verifyX402Payment(
  paymentHeader: string
): Promise<{ valid: boolean; receipt?: unknown; reason?: string }> {
  try {
    const res = await fetch(`${X402_FACILITATOR}/verify`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment:  paymentHeader,
        resource: `${AGENT_BASE_URL}/mcp`,
        amount:   PAYMENT_WEI,
        asset:    CUSD_ADDRESS,
        chainId:  42220,
        payTo:    AGENT_ADDRESS,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error("[x402] Facilitator HTTP error:", res.status)
      return { valid: false, reason: "Payment facilitator unreachable" }
    }
    const data = await res.json() as { isValid?: boolean; invalidReason?: string; receipt?: unknown }
    if (!data.isValid) return { valid: false, reason: data.invalidReason ?? "Invalid payment" }
    return { valid: true, receipt: data.receipt }
  } catch (e) {
    console.error("[x402] Verify failed:", e instanceof Error ? e.message : e)
    return { valid: false, reason: "Payment verification unavailable" }
  }
}

async function settleX402Payment(paymentHeader: string): Promise<{ txHash?: string }> {
  try {
    const res = await fetch(`${X402_FACILITATOR}/settle`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment:  paymentHeader,
        resource: `${AGENT_BASE_URL}/mcp`,
        amount:   PAYMENT_WEI,
        asset:    CUSD_ADDRESS,
        chainId:  42220,
        payTo:    AGENT_ADDRESS,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) { console.error("[x402] Settle HTTP error:", res.status); return {} }
    const data = await res.json() as { txHash?: string }
    if (data.txHash) console.log("[x402] Settled:", data.txHash)
    return data
  } catch (e) {
    console.error("[x402] Settle failed:", e instanceof Error ? e.message : e)
    return {}
  }
}

// ─── Language Detection ───────────────────────────────────────────────────────
function detectLanguage(text: string): string {
  const t = text.toLowerCase()
  // Non-Latin unicode scripts — unambiguous, checked first
  if (/[ऀ-ॿ]/.test(t)) return "hindi"
  if (/[ঀ-৿]/.test(t)) return "bengali"
  if (/[ሀ-፿]/.test(t)) return "amharic"
  if (/[Ѐ-ӿ]/.test(t)) return "russian"
  if (/[一-鿿㐀-䶿]/.test(t)) return "chinese"
  if (/[؀-ۿ]/.test(t)) return "arabic"
  // Latin with script-unique diacritics (checked before French to avoid ã/ä collisions)
  if (/[ơưđ]/.test(t) || /\b(không|của|với|được|những|tôi|bạn)\b/.test(t)) return "vietnamese"
  if (/[ẹọṣ]/.test(t)) return "yoruba"
  if (/[ãõ]/.test(t) || /\b(você|obrigado|não|isso|meu|minha|nossa|olá|quanto)\b/.test(t)) return "portuguese"
  if (/ß/.test(t) || (/[äöü]/.test(t) && /\b(ich|nicht|sind|haben|wird|für|das|der|die|mit|wie|was|bitte|danke|kein|oder|auch|aber)\b/.test(t))) return "german"
  // Existing Latin-script checks — unchanged
  if (/[àâäéèêëîïôùûüç]/.test(t) || /\b(je|tu|il|nous|vous|ils|est|les|des|une|pour|avec|sur|mon|ma|mes|solde|envoie|quel|quelle)\b/.test(t)) return "french"
  if (/\b(io|tu|lui|noi|voi|loro|sono|buona|sera|grazie|prego|mio|mia)\b/.test(t)) return "italian"
  if (/\b(yo|tú|él|nosotros|es|los|las|una|para|con|hola|gracias|mi|saldo)\b/.test(t)) return "spanish"
  if (/\b(mimi|wewe|yeye|sisi|ninyi|wao|habari|asante|karibu)\b/.test(t)) return "swahili"
  // New Latin-script vocabulary checks
  if (/[şğ]/.test(t) || /\b(için|değil|evet|hayır|teşekkür|nasıl|merhaba)\b/.test(t)) return "turkish"
  if (/\b(saya|anda|tidak|dengan|untuk|yang|ini|itu|bisa|juga|sudah|akan|selamat|terima|berapa)\b/.test(t)) return "indonesian"
  if (/\b(ako|ikaw|siya|kami|kayo|sila|mga|nang|salamat|kamusta|paano|bakit|talaga)\b/.test(t)) return "tagalog"
  if (/\b(yana|tana|suna|kuma|amma|babu|cikin|sannan|yaya|lafiya)\b/.test(t)) return "hausa"
  return "english"
}

const langInstructions: Record<string, string> = {
  french:     "Réponds en français.",
  italian:    "Rispondi in italiano.",
  spanish:    "Responde en español.",
  arabic:     "أجب باللغة العربية.",
  swahili:    "Jibu kwa Kiswahili.",
  english:    "Respond in English.",
  portuguese: "Responda em português.",
  chinese:    "请用中文回答。",
  hindi:      "कृपया हिंदी में जवाब दें।",
  bengali:    "অনুগ্রহ করে বাংলায় উত্তর দিন।",
  yoruba:     "Jọwọ dáhùn ní èdè Yorùbá.",
  hausa:      "Don Allah amsa da Hausa.",
  amharic:    "እባክዎ በአማርኛ ይመልሱ።",
  indonesian: "Tolong jawab dalam Bahasa Indonesia.",
  german:     "Bitte antworte auf Deutsch.",
  russian:    "Пожалуйста, отвечай по-русски.",
  turkish:    "Lütfen Türkçe yanıtla.",
  vietnamese: "Vui lòng trả lời bằng tiếng Việt.",
  tagalog:    "Mangyaring sumagot sa Filipino.",
}

// ─── Swagger UI ───────────────────────────────────────────────────────────────
const swaggerHTML = `<!DOCTYPE html>
<html>
<head>
  <title>CeloBank Agent API</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body { margin: 0; padding: 0; } .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/api/v1/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true
    })
  </script>
</body>
</html>`

// ─── OpenAPI Spec ─────────────────────────────────────────────────────────────
const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "CeloBank Agent API",
    version: "2.0.0",
    description: `## Open infrastructure for autonomous DeFi agents on Celo

This API exposes the \`@celobank/agent-sdk\` as a REST interface.
Any developer can call these endpoints to integrate DeFi capabilities on Celo into their own app or agent.

**npm SDK**: \`npm install @celobank/agent-sdk\`
**GitHub**: https://github.com/wkalidev/celobank-agent
**Network**: Celo Mainnet (Chain ID: 42220)

## Non-Custodial Mode (v2)
Use \`POST /api/v1/prepare\` to get unsigned transactions that the user signs with their own wallet.
This is the recommended approach — the agent never holds user funds.
    `,
    contact: { name: "wkalidev", url: "https://github.com/wkalidev/celobank-agent" },
    license: { name: "MIT" },
  },
  servers: [
    { url: "https://celobank-agent-production.up.railway.app", description: "Production (Celo Mainnet)" },
    { url: "http://localhost:3000", description: "Local development" },
  ],
  tags: [
    { name: "Agent",     description: "Natural language agent" },
    { name: "Prepare",   description: "Non-custodial transaction preparation" },
    { name: "Wallet",    description: "Portfolio & balance reads" },
    { name: "Prices",    description: "Real-time token prices" },
    { name: "Tokens",    description: "Token registry" },
    { name: "DeFi",      description: "Aave V3 positions" },
    { name: "System",    description: "Health & status" },
  ],
  paths: {
    "/api/v1/chat": {
      post: {
        tags: ["Agent"],
        summary: "Send a message to the agent",
        description: "The agent understands natural language in 19 languages and executes DeFi actions on Celo Mainnet. Rate limited to 20 req/min.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  message:     { type: "string", example: "What is the current CELO price?" },
                  userAddress: { type: "string", example: "0xDEAc...", description: "User wallet address (optional)" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Agent response", content: { "application/json": { schema: { type: "object", properties: { response: { type: "string" }, language: { type: "string" } } } } } },
          400: { description: "Bad request" },
          429: { description: "Rate limit exceeded" },
        },
      },
    },
    "/api/v1/prepare": {
      post: {
        tags: ["Prepare"],
        summary: "Prepare unsigned transactions (non-custodial)",
        description: "Prepares DeFi transactions without signing them. Rate limited to 30 req/min.\n\n**Supported actions**: swap, supply_aave, send, stake, unstake, continue_unstake, claim_unstake, launch_token, get_tokens, get_trending",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action", "userAddress", "params"],
                properties: {
                  action:      { type: "string", enum: ["swap", "supply_aave", "send", "stake", "unstake", "continue_unstake", "claim_unstake", "launch_token", "get_tokens", "get_trending"], example: "swap" },
                  userAddress: { type: "string", example: "0xDEAc..." },
                  params:      { type: "object", description: "Action-specific parameters", example: { amount: "10", tokenOut: "cUSD" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Unsigned transactions ready to sign" },
          400: { description: "Invalid input" },
          429: { description: "Rate limit exceeded" },
        },
      },
    },
    "/api/v1/portfolio/{address}": {
      get: {
        tags: ["Wallet"],
        summary: "Get full wallet portfolio",
        parameters: [{ name: "address", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Portfolio balances" } },
      },
    },
    "/api/v1/prices": {
      get: {
        tags: ["Prices"],
        summary: "Get real-time token prices",
        parameters: [{ name: "tokens", in: "query", schema: { type: "string" }, example: "CELO,cUSD,USDC" }],
        responses: { 200: { description: "Token prices with 24h change" } },
      },
    },
    "/api/v1/tokens": {
      get: {
        tags: ["Tokens"],
        summary: "List all verified Celo tokens",
        description: "Returns all tokens from the official Celo token list (chainId 42220).",
        responses: { 200: { description: "Token list with addresses and decimals" } },
      },
    },
    "/api/v1/aave/{address}": {
      get: {
        tags: ["DeFi"],
        summary: "Get Aave V3 position",
        parameters: [{ name: "address", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Aave position data" } },
      },
    },
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: { 200: { description: "API is healthy" } },
      },
    },
    "/mcp": {
      post: {
        tags: ["System"],
        summary: "MCP JSON-RPC endpoint",
        description: "Model Context Protocol endpoint (protocol 2024-11-05). Read tools are free. Write tools require `X-PAYMENT` header (0.001 cUSD each). See GET /catalog for full x402 payment schema.",
        security: [{ x402Payment: [] }],
        responses: {
          200: { description: "JSON-RPC response" },
          402: { description: "Payment Required — send X-PAYMENT header with 0.001 cUSD in cUSD on Celo" },
        },
      },
    },
    "/catalog": {
      get: {
        tags: ["System"],
        summary: "x402 machine-readable service catalog",
        description: "Lists all 24 tools with pricing, payment schema, and x402 facilitator details.",
        responses: { 200: { description: "x402 catalog" } },
      },
    },
  },
  components: {
    securitySchemes: {
      x402Payment: {
        type:        "apiKey",
        in:          "header",
        name:        "X-PAYMENT",
        description: "x402 micropayment header — required for write tools via POST /mcp. 0.001 cUSD per write tool call on Celo Mainnet (chain 42220). See GET /catalog for full payment schema and facilitator details.",
      },
    },
  },
  security: [],
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/",              (_, res) => res.send(swaggerHTML))
app.get("/docs",          (_, res) => res.send(swaggerHTML))
app.get("/api/v1/openapi.json",      (_, res) => res.json(openApiSpec))
app.get("/.well-known/openapi.json", (_, res) => res.json(openApiSpec))

// ─── POST /api/v1/chat ────────────────────────────────────────────────────────
app.post("/api/v1/chat", chatLimit, async (req, res) => {
  const { message, userAddress } = req.body

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "message is required and must be a non-empty string" })
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "message must be 2000 characters or fewer" })
  }
  if (userAddress && !isValidAddress(userAddress)) {
    return res.status(400).json({ error: "userAddress must be a valid Ethereum address" })
  }

  try {
    const lang            = detectLanguage(message)
    const langHint        = langInstructions[lang]
    const walletAddress   = isValidAddress(userAddress) ? userAddress : AGENT_ADDRESS
    const enrichedMessage = `${langHint} ${message}. User wallet address: ${walletAddress}.`

    console.log(`👤 [${lang}] [${walletAddress.slice(0, 8)}...]: ${message.slice(0, 80)}`)
    const response = await runAgent(enrichedMessage)
    console.log(`🤖 Agent response sent (${response.length} chars)`)

    // If the model called a write tool, response is a JSON-encoded PrepareResult
    // (unsigned transactions) rather than natural-language text — surface it as
    // such so the frontend can execute it through the wallet-signing flow.
    const prepared = extractUnsignedTx(response)
    if (prepared) {
      if (!prepared.success) {
        return res.json({ response: `❌ ${prepared.error ?? "Preparation failed"}`, language: lang })
      }
      return res.json({
        response:     prepared.summary,
        language:     lang,
        unsigned:     true,
        action:       prepared.action,
        userAddress:  prepared.userAddress,
        transactions: prepared.transactions,
      })
    }

    res.json({ response, language: lang })
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// Backward-compat alias
app.post("/chat", chatLimit, async (req, res) => {
  const { message, userAddress } = req.body
  if (!message || typeof message !== "string" || message.trim().length === 0) return res.status(400).json({ error: "Message requis" })
  if (message.length > 2000) return res.status(400).json({ error: "message must be 2000 characters or fewer" })
  if (userAddress && !isValidAddress(userAddress)) return res.status(400).json({ error: "Invalid address" })

  try {
    const lang            = detectLanguage(message)
    const langHint        = langInstructions[lang]
    const walletAddress   = isValidAddress(userAddress) ? userAddress : AGENT_ADDRESS
    const enrichedMessage = `${langHint} ${message}. User wallet address: ${walletAddress}.`
    const response        = await runAgent(enrichedMessage)

    const prepared = extractUnsignedTx(response)
    if (prepared) {
      if (!prepared.success) return res.json({ response: `❌ ${prepared.error ?? "Preparation failed"}` })
      return res.json({
        response:     prepared.summary,
        unsigned:     true,
        action:       prepared.action,
        userAddress:  prepared.userAddress,
        transactions: prepared.transactions,
      })
    }

    res.json({ response })
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// ─── POST /api/v1/prepare ─────────────────────────────────────────────────────
app.post("/api/v1/prepare", prepareLimit, async (req, res) => {
  const { action, userAddress, params } = req.body

  if (!isValidAddress(userAddress)) {
    return res.status(400).json({ error: "userAddress must be a valid Ethereum address (0x...)" })
  }
  if (!action || typeof action !== "string") {
    return res.status(400).json({ error: "action is required" })
  }
  if (!params || typeof params !== "object") {
    return res.status(400).json({ error: "params is required" })
  }

  // Per-action param validation
  if (action === "swap") {
    if (!isValidAmount(params.amount)) return res.status(400).json({ error: "params.amount must be a positive number" })
    if (!params.tokenOut || typeof params.tokenOut !== "string") return res.status(400).json({ error: "params.tokenOut is required" })
  }
  if (action === "supply_aave" || action === "save") {
    if (!isValidAmount(params.amount)) return res.status(400).json({ error: "params.amount must be a positive number" })
  }
  if (action === "send") {
    if (!isValidAmount(params.amount)) return res.status(400).json({ error: "params.amount must be a positive number" })
    if (!isValidAddress(params.to)) return res.status(400).json({ error: "params.to must be a valid Ethereum address" })
  }
  if (action === "stake" || action === "unstake") {
    if (!isValidAmount(params.amount)) return res.status(400).json({ error: "params.amount must be a positive number" })
  }
  if (action === "launch_token") {
    if (!params.name || typeof params.name !== "string") return res.status(400).json({ error: "params.name is required" })
    if (!params.symbol || typeof params.symbol !== "string") return res.status(400).json({ error: "params.symbol is required" })
    if (!isValidAmount(params.totalSupply)) return res.status(400).json({ error: "params.totalSupply must be a positive number" })
  }

  console.log(`🔧 [prepare] action=${action} user=${userAddress.slice(0, 8)}...`)

  try {
    let result

    switch (action) {
      case "swap":
        result = await prepareSwap(userAddress, params.amount, params.tokenOut, params.tokenIn ?? "CELO")
        break

      case "supply_aave":
      case "save":
        result = await prepareSupplyAave(userAddress, params.amount, params.asset ?? "cUSD")
        break

      case "send":
        result = await prepareSend(userAddress, params.to, params.amount, params.token ?? "CELO")
        break

      case "stake":
        result = await prepareStake(userAddress, params.amount)
        break

      case "unstake":
        result = await prepareUnstake(userAddress, params.amount)
        break

      case "continue_unstake":
        result = await prepareCompleteUnstake(userAddress)
        break

      case "claim_unstake":
        result = await prepareClaimUnstake(userAddress)
        break

      case "launch_token":
        result = await prepareLaunchToken(userAddress, params.name, params.symbol, params.totalSupply)
        break

      case "get_trending":
        return res.json({ result: await getTrendingTokens() })

      case "get_tokens":
        return res.json({ result: await getTokens() })

      default:
        return res.status(400).json({ error: `Unknown action: ${action}. Supported: swap, supply_aave, send, stake, unstake, continue_unstake, claim_unstake, launch_token, get_tokens, get_trending` })
    }

    // Tag every unsigned tx with the Celo Builders attribution code (no-op
    // until ATTRIBUTION_TAG is set in .env — see src/lib/attribution.ts).
    result.transactions = tagTransactions(result.transactions)

    console.log(`✅ [prepare] ${action} — ${result.transactions.length} TX(s)`)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// ─── GET /api/v1/portfolio/:address ──────────────────────────────────────────
app.get("/api/v1/portfolio/:address", agentReadLimit, async (req, res) => {
  const { address } = req.params
  if (!isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid Celo address" })
  }

  try {
    const result = await runAgent(
      `Respond ONLY with a raw JSON object (no markdown, no explanation) with this exact shape:
      { "address": "...", "native": "...", "tokens": { "cUSD": "...", "cEUR": "...", "cREAL": "...", "USDC": "...", "USDT": "..." } }
      Get the portfolio for address ${address}.`
    )
    try { res.json(JSON.parse(result)) } catch { res.json({ address, raw: result }) }
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// ─── GET /api/v1/prices ───────────────────────────────────────────────────────
app.get("/api/v1/prices", externalReadLimit, async (req, res) => {
  const tokens = req.query.tokens as string | undefined

  try {
    const tokenList = tokens
      ? tokens.toUpperCase().split(",").map(t => t.trim()).filter(t => /^[A-Za-z0-9]{1,10}$/.test(t)).slice(0, 20)
      : ["CELO", "cUSD", "cEUR", "cREAL", "USDC", "USDT"]

    const cgMap: Record<string, string> = {
      CELO: "celo", CUSD: "celo-dollar", CEUR: "celo-euro",
      CREAL: "celo-brazilian-real", USDC: "usd-coin", USDT: "tether",
    }
    const ids = tokenList.map(t => cgMap[t.toUpperCase()] ?? t.toLowerCase()).join(",")

    const cgRes  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`)
    const data   = await cgRes.json() as Record<string, { usd?: number; usd_24h_change?: number }>

    const prices = tokenList.map(symbol => {
      const id = cgMap[symbol.toUpperCase()] ?? symbol.toLowerCase()
      return { symbol, priceUsd: data[id]?.usd ?? 0, change24h: data[id]?.usd_24h_change ?? null }
    })

    res.json({ prices, updatedAt: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// ─── GET /api/v1/tokens ───────────────────────────────────────────────────────
app.get("/api/v1/tokens", externalReadLimit, async (_req, res) => {
  try {
    const upstream = await fetch("https://celo-org.github.io/celo-token-list/celo.tokenlist.json")
    const data = await upstream.json() as { tokens: Array<{ chainId: number; address: string; symbol: string; name: string; decimals: number; logoURI?: string }> }
    const tokens = data.tokens.filter(t => t.chainId === 42220).map(t => ({
      symbol:   t.symbol,
      name:     t.name,
      address:  t.address,
      decimals: t.decimals,
      logoURI:  t.logoURI,
    }))
    res.json({ count: tokens.length, tokens, source: "https://celo-org.github.io/celo-token-list/celo.tokenlist.json" })
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// ─── GET /api/v1/aave/:address ────────────────────────────────────────────────
app.get("/api/v1/aave/:address", agentReadLimit, async (req, res) => {
  const { address } = req.params
  if (!isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid Celo address" })
  }

  try {
    const result = await runAgent(
      `Respond ONLY with a raw JSON object (no markdown, no explanation) with this exact shape:
      { "address": "...", "totalCollateralUsd": "...", "totalDebtUsd": "...", "availableBorrowsUsd": "...", "healthFactor": "..." }
      Get the Aave V3 position for address ${address}.`
    )
    try { res.json(JSON.parse(result)) } catch { res.json({ address, raw: result }) }
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// ─── GET /api/self-agent-status ───────────────────────────────────────────────
app.get("/api/self-agent-status", externalReadLimit, async (_req, res) => {
  try {
    const status = await getSelfAgentStatus()
    const ownerAddress = process.env.SELF_AGENT_OWNER_ADDRESS || AGENT_ADDRESS
    res.set("Cache-Control", "public, max-age=300")
    res.json({ ...status, ownerAddress })
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

const SELF_REGISTER_MESSAGE_PREFIX = "CeloBank Agent: Initiate Self Agent ID Registration"
const SELF_REGISTER_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

// ─── POST /api/self-agent-register (owner-only) ────────────────────────────
app.post("/api/self-agent-register", prepareLimit, async (req, res) => {
  const { ownerAddress, signature, timestamp } = req.body

  if (!isValidAddress(ownerAddress)) {
    return res.status(400).json({ error: "ownerAddress must be a valid Ethereum address" })
  }
  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ error: "signature is required" })
  }
  // Timestamp binds the signed message to a short validity window so a captured
  // signature can't be replayed indefinitely (the message itself was previously
  // static text with no nonce/expiry).
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return res.status(400).json({ error: "timestamp is required" })
  }
  if (Math.abs(Date.now() - timestamp) > SELF_REGISTER_WINDOW_MS) {
    return res.status(400).json({ error: "Request expired — please sign again" })
  }

  const ownerRef = process.env.SELF_AGENT_OWNER_ADDRESS || AGENT_ADDRESS
  if (ownerAddress.toLowerCase() !== ownerRef.toLowerCase()) {
    return res.status(403).json({ error: "Unauthorized: address is not the agent owner" })
  }

  try {
    const valid = await verifyMessage({
      address: ownerAddress as `0x${string}`,
      message: `${SELF_REGISTER_MESSAGE_PREFIX}\nTimestamp: ${timestamp}`,
      signature: signature as `0x${string}`,
    })
    if (!valid) {
      return res.status(403).json({ error: "Invalid signature" })
    }

    const session = await initiateRegistration(ownerAddress)
    res.json({
      deepLink: session.deepLink,
      humanInstructions: session.humanInstructions,
      agentAddress: session.agentAddress,
      expiresAt: session.expiresAt,
    })
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// ─── GET /health ──────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({
  status:  "ok",
  agent:   "CeloBank Agent API v2.0.0",
  wallet:  `${AGENT_ADDRESS.slice(0, 6)}...${AGENT_ADDRESS.slice(-4)}`,
  network: "Celo Mainnet (Chain ID: 42220)",
  // NOTE: keep in sync with the *actually-published* npm version, not just the
  // repo's package.json. Published 2026-07-18 — see CHANGELOG.md.
  sdk:     "@celobank/agent-sdk@1.2.0",
  mode:    "non-custodial (v2)",
  tools:   24,
  docs:    "/docs",
  uptime:  Math.floor(process.uptime()),
}))

// ─── MCP (Model Context Protocol) — 8004scan health check ────────────────────
const MCP_TOOLS = [
  { name: "get_balance",          description: "Get CELO balance of an address" },
  { name: "get_portfolio",        description: "Get full portfolio: CELO + all token balances" },
  { name: "get_celo_price",       description: "Get real-time CELO and token prices" },
  { name: "get_multi_price",      description: "Get prices for multiple tokens with 24h change" },
  { name: "send_celo",            description: "Send CELO or any registered ERC20 token (cUSD, cEUR, USDC, ...) to an address" },
  { name: "swap_celo",            description: "Swap CELO for a stablecoin via Mento V2" },
  { name: "swap_tokens",          description: "Universal swap: any token pair via Mento V2 or Uniswap V3" },
  { name: "save_cusd",            description: "Supply cUSD/USDC to Aave V3 to earn yield" },
  { name: "get_aave_position",    description: "Get Aave V3 lending position" },
  { name: "stake_celo",           description: "Stake CELO to earn ~4% APY via stCELO" },
  { name: "unstake_celo",         description: "Unstake stCELO back to CELO (step 1 of 3 — schedules the withdrawal)" },
  { name: "continue_unstake",     description: "Step 2 of 3: starts the 3-day unlock countdown for a scheduled unstake" },
  { name: "claim_unstake",        description: "Step 3 of 3: claims CELO once the 3-day unbonding period has elapsed" },
  { name: "get_staking_position", description: "Get CELO/stCELO staking position" },
  { name: "get_yield_options",    description: "Get all yield options on Celo with APY and risk" },
  { name: "trade_ideas",          description: "Portfolio analysis and personalized DeFi recommendations" },
  { name: "get_market_overview",  description: "Real-time market overview for all Celo tokens" },
  { name: "get_bridge_info",      description: "Bridge options to move tokens to/from Celo" },
  { name: "get_dailydrop_status", description: "Check DailyDrop streak and Proof of Presence badge" },
  { name: "launch_token",         description: "Deploy a new ERC20 token on Celo via TokenFactory" },
  { name: "get_tokens",           description: "List all tokens launched via CeloBank TokenFactory" },
  { name: "get_trending_tokens",  description: "Get the 5 most recently launched tokens on CeloBank Token Factory" },
  { name: "check_gooddollar",        description: "Check G$ balance and GoodDollar human verification status for an address" },
  { name: "get_engagement_rewards",  description: "Show CeloBank's GoodDollar engagement reward stats (G$ distributed, users onboarded)" },
]

// Shared MCP discovery payload — used by GET /mcp and content-negotiated GET /
const MCP_INFO = {
  name:        "CeloBank Agent",
  version:     "2.0.0",
  description: "Non-custodial DeFi agent on Celo Mainnet. Universal swap (26 tokens via Mento V2 + Uniswap V3), Aave V3 lending, Token Launcher (ERC-20 deploy), GoodDollar G$ integration, DailyDrop streak rewards. 24 tools. x402 micropayments (0.001 cUSD/write). ERC-8004 compliant.",
  tools:       MCP_TOOLS.map(t => t.name),
  status:      "healthy",
  endpoint:    "https://celobank-agent-production.up.railway.app/mcp",
  x402support: true,
}

// Per-tool input schemas for MCP tools/list discovery
const TOOL_SCHEMAS: Record<string, object> = {
  get_balance:          { type: "object", properties: { address: { type: "string", description: "Wallet address (0x...)" } } },
  get_portfolio:        { type: "object", properties: { address: { type: "string", description: "Wallet address (0x...)" } } },
  get_celo_price:       { type: "object", properties: {} },
  get_multi_price:      { type: "object", properties: {} },
  get_aave_position:    { type: "object", properties: { address: { type: "string", description: "Wallet address (0x...)" } } },
  get_staking_position: { type: "object", properties: { address: { type: "string", description: "Wallet address (0x...)" } } },
  get_yield_options:    { type: "object", properties: { riskLevel: { type: "string", description: "Filter: low, medium, very low" } } },
  trade_ideas:          { type: "object", properties: { address: { type: "string", description: "Wallet address to analyze" } } },
  get_market_overview:  { type: "object", properties: {} },
  get_bridge_info:      { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, token: { type: "string" } } },
  get_dailydrop_status: { type: "object", properties: { address: { type: "string", description: "Wallet address (0x...)" } } },
  get_tokens:           { type: "object", properties: {} },
  get_trending_tokens:  { type: "object", properties: {} },
  check_gooddollar:     { type: "object", required: ["address"], properties: { address: { type: "string", description: "Wallet address (0x...)" } } },
  get_engagement_rewards: { type: "object", properties: { address: { type: "string", description: "App address (optional, defaults to CeloBank)" } } },
  // Write tools — require X-PAYMENT: 0.001 cUSD via x402
  send_celo: {
    type: "object",
    required: ["userAddress", "to", "amount"],
    properties: {
      userAddress: { type: "string", description: "Signer wallet address (0x...)" },
      to:          { type: "string", description: "Recipient address (0x...)" },
      amount:      { type: "string", description: "Amount to send" },
      token:       { type: "string", description: "Token symbol to send (default: CELO). Any registered token — cUSD, cEUR, USDC, etc. — is sent via ERC20 transfer." },
    },
  },
  swap_celo: {
    type: "object",
    required: ["userAddress", "amount", "tokenOut"],
    properties: {
      userAddress: { type: "string", description: "Signer wallet address (0x...)" },
      amount:      { type: "string", description: "Amount of CELO to swap" },
      tokenOut:    { type: "string", description: "Target token: cUSD, cEUR, cREAL, USDC, USDT" },
    },
  },
  swap_tokens: {
    type: "object",
    required: ["userAddress", "amount", "tokenOut"],
    properties: {
      userAddress: { type: "string", description: "Signer wallet address (0x...)" },
      amount:      { type: "string", description: "Amount to swap" },
      tokenIn:     { type: "string", description: "Source token symbol (default: CELO)" },
      tokenOut:    { type: "string", description: "Destination token symbol" },
    },
  },
  save_cusd: {
    type: "object",
    required: ["userAddress", "amount"],
    properties: {
      userAddress: { type: "string", description: "Signer wallet address (0x...)" },
      amount:      { type: "string", description: "Amount to supply" },
      asset:       { type: "string", description: "Asset: cUSD (default) or USDC" },
    },
  },
  stake_celo: {
    type: "object",
    required: ["userAddress", "amount"],
    properties: {
      userAddress: { type: "string", description: "Signer wallet address (0x...)" },
      amount:      { type: "string", description: "Amount of CELO to stake" },
    },
  },
  unstake_celo: {
    type: "object",
    required: ["userAddress", "amount"],
    properties: {
      userAddress: { type: "string", description: "Signer wallet address (0x...)" },
      amount:      { type: "string", description: "Amount of stCELO to unstake" },
    },
  },
  continue_unstake: {
    type: "object",
    required: ["userAddress"],
    properties: {
      userAddress: { type: "string", description: "Signer wallet address (0x...)" },
    },
  },
  claim_unstake: {
    type: "object",
    required: ["userAddress"],
    properties: {
      userAddress: { type: "string", description: "Signer wallet address (0x...)" },
    },
  },
  launch_token: {
    type: "object",
    required: ["userAddress", "name", "symbol", "totalSupply"],
    properties: {
      userAddress:  { type: "string", description: "Signer wallet address (0x...)" },
      name:         { type: "string", description: "Full token name" },
      symbol:       { type: "string", description: "Token symbol (max 11 chars)" },
      totalSupply:  { type: "string", description: "Total supply as a number string" },
    },
  },
}

const mcpLimit = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests." } })

// ─── Idempotency store ────────────────────────────────────────────────────────
// Only successful write-tool settlements are cached. Error responses are not
// cached so callers can retry after fixing bad args without being stuck.
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000
interface IdempotencyEntry { response: object; receipt: string | null; expiry: number }
const idempotencyStore = new Map<string, IdempotencyEntry>()
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of idempotencyStore) if (v.expiry <= now) idempotencyStore.delete(k)
}, 30 * 60 * 1000).unref()

// JSON-RPC dispatcher — POST /mcp and POST /
// Read tools execute free. Write tools enforce x402: verify → execute → settle.
async function handleMcpRpc(req: any, res: any): Promise<void> {
  const { method, id, params } = req.body || {}

  if (method === "initialize") {
    res.json({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "CeloBank Agent", version: "2.0.0" },
        capabilities: { tools: {} },
      },
    })
    return
  }

  if (method === "tools/list") {
    res.json({
      jsonrpc: "2.0", id,
      result: {
        tools: MCP_TOOLS.map(t => ({
          name:        t.name,
          description: t.description,
          inputSchema: TOOL_SCHEMAS[t.name] ?? { type: "object", properties: {} },
          ...(WRITE_TOOL_NAMES.has(t.name) ? { x402: { required: true, amount: "0.001 cUSD", chainId: 42220 } } : {}),
        })),
      },
    })
    return
  }

  if (method === "tools/call") {
    const toolName = params?.name
    const toolArgs = (params?.arguments ?? {}) as Record<string, string>

    if (!toolName || typeof toolName !== "string") {
      res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "params.name is required" } })
      return
    }

    const knownTool = MCP_TOOLS.find(t => t.name === toolName)
    if (!knownTool) {
      res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${toolName}` } })
      return
    }

    // ── Write tools: enforce x402 ──────────────────────────────────────────────
    if (WRITE_TOOL_NAMES.has(toolName)) {
      const idempKey = (req.headers["idempotency-key"] as string | undefined)?.trim() || null
      if (idempKey) {
        if (idempKey.length > 256) {
          res.status(400).json({ error: "Idempotency-Key must be 256 characters or fewer" })
          return
        }
        const cached = idempotencyStore.get(idempKey)
        if (cached && cached.expiry > Date.now()) {
          if (cached.receipt) res.setHeader("X-PAYMENT-RECEIPT", cached.receipt)
          res.setHeader("Idempotency-Replayed", "true")
          res.json(cached.response)
          return
        }
      }

      const paymentHeader = req.headers["x-payment"] as string | undefined
      if (!paymentHeader) {
        res.status(402).json(paymentRequired402(toolName))
        return
      }

      const verification = await verifyX402Payment(paymentHeader)
      if (!verification.valid) {
        res.status(402).json({ ...paymentRequired402(toolName), reason: verification.reason })
        return
      }

      // Validate write-tool args before calling any prepare function
      const userAddress = toolArgs.userAddress
      if (!isValidAddress(userAddress)) {
        res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.userAddress must be a valid Ethereum address" } })
        return
      }

      try {
        let result: unknown

        switch (toolName) {
          case "send_celo":
            if (!isValidAddress(toolArgs.to))         { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.to must be a valid address" } }); return }
            if (!isValidAmount(toolArgs.amount))       { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.amount must be a positive number" } }); return }
            result = await prepareSend(userAddress, toolArgs.to, toolArgs.amount, toolArgs.token ?? "CELO")
            break

          case "swap_celo":
          case "swap_tokens":
            if (!isValidAmount(toolArgs.amount))       { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.amount must be a positive number" } }); return }
            if (!toolArgs.tokenOut)                    { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.tokenOut is required" } }); return }
            result = await prepareSwap(userAddress, toolArgs.amount, toolArgs.tokenOut, toolArgs.tokenIn ?? "CELO")
            break

          case "save_cusd":
            if (!isValidAmount(toolArgs.amount))       { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.amount must be a positive number" } }); return }
            result = await prepareSupplyAave(userAddress, toolArgs.amount, toolArgs.asset ?? "cUSD")
            break

          case "stake_celo":
            if (!isValidAmount(toolArgs.amount))       { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.amount must be a positive number" } }); return }
            result = await prepareStake(userAddress, toolArgs.amount)
            break

          case "unstake_celo":
            if (!isValidAmount(toolArgs.amount))       { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.amount must be a positive number" } }); return }
            result = await prepareUnstake(userAddress, toolArgs.amount)
            break

          case "continue_unstake":
            result = await prepareCompleteUnstake(userAddress)
            break

          case "claim_unstake":
            result = await prepareClaimUnstake(userAddress)
            break

          case "launch_token":
            if (!toolArgs.name)                        { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.name is required" } }); return }
            if (!toolArgs.symbol)                      { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.symbol is required" } }); return }
            if (!isValidAmount(toolArgs.totalSupply))  { res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "arguments.totalSupply must be a positive number" } }); return }
            result = await prepareLaunchToken(userAddress, toolArgs.name, toolArgs.symbol, toolArgs.totalSupply)
            break

          default:
            res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unhandled write tool: ${toolName}` } })
            return
        }

        // Payment verified + tool succeeded: settle now
        const settlement = await settleX402Payment(paymentHeader)
        const receipt = settlement.txHash ? JSON.stringify({
          txHash:    settlement.txHash,
          chainId:   42220,
          network:   "celo",
          paidTo:    AGENT_ADDRESS,
          amount:    "0.001",
          currency:  "cUSD",
          tool:      toolName,
          settledAt: new Date().toISOString(),
        }) : null
        const responseBody = {
          jsonrpc: "2.0", id,
          result: { content: [{ type: "text", text: JSON.stringify(result) }], paymentStatus: "settled" },
        }

        if (idempKey) {
          if (idempotencyStore.size >= 10_000) {
            const oldest = idempotencyStore.keys().next().value
            if (oldest !== undefined) idempotencyStore.delete(oldest)
          }
          idempotencyStore.set(idempKey, { response: responseBody, receipt, expiry: Date.now() + IDEMPOTENCY_TTL })
        }
        if (receipt) res.setHeader("X-PAYMENT-RECEIPT", receipt)
        res.json(responseBody)
      } catch (e) {
        console.error(`[mcp] Write tool ${toolName} error:`, e)
        res.json({ jsonrpc: "2.0", id, error: { code: -32603, message: safeError(e) } })
      }
      return
    }

    // ── Read tools: execute directly, no payment ───────────────────────────────
    const toolFn = toolRegistry[toolName]
    if (!toolFn) {
      res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Tool not implemented: ${toolName}` } })
      return
    }

    try {
      const result = await toolFn.invoke(toolArgs)
      res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: result }] } })
    } catch (e) {
      console.error(`[mcp] Read tool ${toolName} error:`, e)
      res.json({ jsonrpc: "2.0", id, error: { code: -32603, message: safeError(e) } })
    }
    return
  }

  res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } })
}

app.get("/mcp",  (_, res) => res.json(MCP_INFO))
app.post("/mcp", mcpLimit, (req, res, next) => { handleMcpRpc(req, res).catch(next) })

// ─── GET /catalog — x402 machine-readable service catalog ─────────────────────
app.get("/catalog", (_, res) => {
  const CUSD  = "0x765DE816845861e75A25fCA122bb6898B8B1282a"
  const WEI   = "1000000000000000" // 0.001 cUSD at 18 decimals

  const free = (
    id: string, name: string, description: string, input: Record<string, string>
  ) => ({ id, name, description, category: "read", pricing: { scheme: "free" }, input })

  const paid = (
    id: string, name: string, description: string, input: Record<string, string>
  ) => ({
    id, name, description, category: "write",
    pricing: { scheme: "exact", amount: "0.001", currency: "cUSD", amountWei: WEI, asset: CUSD, chainId: 42220 },
    requiredHeaders: ["X-PAYMENT"],
    input,
  })

  res.json({
    schema:      "x402-catalog/1.0",
    generatedAt: new Date().toISOString(),
    service: {
      id:          "celobank-agent",
      name:        "CeloBank Agent",
      description: "Non-custodial DeFi agent on Celo Mainnet. Universal swap (26 tokens via Mento V2 + Uniswap V3), Aave V3 lending, CELO liquid staking, ERC-20 token launch, GoodDollar G$ integration, DailyDrop streaks.",
      version:     "2.0.0",
      baseUrl:     "https://celobank-agent-production.up.railway.app",
      entrypoint:  "POST /api/v1/chat",
      network:     "Celo Mainnet",
      chainId:     42220,
      health: {
        endpoint: "/health",
        status:   "operational",
        uptime:   Math.floor(process.uptime()),
      },
    },
    idempotency: {
      header:   "Idempotency-Key",
      behavior: "Safe retries — identical Idempotency-Key within 24h returns the original result without re-executing the on-chain action",
      window:   "24h",
    },
    spendLimits: {
      perCall: { max: "100",  currency: "cUSD" },
      perDay:  { max: "1000", currency: "cUSD" },
      note:    "Advisory limits; agents should not exceed without explicit user approval",
    },
    x402: {
      facilitator:   "https://x402.org/facilitator",
      paymentToken:  { symbol: "cUSD", address: CUSD, decimals: 18, chainId: 42220 },
      payTo:         AGENT_ADDRESS,
      requiredHeader: "X-PAYMENT",
      receiptHeader:  "X-PAYMENT-RECEIPT",
    },
    schemas: {
      payment402Response: {
        status: 402,
        body: {
          error:       "Payment Required",
          x402Version: 1,
          accepts: [{
            scheme:            "exact",
            chainId:           42220,
            asset:             CUSD,
            maxAmountRequired: WEI,
            payTo:             AGENT_ADDRESS,
            description:       "Access to a CeloBank Agent write tool",
            resource:          "https://celobank-agent-production.up.railway.app/api/v1/chat",
            maxTimeoutSeconds: 300,
          }],
        },
      },
      receiptFormat: {
        header: "X-PAYMENT-RECEIPT",
        value: {
          txHash:    "0x<transaction_hash>",
          chainId:   42220,
          network:   "celo",
          paidTo:    "<agent_wallet_address>",
          amount:    "0.001",
          currency:  "cUSD",
          settledAt: "<ISO8601>",
        },
      },
      failureRefund: {
        states:   ["pending", "settled", "failed", "refunded"],
        behavior: {
          onFailure: "Payment is not captured — settlement occurs only on success",
          onRevert:  "If an on-chain action reverts after payment, the X-PAYMENT is voided and not settled",
        },
        sampleFailureResponse: {
          status: 200,
          body: {
            error: {
              code:          "ON_CHAIN_REVERT",
              message:       "Transaction reverted — swap failed due to insufficient liquidity",
              paymentStatus: "refunded",
              txHash:        null,
            },
          },
        },
      },
    },
    tools: [
      // read tools — free ──────────────────────────────────────────────────────
      free("get_balance",          "Get Balance",           "Get CELO native balance of an address",                                                    { address: "string?" }),
      free("get_portfolio",        "Get Portfolio",         "Get full portfolio: CELO + all token balances (cUSD, cEUR, cREAL, USDC, USDT)",             { address: "string?" }),
      free("get_multi_price",      "Get Prices",            "Get real-time USD prices for Celo tokens with 24h change",                                  { tokens: "string? (comma-separated, e.g. 'CELO,cUSD')" }),
      free("get_aave_position",    "Get Aave Position",     "Get Aave V3 lending position: collateral, debt, and health factor",                         { address: "string?" }),
      free("get_staking_position", "Get Staking Position",  "Get CELO + stCELO balances and current staking APY",                                       { address: "string?" }),
      free("get_yield_options",    "Get Yield Options",     "List all yield strategies on Celo with APY, risk level, and instructions",                  { riskLevel: "string? ('low' | 'medium' | 'very low')" }),
      free("get_market_overview",  "Market Overview",       "Real-time price overview for all Celo tokens with 24h % change",                            {}),
      free("get_bridge_info",      "Bridge Info",           "Get bridge options to move tokens to/from Celo network",                                    { from: "string?", to: "string?", token: "string?" }),
      free("get_dailydrop_status", "DailyDrop Status",      "Check DailyDrop check-in streak, badge, and reward eligibility for an address",             { address: "string?" }),
      free("get_tokens",           "Get Tokens",            "List all ERC-20 tokens launched via CeloBank Token Factory",                                {}),
      free("get_trending_tokens",  "Get Trending Tokens",   "Get the 5 most recently launched tokens on CeloBank Token Factory",                         {}),
      free("check_gooddollar",     "Check GoodDollar",      "Check G$ balance and GoodDollar human-verified identity status",                            { address: "string (required)" }),
      free("get_engagement_rewards", "Get Engagement Rewards", "Show CeloBank's GoodDollar EngagementRewards: total G$ distributed and users onboarded", { address: "string?" }),
      free("trade_ideas",          "Trade Ideas",           "Analyze portfolio and generate personalized DeFi trade recommendations",                     { address: "string?" }),
      // write tools — 0.001 cUSD each ─────────────────────────────────────────
      paid("send_celo",    "Send Token",         "Send CELO or any registered ERC20 token (cUSD, cEUR, USDC, ...) to an address",                       { to: "string (0x address, required)", amount: "string (required)", token: "string? (default: CELO)" }),
      paid("swap_celo",    "Swap CELO",          "Swap CELO for a stablecoin (cUSD, cEUR, cREAL, USDC, USDT) via Mento V2",                            { amount: "string (required)", tokenOut: "string (required)" }),
      paid("swap_tokens",  "Swap Tokens",        "Universal swap: any token pair on Celo via Mento V2 or Uniswap V3 (26+ tokens supported)",           { amount: "string (required)", tokenIn: "string? (default: CELO)", tokenOut: "string (required)" }),
      paid("save_cusd",    "Save (Aave Supply)", "Supply cUSD or USDC to Aave V3 to earn yield (~3–5% APY)",                                           { amount: "string (required)", asset: "string? ('cUSD' | 'USDC', default: cUSD)" }),
      paid("stake_celo",   "Stake CELO",         "Stake CELO to earn ~4% APY as stCELO (liquid staking, no lockup)",                                   { amount: "string (CELO to stake, required)" }),
      paid("unstake_celo", "Unstake CELO",       "Step 1 of 3: schedule unstake of stCELO back to CELO (does not release funds yet)",                  { amount: "string (stCELO to unstake, required)" }),
      paid("continue_unstake", "Continue Unstake", "Step 2 of 3: start the 3-day unlock countdown for a previously scheduled unstake",                  { userAddress: "string (0x..., required)" }),
      paid("claim_unstake", "Claim Unstake",     "Step 3 of 3: claim CELO once the 3-day unbonding period has elapsed",                                { userAddress: "string (0x..., required)" }),
      paid("launch_token", "Launch Token",       "Deploy a new ERC-20 token on Celo via CeloBank Token Factory",                                       { name: "string (required)", symbol: "string (max 11 chars, required)", totalSupply: "string (number, required)" }),
    ],
  })
})

// ─── GET /.well-known/agent-card.json — A2A AgentCard 0.3.0 ─────────────────
app.get("/.well-known/agent-card.json", (_, res) => {
  res.json({
    protocolVersion:    "0.3.0",
    name:               "CeloBank Agent",
    description:        "Non-custodial DeFi agent on Celo Mainnet. Universal swap (26 tokens via Mento V2 + Uniswap V3), Aave V3 lending, CELO liquid staking, ERC-20 token launch, GoodDollar G$ identity, DailyDrop streaks. 24 callable tools. x402 payment enforced on write tools (0.001 cUSD each).",
    version:            "2.0.0",
    url:                "https://celobank-agent-production.up.railway.app",
    provider: {
      organization: "wkalidev",
      url:          "https://github.com/wkalidev",
    },
    documentationUrl:   "https://github.com/wkalidev/celobank-agent",
    iconUrl:            "https://celobank-agent.vercel.app/celobank_splash.png",
    preferredTransport: "HTTP+JSON",
    defaultInputModes:  ["text/plain"],
    defaultOutputModes: ["text/plain"],
    termsOfService:     "https://github.com/wkalidev/celobank-agent/blob/main/LICENSE",
    license:            { name: "MIT", url: "https://github.com/wkalidev/celobank-agent/blob/main/LICENSE" },
    capabilities: {
      streaming:              false,
      pushNotifications:      false,
      stateTransitionHistory: false,
    },
    extensions: {
      x402: {
        supported:        true,
        catalog:          `${AGENT_BASE_URL}/catalog`,
        paymentToken:     "cUSD",
        paymentTokenAddr: CUSD_ADDRESS,
        chainId:          42220,
        writeToolFee:     "0.001 cUSD",
        freeTools:        15,
        paidTools:        9,
        facilitator:      X402_FACILITATOR,
      },
    },
    skills: [
      {
        id:          "defi-swap",
        name:        "Universal Token Swap",
        description: "Swap any of 26+ tokens on Celo. Routes CELO⇔stablecoins through Mento V2 (~0.1–0.3% slippage), all other pairs through Uniswap V3 (0.3% fee). Supports cUSD, cEUR, KESm, NGNm, USDC, USDT, WETH, stCELO, UBE, and more.",
        tags:        ["defi", "swap", "mento", "uniswap", "celo", "stablecoin"],
      },
      {
        id:          "aave-lending",
        name:        "Aave V3 Lending",
        description: "Supply cUSD or USDC to Aave V3 on Celo to earn yield (~3–5% APY, variable). Read lending position including collateral, debt, and health factor.",
        tags:        ["defi", "lending", "aave", "yield", "cusd", "usdc"],
      },
      {
        id:          "celo-staking",
        name:        "CELO Liquid Staking",
        description: "Stake CELO to receive stCELO and earn ~4% APY. Liquid staking with no lockup period. Unstaking has a ~3-day unbonding period. Read staking position and current APY.",
        tags:        ["staking", "celo", "stcelo", "yield", "liquid-staking"],
      },
      {
        id:          "token-launch",
        name:        "ERC-20 Token Launch",
        description: "Deploy a new ERC-20 token on Celo Mainnet in one transaction via CeloBank TokenFactory (0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e). Set name, symbol, and total supply. List and explore previously launched tokens.",
        tags:        ["tokenization", "erc20", "token-factory", "celo", "deploy"],
      },
      {
        id:          "gooddollar-identity",
        name:        "GoodDollar G$ Identity & Rewards",
        description: "Check G$ (GoodDollar) balance and human verification status via GoodDollar IdentityV4. Read CeloBank engagement reward stats: users onboarded and total G$ distributed. CeloBank earns $0.50 G$ per verified user referred.",
        tags:        ["gooddollar", "identity", "ubi", "g$", "engagement-rewards", "financial-inclusion"],
      },
      {
        id:          "portfolio-analysis",
        name:        "Portfolio Analysis & Trade Ideas",
        description: "Read full wallet portfolio (CELO + all ERC-20 balances). Get real-time prices and 24h change for all Celo tokens. Generate personalized DeFi trade ideas and yield recommendations from a connected wallet.",
        tags:        ["portfolio", "prices", "trade-ideas", "analysis", "celo", "defi"],
      },
      {
        id:          "remittance",
        name:        "Send & Bridge",
        description: "Send native CELO to any address. Get bridge routing guidance for moving tokens to/from Celo via Squid Router, Jumper Exchange, and Wormhole.",
        tags:        ["remittance", "send", "bridge", "celo", "payments", "financial-inclusion"],
      },
      {
        id:          "proof-of-presence",
        name:        "DailyDrop Proof of Presence",
        description: "Check DailyDrop daily check-in streak status, badge eligibility, and reward progress for any address. Proof-of-presence streak tracking on Celo.",
        tags:        ["proof-of-presence", "streak", "dailydrop", "engagement", "celo"],
      },
    ],
  })
})

// ─── Serve UI (production) ────────────────────────────────────────────────────
const uiDist = join(__dirname, "..", "ui", "dist")
if (existsSync(uiDist)) {
  // Content negotiation for GET / — must be registered BEFORE express.static so it
  // intercepts JSON clients (8004scan health checker, curl) before the static middleware
  // serves index.html. Browsers send Accept: text/html and are unaffected.
  app.get("/", (req, res, next) => {
    const accept = req.headers.accept ?? ""
    if (accept.includes("application/json") && !accept.includes("text/html")) {
      return res.json(MCP_INFO)
    }
    next()
  })

  // POST / — JSON-RPC clients that hit the root instead of /mcp
  app.post("/", mcpLimit, (req, res, next) => {
    const body = req.body || {}
    if (body.jsonrpc !== undefined || body.method !== undefined) {
      handleMcpRpc(req, res).catch(next)
      return
    }
    res.status(404).json({ error: "Not found" })
  })

  app.use(express.static(uiDist))
  // SPA fallback — serve index.html for any non-API route
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/mcp") ||
        req.path.startsWith("/health") || req.path.startsWith("/docs") ||
        req.path.startsWith("/.well-known")) return next()
    res.sendFile(join(uiDist, "index.html"))
  })
}

app.listen(3000, () => {
  console.log("🚀 CeloBank Agent API v2.0.0")
  console.log("📍 http://localhost:3000")
  console.log("📚 Docs: http://localhost:3000/docs")
  console.log(`💳 Agent: ${AGENT_ADDRESS.slice(0, 6)}...${AGENT_ADDRESS.slice(-4)}`)
  console.log("🌐 Network: Celo Mainnet")
  console.log("🔓 Non-custodial: POST /api/v1/prepare")
  console.log("🔒 Rate limiting: chat=20/min, prepare=30/min")
})
