import { useState, useRef, useEffect } from "react"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

interface Message {
  role: "user" | "agent"
  content: string
  timestamp: Date
}

const QUICK_ACTIONS = [
  { label: "⬡ PRIX CELO", msg: "Quel est le prix du CELO en ce moment ?", color: "#00ff9f" },
  { label: "◈ SOLDE", msg: "Vérifie mon solde", color: "#00d4ff" },
  { label: "⟁ SWAP→cUSD", msg: "Échange 0.1 CELO contre des cUSD", color: "#ff006e" },
  { label: "◎ AAVE", msg: "Quelle est ma position sur Aave ?", color: "#ffbe0b" },
  { label: "⇾ ENVOYER", msg: "Je veux envoyer des CELO", color: "#8338ec" },
  { label: "◉ ÉPARGNER", msg: "Je veux déposer des cUSD sur Aave", color: "#00ff9f" },
]

const LANGUAGES = [
  { flag: "🇫🇷", code: "fr", label: "Français" },
  { flag: "🇬🇧", code: "en", label: "English" },
  { flag: "🇪🇸", code: "es", label: "Español" },
  { flag: "🇸🇦", code: "ar", label: "العربية" },
  { flag: "🇹🇿", code: "sw", label: "Swahili" },
  { flag: "🇮🇹", code: "it", label: "Italiano" },
  { flag: "🇵🇹", code: "pt", label: "Português" },
  { flag: "🇨🇳", code: "zh", label: "中文" },
]

const GLITCH_CHARS = "!<>-_\\/[]{}—=+*^?#@$%&"

function GlitchText({ text, className = "" }: { text: string; className?: string }) {
  const [display, setDisplay] = useState(text)
  const [glitching, setGlitching] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.97) {
        setGlitching(true)
        let iter = 0
        const glitch = setInterval(() => {
          setDisplay(text.split("").map((c, i) =>
            i < iter ? text[i] : GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          ).join(""))
          iter += 1
          if (iter > text.length) {
            clearInterval(glitch)
            setDisplay(text)
            setGlitching(false)
          }
        }, 40)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [text])

  return <span className={className} style={{ fontFamily: "'Courier New', monospace" }}>{display}</span>
}

function ScanLine() {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: "none", zIndex: 9999,
      background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,159,0.015) 2px, rgba(0,255,159,0.015) 4px)",
    }} />
  )
}

function CRTNoise() {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: "none", zIndex: 9998,
      background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)",
    }} />
  )
}

function HexGrid() {
  return (
    <svg style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none", zIndex: 0 }}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="hex" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
          <polygon points="30,2 58,17 58,35 30,50 2,35 2,17"
            fill="none" stroke="#00ff9f" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  )
}

