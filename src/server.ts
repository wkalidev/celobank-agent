import "dotenv/config"
import express from "express"
import cors from "cors"
import { runAgent } from "./agent/agent.js"
import { privateKeyToAccount } from "viem/accounts"

const app = express()
app.use(cors())
app.use(express.json())

// Adresse du wallet de l'agent
const account = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`)
const AGENT_ADDRESS = account.address

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
  french: "Réponds en français.",
  italian: "Rispondi in italiano.",
  spanish: "Responde en español.",
  arabic: "أجب باللغة العربية.",
  swahili: "Jibu kwa Kiswahili.",
  english: "Respond in English.",
}

app.post("/chat", async (req, res) => {
  const { message } = req.body
  if (!message) return res.status(400).json({ error: "Message requis" })

  try {
    const lang = detectLanguage(message)
    const langHint = langInstructions[lang]
    
    // Injecte automatiquement l'adresse du wallet dans le contexte
    const enrichedMessage = `${langHint} ${message}. User wallet address: ${AGENT_ADDRESS}.`
    console.log(`👤 User [${lang}]: ${message}`)
    const response = await runAgent(enrichedMessage)
    console.log(`🤖 Agent: ${response}`)
    res.json({ response })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/health", (_, res) => res.json({ 
  status: "ok", 
  agent: "CeloBank Agent",
  wallet: AGENT_ADDRESS,
  network: "Celo Mainnet"
}))

app.listen(3000, () => {
  console.log("🚀 CeloBank Agent API running on http://localhost:3000")
  console.log(`💳 Wallet: ${AGENT_ADDRESS}`)
})