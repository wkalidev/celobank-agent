import { useState, useRef, useEffect } from "react"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

interface Message {
  role: "user" | "agent"
  content: string
  timestamp: Date
}

const QUICK_ACTIONS = [
  { label: "💰 Prix CELO", msg: "Quel est le prix du CELO en ce moment ?" },
  { label: "📊 Mon solde", msg: "Vérifie mon solde" },
  { label: "🔄 Swap CELO→cUSD", msg: "Échange 0.1 CELO contre des cUSD" },
  { label: "🏦 Position Aave", msg: "Quelle est ma position sur Aave ?" },
  { label: "📤 Envoyer", msg: "Je veux envoyer des CELO" },
  { label: "💵 Épargner", msg: "Je veux déposer des cUSD sur Aave" },
]

const STATS = [
  { label: "Réseau", value: "Celo Mainnet", color: "#FCFF52" },
  { label: "Gas fees", value: "< $0.001", color: "#35D07F" },
  { label: "Standard", value: "ERC-8004", color: "#fff" },
  { label: "Stablecoins", value: "25+", color: "#35D07F" },
]

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: "👋 Bonjour ! Je suis **CeloBank Agent** — la première banque IA autonome sur Celo.\n\nAccès à la finance pour les 1.4 milliard de non-bankés dans le monde.\n\nChoisissez une action rapide ou écrivez votre demande. Je parle toutes les langues 🌍",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [celoPrice, setCeloPrice] = useState<string | null>(null)
  const [priceTrend, setPriceTrend] = useState<"up" | "down" | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  
  const { address, isConnected } = useAccount()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd&include_24hr_change=true")
        const data = await res.json()
        const price = data.celo.usd.toFixed(4)
        const change = data.celo.usd_24h_change
        setPriceTrend(change >= 0 ? "up" : "down")
        setCeloPrice(price)
      } catch {
        setCeloPrice("--")
      }
    }
    fetchPrice()
    const interval = setInterval(fetchPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  async function sendMessage(text?: string) {
    const msg = text || input
    if (!msg.trim() || loading) return

    const userMsg: Message = { role: "user", content: msg, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("https://celobank-agent-production.up.railway.app/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#050505", color: "#fff", fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "0 24px", height: 60, borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: 14, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(20px)", flexShrink: 0, zIndex: 10 }}>
        
        {/* Logo */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <img src="/logo.svg" alt="CeloBank" style={{ width: 36, height: 36, borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "#35D07F", border: "2px solid #050505" }} />
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>CeloBank Agent</div>
          <div style={{ fontSize: 11, color: "#35D07F", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#35D07F", animation: "pulse 2s infinite" }} />
            En ligne · Celo Mainnet
          </div>
        </div>

        {/* CELO Price Live */}
        <div style={{ marginLeft: 16, padding: "6px 14px", borderRadius: 20, background: "#0d1f14", border: "1px solid #1a3d24", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#555" }}>CELO</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: priceTrend === "up" ? "#35D07F" : priceTrend === "down" ? "#ff4d4d" : "#fff" }}>
            {celoPrice ? `$${celoPrice}` : "..."}
          </span>
          <span style={{ fontSize: 12 }}>{priceTrend === "up" ? "↑" : priceTrend === "down" ? "↓" : ""}</span>
        </div>

        {/* Stats */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 28 }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{ width: 240, borderRight: "1px solid #111", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, overflowY: "auto" }}>
          
          <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Actions rapides</div>
          
          {QUICK_ACTIONS.map((action, i) => (
            <button key={i} onClick={() => sendMessage(action.msg)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #1a1a1a", background: "#0d0d0d", color: "#ccc", fontSize: 13, cursor: "pointer", textAlign: "left", transition: "all 0.15s", fontFamily: "inherit" }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = "#1a1a1a"; (e.target as HTMLElement).style.color = "#fff"; (e.target as HTMLElement).style.borderColor = "#35D07F" }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = "#0d0d0d"; (e.target as HTMLElement).style.color = "#ccc"; (e.target as HTMLElement).style.borderColor = "#1a1a1a" }}>
              {action.label}
            </button>
          ))}

          <div style={{ marginTop: 16, fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Langues</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["🇫🇷", "🇬🇧", "🇪🇸", "🇸🇦", "🇹🇿", "🇮🇹", "🇵🇹", "🇨🇳"].map((flag, i) => (
              <div key={i} style={{ fontSize: 18, cursor: "default", opacity: 0.7 }} title="Langue supportée">{flag}</div>
            ))}
          </div>

          <div style={{ marginTop: "auto", padding: "12px", borderRadius: 10, background: "#0d1f14", border: "1px solid #1a3d24" }}>
            <div style={{ fontSize: 10, color: "#35D07F", fontWeight: 600, marginBottom: 4 }}>🔗 ERC-8004</div>
            <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>Agent avec identité on-chain vérifiable sur Celo</div>
          </div>
        </div>

        {/* ── CHAT ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 10 }}>
                
                {msg.role === "agent" && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, overflow: "hidden" }}>
                    <img src="/logo.svg" alt="Agent" style={{ width: "100%", height: "100%" }} />
                  </div>
                )}

                <div style={{ maxWidth: "65%" }}>
                  <div style={{
                    padding: "14px 18px",
                    borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                    background: msg.role === "user"
                      ? "linear-gradient(135deg, #35D07F, #1a9e5c)"
                      : "linear-gradient(135deg, #111, #0d0d0d)",
                    border: msg.role === "agent" ? "1px solid #1e1e1e" : "none",
                    fontSize: 14,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    boxShadow: msg.role === "user" ? "0 4px 20px rgba(53,208,127,0.2)" : "0 4px 20px rgba(0,0,0,0.3)",
                  }}>
                    {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
                  </div>
                  <div style={{ fontSize: 10, color: "#333", marginTop: 4, textAlign: msg.role === "user" ? "right" : "left", paddingLeft: msg.role === "agent" ? 4 : 0 }}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                {msg.role === "user" && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #FCFF52, #35D07F)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#000" }}>U</div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                  <img src="/logo.svg" alt="Agent" style={{ width: "100%", height: "100%" }} />
                </div>
                <div style={{ padding: "14px 18px", borderRadius: "20px 20px 20px 4px", background: "#111", border: "1px solid #1e1e1e" }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {[0, 1, 2].map(j => (
                      <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#35D07F", animation: `bounce 1.2s ${j * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "16px 28px", borderTop: "1px solid #111", background: "rgba(10,10,10,0.95)", backdropFilter: "blur(20px)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 16, padding: "8px 8px 8px 18px", transition: "border-color 0.2s" }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Écris en n'importe quelle langue · Envoie 1 CELO à 0x... · Quel est le prix ?"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, fontFamily: "inherit" }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: loading || !input.trim() ? "#1a1a1a" : "linear-gradient(135deg, #FCFF52, #35D07F)",
                  color: loading || !input.trim() ? "#444" : "#000",
                  fontWeight: 700,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? "⏳" : "Envoyer ↗"}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#333", textAlign: "center" }}>
              Transactions sécurisées · Frais {"<"} $0.001 · Alimenté par Celo Mainnet & ERC-8004
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ width: 220, borderLeft: "1px solid #111", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
          
          <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em" }}>Réseau</div>
          
          <div style={{ padding: "14px", borderRadius: 12, background: "#0d1f14", border: "1px solid #1a3d24" }}>
            <div style={{ fontSize: 11, color: "#35D07F", fontWeight: 600, marginBottom: 8 }}>🟢 Celo Mainnet</div>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.8 }}>
              Chain ID: 42220<br />
              RPC: forno.celo.org<br />
              Explorer: celoscan.io
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: 12, background: "#1a1400", border: "1px solid #3d3000" }}>
            <div style={{ fontSize: 11, color: "#FCFF52", fontWeight: 600, marginBottom: 8 }}>⚡ Performance</div>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.8 }}>
              Block time: ~5s<br />
              Finality: instant<br />
              Gas: {"<"} $0.001
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: 12, background: "#0d0d1a", border: "1px solid #1a1a3d" }}>
            <div style={{ fontSize: 11, color: "#8888ff", fontWeight: 600, marginBottom: 8 }}>🤖 Agent Info</div>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.8 }}>
              Standard: ERC-8004<br />
              Model: Mistral 8B<br />
              Tools: 6 actifs
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: 12, background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, marginBottom: 8 }}>🌍 Impact</div>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.8 }}>
              1.4B non-bankés<br />
              25+ stablecoins<br />
              11M+ wallets MiniPay
            </div>
          </div>

          <a href="https://celoscan.io" target="_blank" rel="noreferrer" style={{ marginTop: "auto", padding: "10px", borderRadius: 10, background: "#0d0d0d", border: "1px solid #1a1a1a", color: "#555", fontSize: 12, textAlign: "center", textDecoration: "none", display: "block" }}>
            🔍 Voir sur CeloScan ↗
          </a>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
        * { scrollbar-width: thin; scrollbar-color: #1a1a1a #050505; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #050505; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 2px; }
      `}</style>
    </div>
  )
}