function DataStream() {
  const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ"
  const cols = 20
  return (
    <div style={{ position: "fixed", top: 0, right: 0, width: 180, height: "100%", overflow: "hidden", opacity: 0.06, pointerEvents: "none", zIndex: 0 }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", top: 0, left: i * 9,
          fontSize: 10, color: "#00ff9f", fontFamily: "monospace",
          animation: `datafall ${2 + Math.random() * 4}s ${Math.random() * 2}s linear infinite`,
          whiteSpace: "nowrap",
          writingMode: "vertical-rl",
        }}>
          {Array.from({ length: 40 }).map(() => chars[Math.floor(Math.random() * chars.length)]).join("")}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: `> CELOBANK_AGENT_v2.0 INITIALIZED\n> CONNECTING TO CELO MAINNET...\n> STATUS: ONLINE ■■■■■■■■■■ 100%\n\nACCÈS À LA FINANCE DÉCENTRALISÉE POUR 1.4B DE NON-BANKÉS.\n\nSÉLECTIONNEZ UNE ACTION OU ENTREZ UNE COMMANDE.\nJE PARLE TOUTES LES LANGUES. 🌍`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [celoPrice, setCeloPrice] = useState<string | null>(null)
  const [priceTrend, setPriceTrend] = useState<"up" | "down" | null>(null)
  const [selectedLang, setSelectedLang] = useState<string | null>(null)
  const [blockNum, setBlockNum] = useState(Math.floor(Math.random() * 999999) + 25000000)
  const [pingMs, setPingMs] = useState(Math.floor(Math.random() * 20) + 5)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { address } = useAccount()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const interval = setInterval(() => {
      setBlockNum(b => b + 1)
      setPingMs(Math.floor(Math.random() * 20) + 5)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

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
        setCeloPrice("ERR")
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

    const langLabel = LANGUAGES.find(l => l.code === selectedLang)?.label
    const enrichedMsg = selectedLang ? `[Respond only in ${langLabel}] ${msg}` : msg

    try {
      const res = await fetch("https://celobank-agent-production.up.railway.app/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: enrichedMsg, userAddress: address || null }),
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
        content: "ERR_CONNECTION_FAILED: Impossible de joindre le serveur.",
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#020408", color: "#00ff9f",
      fontFamily: "'Courier New', 'Lucida Console', monospace",
      overflow: "hidden", position: "relative",
    }}>
      <ScanLine />
      <CRTNoise />
      <HexGrid />
      <DataStream />

      {/* ── HEADER ── */}
      <div style={{
        padding: "0 20px", height: 56, flexShrink: 0, zIndex: 10,
        display: "flex", alignItems: "center", gap: 16,
        background: "rgba(2,4,8,0.95)",
        borderBottom: "1px solid rgba(0,255,159,0.3)",
        boxShadow: "0 0 30px rgba(0,255,159,0.1), inset 0 -1px 0 rgba(0,255,159,0.2)",
      }}>
        {/* Logo */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%", overflow: "hidden",
            border: "2px solid #00ff9f",
            boxShadow: "0 0 15px rgba(0,255,159,0.6), inset 0 0 10px rgba(0,255,159,0.1)",
          }}>
            <img src="/logo.svg" alt="CeloBank" style={{ width: "100%", height: "100%", filter: "hue-rotate(90deg) brightness(1.2)" }} />
          </div>
          <div style={{
            position: "absolute", bottom: 0, right: 0, width: 10, height: 10,
            borderRadius: "50%", background: "#00ff9f",
            boxShadow: "0 0 8px #00ff9f", animation: "pulse 2s infinite",
          }} />
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.15em", color: "#00ff9f", textShadow: "0 0 10px rgba(0,255,159,0.8)" }}>
            <GlitchText text="CELOBANK_AGENT" />
          </div>
          <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.5, letterSpacing: "0.1em" }}>
            BLOCK #{blockNum.toLocaleString()} · {pingMs}ms · MAINNET
          </div>
        </div>

        {/* Price ticker */}
        <div style={{
          marginLeft: 12, padding: "5px 12px", borderRadius: 2,
          background: "rgba(0,255,159,0.05)",
          border: "1px solid rgba(0,255,159,0.3)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 9, color: "#00ff9f", opacity: 0.5, letterSpacing: "0.1em" }}>CELO/USD</span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: priceTrend === "up" ? "#00ff9f" : priceTrend === "down" ? "#ff006e" : "#00d4ff",
            textShadow: `0 0 8px ${priceTrend === "up" ? "#00ff9f" : priceTrend === "down" ? "#ff006e" : "#00d4ff"}`,
          }}>
            {celoPrice ? `$${celoPrice}` : "..."}
          </span>
          <span style={{ fontSize: 10, color: priceTrend === "up" ? "#00ff9f" : "#ff006e" }}>
            {priceTrend === "up" ? "▲" : priceTrend === "down" ? "▼" : ""}
          </span>
        </div>

        {/* Status pills */}
        <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
          {[
            { label: "GAS", val: "<$0.001", color: "#00ff9f" },
            { label: "ERC", val: "8004", color: "#00d4ff" },
            { label: "NET", val: "CELO", color: "#ffbe0b" },
          ].map((s, i) => (
            <div key={i} style={{
              padding: "3px 8px", borderRadius: 2, fontSize: 9, letterSpacing: "0.1em",
              background: `${s.color}10`, border: `1px solid ${s.color}40`,
              color: s.color, textShadow: `0 0 6px ${s.color}`,
            }}>
              {s.label}:{s.val}
            </div>
          ))}
        </div>

        <div style={{ marginLeft: "auto" }}>
          <ConnectButton />
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{
          width: 220, borderRight: "1px solid rgba(0,255,159,0.15)",
          padding: "16px 12px", display: "flex", flexDirection: "column", gap: 6,
          flexShrink: 0, overflowY: "auto", background: "rgba(0,255,159,0.02)",
        }}>
          <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.4, letterSpacing: "0.15em", marginBottom: 6, borderBottom: "1px solid rgba(0,255,159,0.1)", paddingBottom: 6 }}>
            // QUICK_ACTIONS
          </div>

          {QUICK_ACTIONS.map((action, i) => (
            <button key={i} onClick={() => sendMessage(action.msg)} style={{
              padding: "9px 12px", borderRadius: 2, cursor: "pointer",
              textAlign: "left", fontFamily: "inherit", fontSize: 11,
              letterSpacing: "0.05em", transition: "all 0.15s",
              background: `${action.color}08`,
              border: `1px solid ${action.color}30`,
              color: action.color,
              textShadow: `0 0 8px ${action.color}60`,
            }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.background = `${action.color}18`
                el.style.borderColor = `${action.color}80`
                el.style.boxShadow = `0 0 12px ${action.color}30, inset 0 0 12px ${action.color}08`
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.background = `${action.color}08`
                el.style.borderColor = `${action.color}30`
                el.style.boxShadow = "none"
              }}>
              {action.label}
            </button>
          ))}

          <div style={{ marginTop: 12, fontSize: 9, color: "#00ff9f", opacity: 0.4, letterSpacing: "0.15em", borderBottom: "1px solid rgba(0,255,159,0.1)", paddingBottom: 6 }}>
            // LANGUAGE_SELECT
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {LANGUAGES.map((lang) => (
              <div key={lang.code} onClick={() => setSelectedLang(selectedLang === lang.code ? null : lang.code)}
                title={lang.label} style={{
                  fontSize: 18, cursor: "pointer", transition: "all 0.2s",
                  opacity: selectedLang === null || selectedLang === lang.code ? 1 : 0.2,
                  filter: selectedLang === lang.code ? "drop-shadow(0 0 6px #00ff9f)" : "none",
                  transform: selectedLang === lang.code ? "scale(1.15)" : "scale(1)",
                  border: selectedLang === lang.code ? "1px solid #00ff9f40" : "1px solid transparent",
                  borderRadius: 3, padding: 2,
                }}>
                {lang.flag}
              </div>
            ))}
          </div>
          {selectedLang && (
            <div style={{ fontSize: 9, color: "#00ff9f", letterSpacing: "0.1em", opacity: 0.7 }}>
              ▶ {LANGUAGES.find(l => l.code === selectedLang)?.label.toUpperCase()}
            </div>
          )}

          <div style={{ marginTop: "auto", padding: "10px", borderRadius: 2, background: "rgba(0,255,159,0.04)", border: "1px solid rgba(0,255,159,0.15)" }}>
            <div style={{ fontSize: 9, color: "#00ff9f", letterSpacing: "0.1em", marginBottom: 4, opacity: 0.7 }}>⬡ ERC-8004 IDENTITY</div>
            <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.35, lineHeight: 1.8, letterSpacing: "0.05em" }}>
              AGENT REGISTERED<br />ON-CHAIN VERIFIABLE<br />CELO MAINNET
            </div>
          </div>
        </div>

        {/* ── CHAT ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Terminal header bar */}
          <div style={{
            padding: "6px 20px", borderBottom: "1px solid rgba(0,255,159,0.1)",
            background: "rgba(0,255,159,0.02)", display: "flex", alignItems: "center", gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 9, color: "#00ff9f", opacity: 0.4, letterSpacing: "0.1em" }}>
              TERMINAL://celobank/chat — {messages.length} MSGS
            </span>
            <span style={{ marginLeft: "auto", fontSize: 9, color: "#00ff9f", opacity: 0.3 }}>
              {address ? `WALLET: ${address.slice(0, 6)}...${address.slice(-4)}` : "WALLET: NOT_CONNECTED"}
            </span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 10 }}>

                {msg.role === "agent" && (
                  <div style={{
                    width: 28, height: 28, borderRadius: 2, flexShrink: 0,
                    border: "1px solid #00ff9f40", overflow: "hidden",
                    boxShadow: "0 0 10px rgba(0,255,159,0.3)",
                  }}>
                    <img src="/logo.svg" alt="Agent" style={{ width: "100%", height: "100%", filter: "hue-rotate(90deg)" }} />
                  </div>
                )}

                <div style={{ maxWidth: "70%" }}>
                  <div style={{ fontSize: 8, letterSpacing: "0.1em", marginBottom: 4, opacity: 0.4, color: msg.role === "user" ? "#00d4ff" : "#00ff9f" }}>
                    {msg.role === "agent" ? "CELOBANK_AI" : `USER_${address ? address.slice(-4).toUpperCase() : "ANON"}`} · {msg.timestamp.toLocaleTimeString()}
                  </div>
                  <div style={{
                    padding: "12px 16px", borderRadius: 2,
                    background: msg.role === "user"
                      ? "rgba(0,212,255,0.06)"
                      : "rgba(0,255,159,0.04)",
                    border: msg.role === "user"
                      ? "1px solid rgba(0,212,255,0.3)"
                      : "1px solid rgba(0,255,159,0.2)",
                    boxShadow: msg.role === "user"
                      ? "0 0 15px rgba(0,212,255,0.1)"
                      : "0 0 15px rgba(0,255,159,0.08)",
                    fontSize: 13, lineHeight: 1.8,
                    color: msg.role === "user" ? "#00d4ff" : "#00ff9f",
                    whiteSpace: "pre-wrap",
                    fontFamily: "'Courier New', monospace",
                    textShadow: msg.role === "user" ? "0 0 6px rgba(0,212,255,0.3)" : "0 0 6px rgba(0,255,159,0.2)",
                  }}>
                    {msg.role === "agent" && <span style={{ opacity: 0.4 }}>{">"} </span>}
                    {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
                  </div>
                </div>

                {msg.role === "user" && (
                  <div style={{
                    width: 28, height: 28, borderRadius: 2, flexShrink: 0,
                    background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "#00d4ff",
                    boxShadow: "0 0 10px rgba(0,212,255,0.3)",
                  }}>USR</div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 2, overflow: "hidden",
                  border: "1px solid #00ff9f40", boxShadow: "0 0 10px rgba(0,255,159,0.3)",
                }}>
                  <img src="/logo.svg" alt="Agent" style={{ width: "100%", height: "100%", filter: "hue-rotate(90deg)" }} />
                </div>
                <div style={{
                  padding: "12px 16px", borderRadius: 2,
                  background: "rgba(0,255,159,0.04)", border: "1px solid rgba(0,255,159,0.2)",
                  fontSize: 12, color: "#00ff9f", letterSpacing: "0.1em",
                }}>
                  <span style={{ animation: "blink 1s infinite" }}>PROCESSING</span>
                  <span style={{ opacity: 0.4 }}> ■■■■■■■■</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(0,255,159,0.15)", background: "rgba(0,0,0,0.5)", flexShrink: 0 }}>
            <div style={{
              display: "flex", gap: 8, alignItems: "center",
              background: "rgba(0,255,159,0.03)",
              border: "1px solid rgba(0,255,159,0.3)",
              borderRadius: 2, padding: "8px 12px",
              boxShadow: "0 0 20px rgba(0,255,159,0.08), inset 0 0 20px rgba(0,255,159,0.02)",
            }}>
              <span style={{ fontSize: 12, color: "#00ff9f", opacity: 0.5 }}>{">"}_</span>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="ENTER COMMAND // TOUTES LANGUES SUPPORTÉES //"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "#00ff9f", fontSize: 13, fontFamily: "inherit",
                  caretColor: "#00ff9f", letterSpacing: "0.02em",
                }}
              />
              
              <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
  padding: "8px 16px", borderRadius: 2, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
  background: loading || !input.trim() ? "rgba(0,255,159,0.05)" : "rgba(0,255,159,0.15)",
  color: loading || !input.trim() ? "rgba(0,255,159,0.2)" : "#00ff9f",
  fontFamily: "inherit", fontSize: 11, letterSpacing: "0.1em", fontWeight: 700,
  border: `1px solid ${loading || !input.trim() ? "rgba(0,255,159,0.1)" : "rgba(0,255,159,0.5)"}`,
  boxShadow: loading || !input.trim() ? "none" : "0 0 12px rgba(0,255,159,0.2)",
  transition: "all 0.2s",
}}>
                {loading ? "WAIT..." : "EXEC ▶"}
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: "#00ff9f", opacity: 0.2, letterSpacing: "0.08em", textAlign: "center" }}>
              ENCRYPTED · GAS &lt;$0.001 · CELO_MAINNET_42220 · ERC-8004
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{
          width: 200, borderLeft: "1px solid rgba(0,255,159,0.15)",
          padding: "16px 12px", display: "flex", flexDirection: "column", gap: 10,
          flexShrink: 0, background: "rgba(0,255,159,0.02)",
        }}>
          <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.4, letterSpacing: "0.15em", borderBottom: "1px solid rgba(0,255,159,0.1)", paddingBottom: 6 }}>
            // NETWORK_STATUS
          </div>

          {[
            { label: "CHAIN", val: "CELO", sub: "ID:42220", color: "#00ff9f" },
            { label: "RPC", val: "ONLINE", sub: "forno.celo.org", color: "#00ff9f" },
            { label: "LATENCY", val: `${pingMs}ms`, sub: "REALTIME", color: "#ffbe0b" },
            { label: "BLOCK", val: `#${(blockNum % 100000).toString().padStart(5, "0")}`, sub: "~5s FINALITY", color: "#00d4ff" },
          ].map((item, i) => (
            <div key={i} style={{
              padding: "10px", borderRadius: 2,
              background: `${item.color}06`, border: `1px solid ${item.color}20`,
            }}>
              <div style={{ fontSize: 8, color: item.color, opacity: 0.5, letterSpacing: "0.1em" }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: item.color, textShadow: `0 0 8px ${item.color}` }}>{item.val}</div>
              <div style={{ fontSize: 8, color: item.color, opacity: 0.35, letterSpacing: "0.05em" }}>{item.sub}</div>
            </div>
          ))}

          <div style={{ padding: "10px", borderRadius: 2, background: "rgba(131,56,236,0.06)", border: "1px solid rgba(131,56,236,0.2)" }}>
            <div style={{ fontSize: 8, color: "#8338ec", opacity: 0.7, letterSpacing: "0.1em", marginBottom: 4 }}>AI_MODEL</div>
            <div style={{ fontSize: 10, color: "#8338ec", lineHeight: 1.8, letterSpacing: "0.05em", opacity: 0.8 }}>
              MISTRAL_8B<br />TOOLS:6_ACTIVE<br />ERC-8004_STD
            </div>
          </div>

          <div style={{ padding: "10px", borderRadius: 2, background: "rgba(255,190,11,0.06)", border: "1px solid rgba(255,190,11,0.2)" }}>
            <div style={{ fontSize: 8, color: "#ffbe0b", opacity: 0.7, letterSpacing: "0.1em", marginBottom: 4 }}>IMPACT</div>
            <div style={{ fontSize: 10, color: "#ffbe0b", lineHeight: 1.8, letterSpacing: "0.05em", opacity: 0.8 }}>
              1.4B UNBANKED<br />25+ STABLES<br />11M+ MINIPAY
            </div>
          </div>

          <a href="https://celoscan.io" target="_blank" rel="noreferrer" style={{
            marginTop: "auto", padding: "8px", borderRadius: 2,
            background: "rgba(0,255,159,0.04)", border: "1px solid rgba(0,255,159,0.2)",
            color: "#00ff9f", fontSize: 9, textAlign: "center", textDecoration: "none",
            letterSpacing: "0.1em", display: "block",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,159,0.2)" }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "none" }}
          >
            ⬡ CELOSCAN_EXPLORER ↗
          </a>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 8px #00ff9f; } 50% { opacity: 0.4; box-shadow: 0 0 3px #00ff9f; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes datafall { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        * { scrollbar-width: thin; scrollbar-color: rgba(0,255,159,0.2) transparent; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,159,0.2); border-radius: 0; }
        input::placeholder { color: rgba(0,255,159,0.2); letter-spacing: 0.05em; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}