import "dotenv/config"
import express from "express"
import cors from "cors"
import { runAgent } from "./agent/agent.js"
import { privateKeyToAccount } from "viem/accounts"
import { prepareSwap, prepareSupplyAave, prepareSend, prepareStake } from "./tools/prepare.js"
import { prepareLaunchToken, getTokens, getTrendingTokens } from "./tools/launch.js"
const app = express()
app.use(cors())
app.use(express.json())

const account = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`)
const AGENT_ADDRESS = account.address

// ─── Language Detection ───────────────────────────────────────────────────────
function detectLanguage(text: string): string {
  const t = text.toLowerCase()
  if (/[àâäéèêëîïôùûüç]/.test(t) || /\b(je|tu|il|nous|vous|ils|est|les|des|une|pour|avec|sur|mon|ma|mes|solde|envoie|quel|quelle)\b/.test(t)) return "french"
  if (/\b(io|tu|lui|noi|voi|loro|sono|buona|sera|grazie|prego|mio|mia)\b/.test(t)) return "italian"
  if (/\b(yo|tú|él|nosotros|es|los|las|una|para|con|hola|gracias|mi|saldo)\b/.test(t)) return "spanish"
  if (/[\u0600-\u06FF]/.test(t)) return "arabic"
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
    { name: "DeFi",      description: "Aave V3 positions" },
    { name: "System",    description: "Health & status" },
  ],
  paths: {
    "/api/v1/chat": {
      post: {
        tags: ["Agent"],
        summary: "Send a message to the AI agent",
        description: "The agent understands natural language in 8 languages and executes DeFi actions on Celo Mainnet.",
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
          200: {
            description: "Agent response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    response: { type: "string" },
                    language: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/prepare": {
      post: {
        tags: ["Prepare"],
        summary: "Prepare unsigned transactions (non-custodial)",
        description: `Prepares DeFi transactions without signing them.
Returns calldata that the frontend submits via the user's own wallet (wagmi/RainbowKit/MiniPay).
The agent never holds user funds in this mode.

**Supported actions**: swap, supply_aave, send, stake`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action", "userAddress", "params"],
                properties: {
                  action:      { type: "string", enum: ["swap", "supply_aave", "send", "stake"], example: "swap" },
                  userAddress: { type: "string", example: "0xDEAc..." },
                  params: {
                    type: "object",
                    description: "Action-specific parameters",
                    example: { amount: "10", tokenOut: "cUSD" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Unsigned transactions ready to sign",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success:      { type: "boolean" },
                    action:       { type: "string" },
                    userAddress:  { type: "string" },
                    transactions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          to:          { type: "string" },
                          data:        { type: "string" },
                          value:       { type: "string" },
                          chainId:     { type: "number" },
                          description: { type: "string" },
                        },
                      },
                    },
                    summary: { type: "string" },
                  },
                },
              },
            },
          },
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

// ─── POST /api/v1/chat — Agent IA ─────────────────────────────────────────────
app.post("/api/v1/chat", async (req, res) => {
  const { message, userAddress } = req.body
  if (!message) return res.status(400).json({ error: "message is required" })

  try {
    const lang            = detectLanguage(message)
    const langHint        = langInstructions[lang]
    const walletAddress   = userAddress || AGENT_ADDRESS
    const enrichedMessage = `${langHint} ${message}. User wallet address: ${walletAddress}.`

    console.log(`👤 [${lang}] [${walletAddress.slice(0, 8)}...]: ${message}`)
    const response = await runAgent(enrichedMessage)
    console.log(`🤖 Agent: ${response}`)

    res.json({ response, language: lang })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// Rétrocompatibilité
app.post("/chat", async (req, res) => {
  const { message, userAddress } = req.body
  if (!message) return res.status(400).json({ error: "Message requis" })

  try {
    const lang            = detectLanguage(message)
    const langHint        = langInstructions[lang]
    const walletAddress   = userAddress || AGENT_ADDRESS
    const enrichedMessage = `${langHint} ${message}. User wallet address: ${walletAddress}.`
    const response        = await runAgent(enrichedMessage)
    res.json({ response })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /api/v1/prepare — Non-custodial TX preparation ──────────────────────
app.post("/api/v1/prepare", async (req, res) => {
  const { action, userAddress, params } = req.body

  if (!userAddress) {
    return res.status(400).json({ error: "userAddress is required" })
  }
  if (!action) {
    return res.status(400).json({ error: "action is required" })
  }
  if (!params) {
    return res.status(400).json({ error: "params is required" })
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

    console.log(`✅ [prepare] ${action} prepared for ${userAddress.slice(0, 8)}... — ${result.transactions.length} TX(s)`)
    res.json(result)
  } catch (e: any) {
    console.error(`❌ [prepare] error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /api/v1/portfolio/:address ──────────────────────────────────────────
