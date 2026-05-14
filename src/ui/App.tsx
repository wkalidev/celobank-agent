import { useState, useRef, useEffect } from "react"

interface Message {
  role: "user" | "agent"
  content: string
  timestamp: Date
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: "👋 Bonjour ! Je suis **CeloBank Agent** — votre banque autonome sur Celo.\n\nJe peux vous aider à :\n- 💰 Vérifier votre solde\n- 📤 Envoyer des CELO\n- 📈 Voir le prix du CELO\n- 🏦 Gérer vos positions DeFi (Aave)\n- 🔄 Échanger CELO ↔ cUSD\n\nComment puis-je vous aider ?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMsg: Message = { role: "user", content: input, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: "agent",
        content: data.response || data.error,
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: "agent",
        content: "❌ Erreur de connexion au serveur.",
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      
      {/* Header */}
<div style={{ padding: "16px 24px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 12, background: "#111" }}>
  <img src="/logo.svg" alt="CeloBank" style={{ width: 40, height: 40, borderRadius: "50%" }} />
  <div>
    <div style={{ fontWeight: 700, fontSize: 16 }}>CeloBank Agent</div>
    <div style={{ fontSize: 12, color: "#35D07F" }}>● En ligne · Celo Sepolia</div>
  </div>
  {/* Banner stats */}
  <div style={{ marginLeft: "auto", display: "flex", gap: 24 }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#555" }}>Réseau</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#FCFF52" }}>Celo Sepolia</div>
    </div>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#555" }}>Gas fees</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#35D07F" }}>{'<'} $0.001</div>
    </div>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#555" }}>Powered by</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>ERC-8004</div>
    </div>
  </div>
</div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "75%",
              padding: "12px 16px",
              borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.role === "user" ? "linear-gradient(135deg, #35D07F, #1a9e5c)" : "#1a1a1a",
              border: msg.role === "agent" ? "1px solid #2a2a2a" : "none",
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
              <div style={{ fontSize: 10, color: msg.role === "user" ? "rgba(255,255,255,0.6)" : "#555", marginTop: 6 }}>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "#1a1a1a", border: "1px solid #2a2a2a", fontSize: 14, color: "#555" }}>
              🤖 Agent en train de réfléchir...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 24px", borderTop: "1px solid #1a1a1a", background: "#111", display: "flex", gap: 12 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Envoie 1 CELO à 0x... · Quel est le prix du CELO ?"
          style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid #2a2a2a", background: "#1a1a1a", color: "#fff", fontSize: 14, outline: "none" }}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: loading ? "#333" : "linear-gradient(135deg, #FCFF52, #35D07F)", color: "#000", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 14 }}
        >
          {loading ? "..." : "Envoyer"}
        </button>
      </div>
    </div>
  )
}