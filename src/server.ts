import "dotenv/config"
import express from "express"
import cors from "cors"
import { runAgent } from "./agent/agent.js"
import { privateKeyToAccount } from "viem/accounts"
import { registerFarcasterBot } from "./bot/farcaster-bot.js"

const app = express()
app.use(cors())
app.use(express.json())
registerFarcasterBot(app)

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
  const { message, userAddress } = req.body
  if (!message) return res.status(400).json({ error: "Message requis" })

  try {
    const lang = detectLanguage(message)
    const langHint = langInstructions[lang]
    const walletAddress = userAddress || AGENT_ADDRESS
    const enrichedMessage = `${langHint} ${message}. User wallet address: ${walletAddress}.`
    console.log(`👤 User [${lang}] [${walletAddress}]: ${message}`)
    const response = await runAgent(enrichedMessage)
    console.log(`🤖 Agent: ${response}`)
    res.json({ response })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// 🟣 FARCASTER WEBHOOK
// Reçoit les événements Farcaster : ajout/suppression de l'app, notifications
// Types d'événements :
//   frame_added        → user a ajouté CeloBank à Warpcast
//   frame_removed      → user a retiré CeloBank
//   notifications_enabled  → user a activé les notifications
//   notifications_disabled → user a désactivé les notifications
//   notification       → événement de notification entrant

interface FarcasterWebhookBody {
  header: string
  payload: string
  signature: string
}

// Stockage simple en mémoire des tokens de notification
// En production, remplace par une DB (PostgreSQL, Redis, etc.)
const notificationTokens = new Map<number, { token: string; url: string }>()

app.post("/webhook", async (req, res) => {
  try {
    const body: FarcasterWebhookBody = req.body

    // Décoder le payload (base64url → JSON)
    const payloadJson = Buffer.from(body.payload, "base64url").toString("utf-8")
    const event = JSON.parse(payloadJson)

    console.log(`🟣 Farcaster webhook: ${event.event}`, event)

    switch (event.event) {
      case "frame_added": {
        // User a ajouté l'app — on sauvegarde son token de notification si disponible
        if (event.notificationDetails) {
          notificationTokens.set(event.fid, {
            token: event.notificationDetails.token,
            url: event.notificationDetails.url,
          })
          console.log(`✅ Notification token saved for FID ${event.fid}`)
        }
        break
      }

      case "frame_removed": {
        // User a retiré l'app — on supprime son token
        notificationTokens.delete(event.fid)
        console.log(`🗑️ Notification token removed for FID ${event.fid}`)
        break
      }

      case "notifications_enabled": {
        // User a activé les notifications
        if (event.notificationDetails) {
          notificationTokens.set(event.fid, {
            token: event.notificationDetails.token,
            url: event.notificationDetails.url,
          })
          console.log(`🔔 Notifications enabled for FID ${event.fid}`)
        }
        break
      }

      case "notifications_disabled": {
        // User a désactivé les notifications
        notificationTokens.delete(event.fid)
        console.log(`🔕 Notifications disabled for FID ${event.fid}`)
        break
      }

      default:
        console.log(`⚠️ Unknown event: ${event.event}`)
    }

    // Farcaster attend toujours un 200
    res.status(200).json({ success: true })

  } catch (e: any) {
    console.error("Webhook error:", e.message)
    // On répond quand même 200 pour éviter les retries infinis
    res.status(200).json({ success: false, error: e.message })
  }
})

// Helper : envoyer une notification push à un user Farcaster
// Utilisation future : sendFarcasterNotification(fid, "Ton CELO a augmenté de 5%!")
export async function sendFarcasterNotification(fid: number, title: string, body: string) {
  const details = notificationTokens.get(fid)
  if (!details) {
    console.log(`No notification token for FID ${fid}`)
    return
  }

  try {
    const res = await fetch(details.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificationId: `celobank-${Date.now()}`,
        title,
        body,
        targetUrl: "https://celobank-agent.vercel.app",
        tokens: [details.token],
      }),
    })
    const data = await res.json()
    console.log(`📨 Notification sent to FID ${fid}:`, data)
  } catch (e: any) {
    console.error("Failed to send notification:", e.message)
  }
}

app.get("/health", (_, res) => res.json({
  status: "ok",
  agent: "CeloBank Agent",
  wallet: AGENT_ADDRESS,
  network: "Celo Mainnet",
  notificationSubscribers: notificationTokens.size,
}))

app.listen(3000, () => {
  console.log("🚀 CeloBank Agent API running on http://localhost:3000")
  console.log(`💳 Wallet: ${AGENT_ADDRESS}`)
})