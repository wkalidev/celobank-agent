import "dotenv/config"
import express from "express"
import cors from "cors"
import { runAgent } from "./agent/agent.js"

const app = express()
app.use(cors())
app.use(express.json())

// Détection simple de langue
function detectLanguage(text: string): string {
  const t = text.toLowerCase()
  if (/[àâäéèêëîïôùûüç]/.test(t) || /\b(je|tu|il|nous|vous|ils|est|les|des|une|pour|avec|sur)\b/.test(t)) return "french"
  if (/\b(io|tu|lui|noi|voi|loro|sono|buona|sera|grazie|prego)\b/.test(t)) return "italian"
  if (/\b(yo|tú|él|nosotros|es|los|las|una|para|con|hola|gracias)\b/.test(t)) return "spanish"
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
    console.log(`👤 User [${lang}]: ${message}`)
    const response = await runAgent(`[${langHint}] ${message}`)
    console.log(`🤖 Agent: ${response}`)
    res.json({ response })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/health", (_, res) => res.json({ status: "ok", agent: "CeloBank Agent" }))

app.listen(3000, () => console.log("🚀 CeloBank Agent API running on http://localhost:3000"))