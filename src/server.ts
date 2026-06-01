import "dotenv/config"
import express from "express"
import cors from "cors"
import { runAgent } from "./agent/agent.js"
import { privateKeyToAccount } from "viem/accounts"

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

// ─── Swagger UI (inline, zero dependency) ────────────────────────────────────
const swaggerHTML = `<!DOCTYPE html>
<html>
<head>
  <title>CeloBank Agent API</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .topbar { display: none; }
  </style>
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
    version: "1.0.0",
    description: `## Open infrastructure for autonomous DeFi agents on Celo

This API exposes the \`@celobank/agent-sdk\` as a REST interface.
Any developer can call these endpoints to integrate DeFi capabilities on Celo into their own app or agent.

**npm SDK**: \`npm install @celobank/agent-sdk\`
**GitHub**: https://github.com/wkalidev/celobank-agent
**Network**: Celo Mainnet (Chain ID: 42220)
    `,
    contact: {
      name: "wkalidev",
      url: "https://github.com/wkalidev/celobank-agent",
    },
    license: { name: "MIT" },
  },
  servers: [
    { url: "https://celobank-agent-production.up.railway.app", description: "Production (Celo Mainnet)" },
    { url: "http://localhost:3000", description: "Local development" },
  ],
  tags: [
    { name: "Agent",     description: "Natural language AI agent" },
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
        description: "The agent understands natural language in 8 languages and executes DeFi actions on Celo Mainnet autonomously.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  message:     { type: "string", example: "What is the current CELO price?" },
                  userAddress: { type: "string", example: "0xDEAc8D2b8F875a9E3cFC13E9d4d9e5e3e3e3e3e3", description: "User wallet address (optional)" },
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
                    response: { type: "string", example: "The current CELO price is $0.092 USD 📈 (+1.2% 24h)" },
                    language: { type: "string", example: "english" },
                  },
                },
              },
            },
          },
          400: { description: "Missing message field" },
          500: { description: "Agent error" },
        },
      },
    },
    "/api/v1/portfolio/{address}": {
      get: {
        tags: ["Wallet"],
        summary: "Get full wallet portfolio",
        description: "Returns native CELO + all ERC20 token balances (cUSD, cEUR, cREAL, USDC, USDT, stCELO, G$) for any address on Celo Mainnet.",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "0xDEAc8D2b8F875a9E3cFC13E9d4d9e5e3e3e3e3e3",
            description: "Celo wallet address",
          },
        ],
        responses: {
          200: {
            description: "Portfolio balances",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    native:  { type: "string", description: "CELO native balance" },
                    tokens: {
                      type: "object",
                      example: { cUSD: "45.200000", cEUR: "0.000000", USDC: "12.500000" },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Invalid address" },
        },
      },
    },
    "/api/v1/prices": {
      get: {
        tags: ["Prices"],
        summary: "Get real-time token prices",
        description: "Returns USD prices + 24h change for Celo ecosystem tokens via CoinGecko.",
        parameters: [
          {
            name: "tokens",
            in: "query",
            required: false,
            schema: { type: "string" },
            example: "CELO,cUSD,USDC",
            description: "Comma-separated token symbols. Omit for all tokens.",
          },
        ],
        responses: {
          200: {
            description: "Token prices",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    prices: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          symbol:    { type: "string", example: "CELO" },
                          priceUsd:  { type: "number", example: 0.092 },
                          change24h: { type: "number", example: 1.23 },
                        },
                      },
                    },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/aave/{address}": {
      get: {
        tags: ["DeFi"],
        summary: "Get Aave V3 position",
        description: "Returns collateral, debt, available borrows, and health factor for an address on Aave V3 Celo.",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "0xDEAc8D2b8F875a9E3cFC13E9d4d9e5e3e3e3e3e3",
          },
        ],
        responses: {
          200: {
            description: "Aave position",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    address:             { type: "string" },
                    totalCollateralUsd:  { type: "string", example: "102.45" },
                    totalDebtUsd:        { type: "string", example: "0.00" },
                    availableBorrowsUsd: { type: "string", example: "71.71" },
                    healthFactor:        { type: "string", example: "∞" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        description: "Returns API status, agent wallet address, and network info.",
        responses: {
          200: {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status:  { type: "string", example: "ok" },
                    agent:   { type: "string", example: "CeloBank Agent API v1.0.0" },
                    wallet:  { type: "string", example: "0xDEAc..." },
                    network: { type: "string", example: "Celo Mainnet" },
                    sdk:     { type: "string", example: "@celobank/agent-sdk@1.0.0" },
                    uptime:  { type: "number", example: 3600 },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Documentation Swagger
app.get("/", (_, res) => res.send(swaggerHTML))
app.get("/docs", (_, res) => res.send(swaggerHTML))
app.get("/api/v1/openapi.json", (_, res) => res.json(openApiSpec))

// POST /api/v1/chat — Agent IA
app.post("/api/v1/chat", async (req, res) => {
  const { message, userAddress } = req.body
  if (!message) return res.status(400).json({ error: "message is required" })

  try {
    const lang = detectLanguage(message)
    const langHint = langInstructions[lang]
    const walletAddress = userAddress || AGENT_ADDRESS
    const enrichedMessage = `${langHint} ${message}. User wallet address: ${walletAddress}.`

    console.log(`👤 [${lang}] [${walletAddress.slice(0, 8)}...]: ${message}`)
    const response = await runAgent(enrichedMessage)
    console.log(`🤖 Agent: ${response}`)

    res.json({ response, language: lang })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// Rétrocompatibilité — ancien endpoint /chat
app.post("/chat", async (req, res) => {
  const { message, userAddress } = req.body
  if (!message) return res.status(400).json({ error: "Message requis" })

  try {
    const lang = detectLanguage(message)
    const langHint = langInstructions[lang]
    const walletAddress = userAddress || AGENT_ADDRESS
    const enrichedMessage = `${langHint} ${message}. User wallet address: ${walletAddress}.`
    const response = await runAgent(enrichedMessage)
    res.json({ response })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/v1/portfolio/:address
app.get("/api/v1/portfolio/:address", async (req, res) => {
  const { address } = req.params

  if (!address.startsWith("0x") || address.length !== 42) {
    return res.status(400).json({ error: "Invalid Celo address" })
  }

  try {
    // On passe par l'agent avec un message structuré
    const result = await runAgent(
      `Respond ONLY with a raw JSON object (no markdown, no explanation) with this exact shape:
      { "address": "...", "native": "...", "tokens": { "cUSD": "...", "cEUR": "...", "cREAL": "...", "USDC": "...", "USDT": "..." } }
      Get the portfolio for address ${address}.`
    )
    try {
      res.json(JSON.parse(result))
    } catch {
      res.json({ address, raw: result })
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/v1/prices
app.get("/api/v1/prices", async (req, res) => {
  const tokens = req.query.tokens as string | undefined

  try {
    const tokenList = tokens
      ? tokens.toUpperCase().split(",").map(t => t.trim())
      : ["CELO", "cUSD", "cEUR", "cREAL", "USDC", "USDT"]

    const ids = tokenList.map(t => {
      const map: Record<string, string> = {
        CELO: "celo", cUSD: "celo-dollar", cEUR: "celo-euro",
        cREAL: "celo-brazilian-real", USDC: "usd-coin", USDT: "tether",
      }
      return map[t] ?? t.toLowerCase()
    }).join(",")

    const cgRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
    )
    const data = await cgRes.json() as Record<string, { usd?: number; usd_24h_change?: number }>

    const prices = tokenList.map(symbol => {
      const map: Record<string, string> = {
        CELO: "celo", cUSD: "celo-dollar", cEUR: "celo-euro",
        cREAL: "celo-brazilian-real", USDC: "usd-coin", USDT: "tether",
      }
      const id = map[symbol] ?? symbol.toLowerCase()
      return {
        symbol,
        priceUsd:  data[id]?.usd ?? 0,
        change24h: data[id]?.usd_24h_change ?? null,
      }
    })

    res.json({ prices, updatedAt: new Date().toISOString() })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/v1/aave/:address
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
    try {
      res.json(JSON.parse(result))
    } catch {
      res.json({ address, raw: result })
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /health
app.get("/health", (_, res) => res.json({
  status:  "ok",
  agent:   "CeloBank Agent API v1.0.0",
  wallet:  AGENT_ADDRESS,
  network: "Celo Mainnet (Chain ID: 42220)",
  sdk:     "@celobank/agent-sdk@1.0.0",
  docs:    "/docs",
  uptime:  Math.floor(process.uptime()),
}))

app.listen(3000, () => {
  console.log("🚀 CeloBank Agent API v1.0.0")
  console.log("📍 http://localhost:3000")
  console.log("📚 Docs: http://localhost:3000/docs")
  console.log(`💳 Wallet: ${AGENT_ADDRESS}`)
  console.log("🌐 Network: Celo Mainnet")
})