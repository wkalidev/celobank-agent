import "dotenv/config"
import express from "express"
import crypto  from "crypto"
import { runAgent } from "../agent/agent.js"

const NEYNAR_API_KEY        = process.env.NEYNAR_API_KEY!
const NEYNAR_SIGNER_UUID    = process.env.NEYNAR_BOT_SIGNER_UUID!
const BOT_FID               = Number(process.env.NEYNAR_BOT_FID ?? "0")
const WEBHOOK_SECRET        = process.env.NEYNAR_WEBHOOK_SECRET ?? ""
const NEYNAR_BASE           = "https://api.neynar.com/v2/farcaster"

function verifyNeynarSignature(rawBody: Buffer, signature: string): boolean {
  if (!WEBHOOK_SECRET || !signature) return true
  const expected = crypto
    .createHmac("sha512", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex")
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

async function replyToCast(text: string, parentHash: string, parentFid: number) {
  const truncated = text.length > 310 ? text.slice(0, 307) + "…" : text
  const res = await fetch(`${NEYNAR_BASE}/cast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api_key":      NEYNAR_API_KEY,
    },
    body: JSON.stringify({
      signer_uuid: NEYNAR_SIGNER_UUID,
      text:        truncated,
      parent:      parentHash,
      embeds:      [{ url: "https://celobank-agent.vercel.app/frame" }],
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error("❌ Neynar cast error:", data)
    throw new Error(JSON.stringify(data))
  }
  return data
}

async function getWalletForFid(fid: number): Promise<string | null> {
  try {
    const res = await fetch(`${NEYNAR_BASE}/user/bulk?fids=${fid}`, {
      headers: { "api_key": NEYNAR_API_KEY },
    })
    const d = await res.json()
    return d?.users?.[0]?.verified_addresses?.eth_addresses?.[0] ?? null
  } catch {
    return null
  }
}

function cleanCastText(text: string): string {
  return text
    .replace(/@celobank\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export function registerFarcasterBot(app: express.Express) {
  app.post(
    "/webhook/farcaster",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["x-neynar-signature"] as string
      if (!verifyNeynarSignature(req.body as Buffer, sig)) {
        console.warn("⚠️  Signature Neynar invalide")
        return res.status(401).json({ error: "Invalid signature" })
      }

      let event: any
      try {
        event = JSON.parse((req.body as Buffer).toString())
      } catch {
        return res.status(400).json({ error: "Invalid JSON" })
      }

      res.status(200).json({ ok: true })

      setImmediate(async () => {
        try {
          const cast = event?.data?.cast
          if (!cast) return

          const authorFid  = cast.author?.fid
          const castHash   = cast.hash
          const castText   = cast.text ?? ""

          if (authorFid === BOT_FID) return

          const mentions = cast.mentioned_profiles ?? []
          const isMentioned = mentions.some((p: any) => p.fid === BOT_FID)
          if (!isMentioned) return

          console.log(`📨 Mention de @${cast.author?.username} (FID:${authorFid}): ${castText}`)

          const wallet = await getWalletForFid(authorFid)
          console.log(`   Wallet: ${wallet ?? "non vérifié"}`)

          const cleanText = cleanCastText(castText) || "Bonjour, que peux-tu faire ?"
          const enriched  = wallet
            ? `${cleanText}. User wallet address: ${wallet}.`
            : cleanText

          const agentReply = await runAgent(enriched)
          console.log(`   🤖 Réponse: ${agentReply.slice(0, 100)}…`)

          const username  = cast.author?.username
          const replyText = `@${username} ${agentReply}`
          await replyToCast(replyText, castHash, authorFid)
          console.log(`   ✅ Répondu à @${username}`)

        } catch (e) {
          console.error("❌ Bot error:", e)
        }
      })
    }
  )

  console.log("🤖 Farcaster Bot webhook registered at POST /webhook/farcaster")
}