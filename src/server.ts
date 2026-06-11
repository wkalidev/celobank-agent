import "dotenv/config"
import express from "express"
import cors from "cors"
import { rateLimit } from "express-rate-limit"
import { runAgent } from "./agent/agent.js"
import { privateKeyToAccount } from "viem/accounts"
import { prepareSwap, prepareSupplyAave, prepareSend, prepareStake } from "./tools/prepare.js"
import { prepareLaunchToken, getTokens, getTrendingTokens } from "./tools/launch.js"

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
    // Allow requests with no origin (curl, Swagger, mobile apps)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(null, true) // keep public for SDK integrations; rate limiting is the real guard
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}))

app.set("trust proxy", 1)

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

// ─── Input validation helpers ─────────────────────────────────────────────────
function isValidAddress(addr: unknown): addr is string {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr)
}

function isValidAmount(amount: unknown): boolean {
  if (typeof amount !== "string") return false
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

// ─── Language Detection ───────────────────────────────────────────────────────
function detectLanguage(text: string): string {
  const t = text.toLowerCase()
  if (/[àâäéèêëîïôùûüç]/.test(t) || /\b(je|tu|il|nous|vous|ils|est|les|des|une|pour|avec|sur|mon|ma|mes|solde|envoie|quel|quelle)\b/.test(t)) return "french"
  if (/\b(io|tu|lui|noi|voi|loro|sono|buona|sera|grazie|prego|mio|mia)\b/.test(t)) return "italian"
  if (/\b(yo|tú|él|nosotros|es|los|las|una|para|con|hola|gracias|mi|saldo)\b/.test(t)) return "spanish"
  if (/[؀-ۿ]/.test(t)) return "arabic"
  if (/\b(mimi|wewe|yeye|sisi|ninyi|wao|habari|asante|karibu)\b/.test(t)) return "swahili"
  return "english"
}

const langInstructions: Record<string, string> = {
  french:  "Réponds en français.",
  italian: "Rispondi in italiano.",
  spanish: "Responde en español.",
  arabic:  "أجب باللغة العربية.",
  swahili: "Jibu kwa Kiswahili.",
  english: "Respond in English.",
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
    { name: "Agent",     description: "Natural language AI agent" },
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
        summary: "Send a message to the AI agent",
        description: "The agent understands natural language in 8 languages and executes DeFi actions on Celo Mainnet. Rate limited to 20 req/min.",
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
        description: "Prepares DeFi transactions without signing them. Rate limited to 30 req/min.\n\n**Supported actions**: swap, supply_aave, send, stake, launch_token, get_tokens, get_trending",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action", "userAddress", "params"],
                properties: {
                  action:      { type: "string", enum: ["swap", "supply_aave", "send", "stake", "launch_token", "get_tokens", "get_trending"], example: "swap" },
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
  },
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/",              (_, res) => res.send(swaggerHTML))
app.get("/docs",          (_, res) => res.send(swaggerHTML))
app.get("/api/v1/openapi.json", (_, res) => res.json(openApiSpec))

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

    res.json({ response, language: lang })
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// Backward-compat alias
app.post("/chat", chatLimit, async (req, res) => {
  const { message, userAddress } = req.body
  if (!message || typeof message !== "string") return res.status(400).json({ error: "Message requis" })
  if (userAddress && !isValidAddress(userAddress)) return res.status(400).json({ error: "Invalid address" })

  try {
    const lang            = detectLanguage(message)
    const langHint        = langInstructions[lang]
    const walletAddress   = isValidAddress(userAddress) ? userAddress : AGENT_ADDRESS
    const enrichedMessage = `${langHint} ${message}. User wallet address: ${walletAddress}.`
    const response        = await runAgent(enrichedMessage)
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
  if (action === "stake") {
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
        result = await prepareSend(userAddress, params.to, params.amount)
        break

      case "stake":
        result = await prepareStake(userAddress, params.amount)
        break

      case "launch_token":
        result = await prepareLaunchToken(userAddress, params.name, params.symbol, params.totalSupply)
        break

      case "get_trending":
        return res.json({ result: await getTrendingTokens() })

      case "get_tokens":
        return res.json({ result: await getTokens() })

      default:
        return res.status(400).json({ error: `Unknown action: ${action}. Supported: swap, supply_aave, send, stake, launch_token, get_tokens, get_trending` })
    }

    console.log(`✅ [prepare] ${action} — ${result.transactions.length} TX(s)`)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: safeError(e) })
  }
})