app.get("/api/v1/portfolio/:address", async (req, res) => {
  const { address } = req.params
  if (!address.startsWith("0x") || address.length !== 42) {
    return res.status(400).json({ error: "Invalid Celo address" })
  }

  try {
    const result = await runAgent(
      `Respond ONLY with a raw JSON object (no markdown, no explanation) with this exact shape:
      { "address": "...", "native": "...", "tokens": { "cUSD": "...", "cEUR": "...", "cREAL": "...", "USDC": "...", "USDT": "..." } }
      Get the portfolio for address ${address}.`
    )
    try { res.json(JSON.parse(result)) } catch { res.json({ address, raw: result }) }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /api/v1/prices ───────────────────────────────────────────────────────
app.get("/api/v1/prices", async (req, res) => {
  const tokens = req.query.tokens as string | undefined

  try {
    const tokenList = tokens
      ? tokens.toUpperCase().split(",").map(t => t.trim())
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
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /api/v1/tokens — Official Celo token list (chainId 42220) ───────────
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
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /api/v1/aave/:address ────────────────────────────────────────────────
app.get("/api/v1/aave/:address", async (req, res) => {
  const { address } = req.params
  if (!address.startsWith("0x") || address.length !== 42) {
    return res.status(400).json({ error: "Invalid Celo address" })
  }

  try {
    const result = await runAgent(
      `Respond ONLY with a raw JSON object (no markdown, no explanation) with this exact shape:
      { "address": "...", "totalCollateralUsd": "...", "totalDebtUsd": "...", "availableBorrowsUsd": "...", "healthFactor": "..." }
      Get the Aave V3 position for address ${address}.`
    )
    try { res.json(JSON.parse(result)) } catch { res.json({ address, raw: result }) }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /health ──────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({
  status:  "ok",
  agent:   "CeloBank Agent API v2.0.0",
  wallet:  AGENT_ADDRESS,
  network: "Celo Mainnet (Chain ID: 42220)",
  sdk:     "@celobank/agent-sdk@1.0.1",
  mode:    "non-custodial (v2) + custodial fallback",
  docs:    "/docs",
  uptime:  Math.floor(process.uptime()),
}))

// ─── GET /mcp (8004scan health check) ───────────────────────────────────────
app.get("/mcp", (_, res) => res.json({
  name: "CeloBank Agent",
  version: "2.0.0",
  description: "Non-custodial DeFi agent on Celo Mainnet",
  tools: ["get_portfolio","get_prices","swap","save_aave","stake","send","trade_ideas","bridge_info","dailydrop_status"],
  status: "healthy",
  endpoint: "https://celobank-agent-production.up.railway.app",
}))

// ─── POST /mcp (JSON-RPC for 8004scan) ───────────────────────────────────────
app.post("/mcp", (req, res) => {
  const { method, id } = req.body || {}
  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "CeloBank Agent", version: "2.0.0" },
        capabilities: { tools: {} },
      }
    })
  }
  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0", id,
      result: { tools: [
        { name: "get_portfolio",    description: "Get wallet portfolio on Celo" },
        { name: "get_prices",       description: "Get real-time token prices" },
        { name: "swap",             description: "Swap CELO to stablecoin via Mento V2" },
        { name: "stake",            description: "Stake CELO for stCELO (~4% APY)" },
        { name: "save_aave",        description: "Supply to Aave V3 (~3-5% APY)" },
        { name: "send",             description: "Send CELO to any address" },
        { name: "trade_ideas",      description: "AI trade recommendations" },
        { name: "bridge_info",      description: "Bridge info (Squid, Jumper, Wormhole)" },
        { name: "dailydrop_status", description: "DailyDrop streak status" },
        { name: "daily_checkin",    description: "Daily check-in on DailyDrop" },
      ]}
    })
  }
  return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } })
})

app.listen(3000, () => {
  console.log("🚀 CeloBank Agent API v2.0.0")
  console.log("📍 http://localhost:3000")
  console.log("📚 Docs: http://localhost:3000/docs")
  console.log(`💳 Agent Wallet: ${AGENT_ADDRESS}`)
  console.log("🌐 Network: Celo Mainnet")
  console.log("🔓 Non-custodial mode: POST /api/v1/prepare")
})