// ─── GET /api/v1/portfolio/:address ──────────────────────────────────────────
app.get("/api/v1/portfolio/:address", async (req, res) => {
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
app.get("/api/v1/prices", async (req, res) => {
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
app.get("/api/v1/tokens", async (_req, res) => {
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
app.get("/api/v1/aave/:address", async (req, res) => {
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

// ─── GET /health ──────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({
  status:  "ok",
  agent:   "CeloBank Agent API v2.0.0",
  wallet:  `${AGENT_ADDRESS.slice(0, 6)}...${AGENT_ADDRESS.slice(-4)}`,
  network: "Celo Mainnet (Chain ID: 42220)",
  sdk:     "@celobank/agent-sdk@1.0.5",
  mode:    "non-custodial (v2)",
  tools:   21,
  docs:    "/docs",
  uptime:  Math.floor(process.uptime()),
}))

// ─── MCP (Model Context Protocol) — 8004scan health check ────────────────────
const MCP_TOOLS = [
  { name: "get_balance",          description: "Get CELO balance of an address" },
  { name: "get_portfolio",        description: "Get full portfolio: CELO + all token balances" },
  { name: "get_celo_price",       description: "Get real-time CELO and token prices" },
  { name: "get_multi_price",      description: "Get prices for multiple tokens with 24h change" },
  { name: "send_celo",            description: "Send CELO to an address" },
  { name: "swap_celo",            description: "Swap CELO for a stablecoin via Mento V2" },
  { name: "swap_tokens",          description: "Universal swap: any token pair via Mento V2 or Uniswap V3" },
  { name: "save_cusd",            description: "Supply cUSD/USDC to Aave V3 to earn yield" },
  { name: "get_aave_position",    description: "Get Aave V3 lending position" },
  { name: "stake_celo",           description: "Stake CELO to earn ~4% APY via stCELO" },
  { name: "unstake_celo",         description: "Unstake stCELO back to CELO" },
  { name: "get_staking_position", description: "Get CELO/stCELO staking position" },
  { name: "get_yield_options",    description: "Get all yield options on Celo with APY and risk" },
  { name: "trade_ideas",          description: "AI portfolio analysis and DeFi recommendations" },
  { name: "get_market_overview",  description: "Real-time market overview for all Celo tokens" },
  { name: "get_bridge_info",      description: "Bridge options to move tokens to/from Celo" },
  { name: "get_dailydrop_status", description: "Check DailyDrop streak and Proof of Presence badge" },
  { name: "launch_token",         description: "Deploy a new ERC20 token on Celo via TokenFactory" },
  { name: "get_tokens",           description: "List all tokens launched via CeloBank TokenFactory" },
  { name: "check_gooddollar",        description: "Check G$ balance and GoodDollar human verification status for an address" },
  { name: "get_engagement_rewards",  description: "Show CeloBank's GoodDollar engagement reward stats (G$ distributed, users onboarded)" },
]

app.get("/mcp", (_, res) => res.json({
  name:         "CeloBank Agent",
  version:      "2.0.0",
  description:  "Non-custodial AI DeFi agent on Celo Mainnet — 21 tools",
  tools:        MCP_TOOLS.map(t => t.name),
  status:       "healthy",
  endpoint:     "https://celobank-agent-production.up.railway.app",
  x402support:  true,
}))

app.post("/mcp", (req, res) => {
  const { method, id } = req.body || {}

  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "CeloBank Agent", version: "2.0.0" },
        capabilities: { tools: {} },
      },
    })
  }

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0", id,
      result: {
        tools: MCP_TOOLS.map(t => ({
          name:        t.name,
          description: t.description,
          inputSchema: { type: "object", properties: {} },
        })),
      },
    })
  }

  if (method === "tools/call") {
    return res.json({
      jsonrpc: "2.0", id,
      result: { content: [{ type: "text", text: "Use POST /api/v1/chat or POST /api/v1/prepare to invoke tools." }] },
    })
  }

  return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } })
})

app.listen(3000, () => {
  console.log("🚀 CeloBank Agent API v2.0.0")
  console.log("📍 http://localhost:3000")
  console.log("📚 Docs: http://localhost:3000/docs")
  console.log(`💳 Agent: ${AGENT_ADDRESS.slice(0, 6)}...${AGENT_ADDRESS.slice(-4)}`)
  console.log("🌐 Network: Celo Mainnet")
  console.log("🔓 Non-custodial: POST /api/v1/prepare")
  console.log("🔒 Rate limiting: chat=20/min, prepare=30/min")
})
