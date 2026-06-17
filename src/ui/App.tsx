import { useState, useRef, useEffect, useCallback } from "react"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useConnect, useWalletClient, usePublicClient } from 'wagmi'
import { sdk } from '@farcaster/miniapp-sdk'
import { encodeFunctionData, parseEther, createWalletClient, custom } from "viem"
import { celo } from "viem/chains"

// ─── DailyDrop Constants ──────────────────────────────────────────────────────
const DAILYDROP_CELO = "0x63596cf6601ec2240A295ff2840C8d6653252AE6" as `0x${string}`
const FEE_RECEIVER   = "0xDEAcDe6eC27Fd0cD972c1232C4f0d4171dda2357" as `0x${string}`
const CHECK_IN_FEE   = parseEther("0.001")
// cUSD on Celo mainnet — used as feeCurrency for gas in MiniPay
const CUSD_ADDRESS   = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`
const DAILYDROP_ABI  = [
  { name: "checkIn",     type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { name: "claimReward", type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { name: "getUserData", type: "function", inputs: [{ internalType: "address", name: "_user", type: "address" }],
    outputs: [
      { internalType: "uint256", name: "streak",        type: "uint256" },
      { internalType: "uint256", name: "lastCheckIn",   type: "uint256" },
      { internalType: "uint256", name: "totalCheckIns", type: "uint256" },
      { internalType: "bool",    name: "canCheckIn",    type: "bool"    },
      { internalType: "bool",    name: "canClaim",      type: "bool"    },
      { internalType: "uint256", name: "nextCheckIn",   type: "uint256" },
    ], stateMutability: "view" },
] as const

interface StreakData {
  current: number; best: number; total: number
  canCheckIn: boolean; canClaim: boolean; nextCheckIn: number
}
interface Message   { role: "user" | "agent"; content: string; timestamp: Date }
interface UnsignedTx { to: `0x${string}`; data: `0x${string}`; value?: string; chainId: number; description: string }
interface PrepareResult { success: boolean; action: string; userAddress: string; transactions: UnsignedTx[]; summary: string; error?: string }
interface SelfAgentStatus { registered: boolean; isVerified?: boolean; agentId?: string; agentAddress?: string; network?: string; ownerAddress?: string }

const QUICK_ACTIONS = [
  { label: "⬡ PRIX CELO",  msg: "Quel est le prix du CELO en ce moment ?",  color: "#00ff9f" },
  { label: "◈ SOLDE",      msg: "Vérifie mon solde",                          color: "#00d4ff" },
  { label: "⟁ SWAP→cUSD", msg: "swap 0.1 CELO to cUSD",                      color: "#ff006e" },
  { label: "◎ AAVE",       msg: "Quelle est ma position sur Aave ?",          color: "#ffbe0b" },
  { label: "⇾ ENVOYER",   msg: "Je veux envoyer des CELO",                   color: "#8338ec" },
  { label: "◉ ÉPARGNER",  msg: "save 1 cUSD",                                color: "#00ff9f" },
  { label: "🔒 STAKE",     msg: "stake 1 CELO",                               color: "#00d4ff" },
  { label: "💡 IDEAS",     msg: "trade ideas",                                color: "#ffbe0b" },
  { label: "▶ CHECK_IN",  msg: "__CHECKIN__",                                 color: "#ffd700" },
  { label: "🚀 LAUNCH",   msg: "launch token",                                color: "#ff6b9d" },
  { label: "🌱 G$",      msg: "check my GoodDollar G$ balance and verification status", color: "#4ade80" },
]

const BOTTOM_NAV = [
  { icon: "◈", label: "PORTFOLIO", msg: "Vérifie mon solde",   color: "#00d4ff" },
  { icon: "⟁", label: "SWAP",      msg: "swap 0.1 CELO to cUSD", color: "#ff006e" },
  { icon: "🔒", label: "STAKE",    msg: "stake 1 CELO",          color: "#00d4ff" },
  { icon: "▶", label: "CHECK_IN", msg: "__CHECKIN__",            color: "#ffd700" },
  { icon: "🚀", label: "LAUNCH",  msg: "launch token",           color: "#ff6b9d" },
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
  { flag: "🇮🇳", code: "hi", label: "हिंदी" },
  { flag: "🇧🇩", code: "bn", label: "বাংলা" },
  { flag: "🇳🇬", code: "yo", label: "Yorùbá" },
  { flag: "🇳🇬", code: "ha", label: "Hausa" },
  { flag: "🇪🇹", code: "am", label: "አማርኛ" },
  { flag: "🇮🇩", code: "id", label: "Indonesia" },
  { flag: "🇩🇪", code: "de", label: "Deutsch" },
  { flag: "🇷🇺", code: "ru", label: "Русский" },
  { flag: "🇹🇷", code: "tr", label: "Türkçe" },
  { flag: "🇻🇳", code: "vi", label: "Tiếng Việt" },
  { flag: "🇵🇭", code: "tl", label: "Filipino" },
]

const GLITCH_CHARS = "!<>-_\\/[]{}—=+*^?#@$%&"

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return width
}

function detectMiniPay(): boolean {
  if (typeof window === "undefined") return false
  return !!((window as any).ethereum?.isMiniPay)
}

// In MiniPay, wagmi's walletClient hook often stays null because the injected
// provider is recognized but the wagmi connector doesn't fully hydrate inside
// MiniPay's webview. Create a walletClient directly from window.ethereum instead.
function getMiniPayWalletClient(address: `0x${string}`) {
  return createWalletClient({
    account: address,
    chain: celo,
    transport: custom((window as any).ethereum),
  })
}

function parseSupply(raw: string): string {
  if (typeof raw !== 'string') return '0'
  const s = raw.replace(/,/g, "").trim()
  const n = parseFloat(s)
  if (isNaN(n)) return s
  const suffix = s.slice(-1).toLowerCase()
  if (suffix === "k") return String(Math.round(n * 1_000))
  if (suffix === "m") return String(Math.round(n * 1_000_000))
  if (suffix === "b") return String(Math.round(n * 1_000_000_000))
  const millionMatch = s.match(/([\d.]+)\s*million/i)
  if (millionMatch) return String(Math.round(parseFloat(millionMatch[1]) * 1_000_000))
  return String(Math.round(n))
}

function detectDeFiAction(msg: string): { action: string; params: Record<string, string> } | null {
  if (typeof msg !== 'string') return null
  const m = msg.toLowerCase().trim()

  // Launch token: requires name, symbol, and supply all present in the message
  // e.g. "launch a token called SunCoin symbol SUN supply 1000000"
  //      "create token SunCoin SUN 1000000"
  //      "deploy new token named GoldCoin ticker GLD 500000"
  // Launch token: if the message has a launch verb + "token", it owns this branch entirely.
  // Never fall through to supply_aave — "supply" in "1000000 supply" is a launch param, not a deposit.
  const isLaunchIntent = /(?:launch|create|deploy|lancer|créer)/i.test(msg) && /\btoken\b/i.test(msg)
  if (isLaunchIntent) {
    const nameMatch   = msg.match(/(?:(?:called|named|appelé|nommé)\s+|:\s*)([A-Za-z][A-Za-z0-9 ]{1,28}?)(?:\s*,|\s+symbol|\s+ticker|\s+sym\b|\s+supply|\s+total)/i)
    const symbolMatch = msg.match(/(?:symbol|ticker|sym)[:\s]+([A-Za-z][A-Za-z0-9]{0,10})/i)
    const supplyMatch = msg.match(/(?:supply|total(?:\s+supply)?)[:\s]+([\d,.]+[kmb]?(?:\s*million)?)/i)
                     ?? msg.match(/([\d,.]+[kmb]?(?:\s*million)?)\s+(?:supply|tokens?)/i)
    if (nameMatch && symbolMatch && supplyMatch) {
      return {
        action: "launch_token",
        params: {
          name:        nameMatch[1].trim(),
          symbol:      symbolMatch[1].trim().toUpperCase(),
          totalSupply: parseSupply(supplyMatch[1]),
        },
      }
    }
    return null  // launch intent but params incomplete — let the AI agent ask for details
  }

  const swapMatch = m.match(/(?:swap|échange|swapper|échanger|convertir)\s+([\d.]+)\s+(\w+)\s+(?:to|vers|contre|en|→|->)\s+(\w+)/i)
  if (swapMatch) return { action: "swap", params: { amount: swapMatch[1], tokenIn: swapMatch[2].toUpperCase(), tokenOut: swapMatch[3].toUpperCase() } }
  const saveMatch = m.match(/(?:save|épargner|déposer|deposit|supply)\s+([\d.]+)(?:\s+(\w+))?/i)
  if (saveMatch) return { action: "supply_aave", params: { amount: saveMatch[1], asset: (saveMatch[2] || "cUSD").toUpperCase() } }
  const sendMatch = m.match(/(?:send|envoie|envoyer|transfer)\s+([\d.]+)\s+celo\s+(?:to|à|a)\s+(0x[a-f0-9]{40})/i)
  if (sendMatch) return { action: "send", params: { amount: sendMatch[1], to: sendMatch[2] } }
  const stakeMatch = m.match(/(?:stake|staker|staking)\s+([\d.]+)/i)
  if (stakeMatch) return { action: "stake", params: { amount: stakeMatch[1] } }
  return null
}

// ─── Helper Components ────────────────────────────────────────────────────────
function GlitchText({ text, className = "" }: { text: string; className?: string }) {
  const [display, setDisplay] = useState(text)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.97) {
        let iter = 0
        const glitch = setInterval(() => {
          setDisplay(text.split("").map((c, i) =>
            i < iter ? text[i] : GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          ).join(""))
          iter += 1
          if (iter > text.length) { clearInterval(glitch); setDisplay(text) }
        }, 40)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [text])
  return <span className={className} style={{ fontFamily: "'Courier New', monospace" }}>{display}</span>
}

function ScanLine() {
  return <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 9999, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,159,0.012) 2px, rgba(0,255,159,0.012) 4px)" }} />
}

function CRTNoise() {
  return <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 9998, background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)" }} />
}

function HexGrid() {
  return (
    <svg style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.035, pointerEvents: "none", zIndex: 0 }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="hex" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
          <polygon points="30,2 58,17 58,35 30,50 2,35 2,17" fill="none" stroke="#00ff9f" strokeWidth="0.5" />
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
    <div style={{ position: "fixed", top: 0, right: 0, width: 180, height: "100%", overflow: "hidden", opacity: 0.05, pointerEvents: "none", zIndex: 0 }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} style={{ position: "absolute", top: 0, left: i * 9, fontSize: 10, color: "#00ff9f", fontFamily: "monospace", animation: `datafall ${2 + (i % 4)}s ${(i % 3) * 0.7}s linear infinite`, whiteSpace: "nowrap", writingMode: "vertical-rl" }}>
          {Array.from({ length: 40 }).map((_, j) => chars[(i * 7 + j) % chars.length]).join("")}
        </div>
      ))}
    </div>
  )
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", marginLeft: 4 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#00ff9f", display: "inline-block", animation: `dotBounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
      ))}
    </span>
  )
}

function MiniPayBanner() {
  return (
    <div style={{ padding: "6px 16px", background: "rgba(53,208,127,0.1)", borderBottom: "1px solid rgba(53,208,127,0.35)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, zIndex: 10 }}>
      <span style={{ fontSize: 13 }}>📱</span>
      <span style={{ fontSize: 10, color: "#35D07F", letterSpacing: "0.1em", fontWeight: 700 }}>MINIPAY DETECTED — WALLET AUTO-CONNECTED · GAS IN cUSD</span>
      <span style={{ marginLeft: "auto", fontSize: 9, color: "#35D07F", opacity: 0.5 }}>15M+ USERS</span>
    </div>
  )
}

function FarcasterBanner({ username }: { username?: string }) {
  return (
    <div style={{ padding: "6px 16px", background: "rgba(139,92,246,0.1)", borderBottom: "1px solid rgba(139,92,246,0.35)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, zIndex: 10 }}>
      <span style={{ fontSize: 13 }}>🟣</span>
      <span style={{ fontSize: 10, color: "#a78bfa", letterSpacing: "0.08em", fontWeight: 700 }}>
        FARCASTER MINI APP{username ? ` · @${username.toUpperCase()}` : " — WALLET AUTO-CONNECTED"}
      </span>
      <span style={{ marginLeft: "auto", fontSize: 9, color: "#a78bfa", opacity: 0.5 }}>WARPCAST</span>
    </div>
  )
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────
const BASE_CSS = `
  @keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 8px #00ff9f; } 50% { opacity: 0.5; box-shadow: 0 0 3px #00ff9f; } }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
  @keyframes datafall { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
  @keyframes slideInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes dotBounce { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
  @keyframes spinnerRotate { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,255,159,0.2); border-radius: 0; }
  * { scrollbar-width: thin; scrollbar-color: rgba(0,255,159,0.2) transparent; }
  input::placeholder { color: rgba(0,255,159,0.22); letter-spacing: 0.05em; }
`

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, address, isFarcaster, isMiniPay, farcasterUser, compact = false }:
  { msg: Message; address?: string; isFarcaster: boolean; isMiniPay: boolean; farcasterUser: { username?: string } | null; compact?: boolean }) {
  const isAgent = msg.role === "agent"
  const avatarSize = compact ? 24 : 30
  return (
    <div style={{ display: "flex", justifyContent: isAgent ? "flex-start" : "flex-end", alignItems: "flex-start", gap: compact ? 8 : 10, animation: "slideInUp 0.22s ease both" }}>
      {isAgent && (
        <div style={{ width: avatarSize, height: avatarSize, borderRadius: 3, flexShrink: 0, border: "1px solid rgba(0,255,159,0.3)", overflow: "hidden", boxShadow: "0 0 8px rgba(0,255,159,0.15)" }}>
          <img src="/logo.svg" alt="Agent" style={{ width: "100%", height: "100%", filter: "hue-rotate(90deg)" }} />
        </div>
      )}
      <div style={{ maxWidth: compact ? "82%" : "72%" }}>
        <div style={{ fontSize: 7, letterSpacing: "0.1em", marginBottom: compact ? 3 : 4, opacity: 0.4, color: isAgent ? "#00ff9f" : "#00d4ff" }}>
          {isAgent ? "CELOBANK_AI" : `USER_${address ? address.slice(-4).toUpperCase() : "ANON"}`} · {msg.timestamp.toLocaleTimeString()}
        </div>
        <div style={{
          padding: compact ? "9px 12px" : "12px 16px",
          borderRadius: 3,
          background: isAgent ? "rgba(0,255,159,0.05)" : "rgba(0,212,255,0.07)",
          border: isAgent ? "1px solid rgba(0,255,159,0.22)" : "1px solid rgba(0,212,255,0.32)",
          fontSize: compact ? 12 : 13,
          lineHeight: 1.85,
          color: isAgent ? "#e0fff0" : "#b0eeff",
          whiteSpace: "pre-wrap",
          fontFamily: "'Courier New', monospace",
          boxShadow: isAgent ? "0 2px 12px rgba(0,255,159,0.06)" : "0 2px 12px rgba(0,212,255,0.06)",
        }}>
          {isAgent && <span style={{ opacity: 0.35, marginRight: 4 }}>{">"}</span>}
          {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
        </div>
      </div>
      {!isAgent && (
        <div style={{ width: avatarSize, height: avatarSize, borderRadius: 3, flexShrink: 0, background: isFarcaster ? "rgba(139,92,246,0.12)" : "rgba(0,212,255,0.1)", border: isFarcaster ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(0,212,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: compact ? 9 : 10, fontWeight: 700, color: isFarcaster ? "#a78bfa" : "#00d4ff" }}>
          {isMiniPay ? "📱" : isFarcaster ? "🟣" : "USR"}
        </div>
      )}
    </div>
  )
}

// ─── Quick Action Button ──────────────────────────────────────────────────────
function QBtn({ action, onClick, small = false }: { action: typeof QUICK_ACTIONS[0]; onClick: () => void; small?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: small ? "6px 10px" : "9px 12px",
        borderRadius: 3,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "'Courier New', monospace",
        fontSize: small ? 10 : 11,
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "all 0.18s ease",
        background: hovered ? `${action.color}1a` : `${action.color}09`,
        border: `1px solid ${hovered ? action.color + "70" : action.color + "30"}`,
        color: action.color,
        boxShadow: hovered ? `0 0 12px ${action.color}22` : "none",
        transform: hovered ? "translateY(-1px)" : "none",
      }}>
      {action.label}
    </button>
  )
}

// ─── Input Bar ────────────────────────────────────────────────────────────────
function InputBar({ value, onChange, onSend, loading, compact = false }: {
  value: string; onChange: (v: string) => void; onSend: () => void; loading: boolean; compact?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const canSend = !loading && value.trim().length > 0
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "center",
      background: focused ? "rgba(0,255,159,0.05)" : "rgba(0,255,159,0.025)",
      border: `1px solid ${focused ? "rgba(0,255,159,0.5)" : "rgba(0,255,159,0.25)"}`,
      borderRadius: 3,
      padding: compact ? "7px 10px" : "9px 14px",
      transition: "all 0.2s ease",
      boxShadow: focused ? "0 0 20px rgba(0,255,159,0.08)" : "none",
    }}>
      <span style={{ fontSize: compact ? 11 : 12, color: "#00ff9f", opacity: focused ? 0.7 : 0.35 }}>{">"}_</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && !e.shiftKey && onSend()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={compact ? "Commande..." : "ENTER COMMAND // ALL LANGUAGES SUPPORTED //"}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#00ff9f", fontSize: compact ? 13 : 13, fontFamily: "'Courier New', monospace", caretColor: "#00ff9f", letterSpacing: "0.02em" }}
      />
      <button
        onClick={onSend}
        disabled={!canSend}
        style={{
          padding: compact ? "5px 11px" : "7px 16px",
          borderRadius: 3,
          cursor: canSend ? "pointer" : "not-allowed",
          background: canSend ? "rgba(0,255,159,0.18)" : "rgba(0,255,159,0.04)",
          color: canSend ? "#00ff9f" : "rgba(0,255,159,0.2)",
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          letterSpacing: "0.12em",
          fontWeight: 700,
          border: `1px solid ${canSend ? "rgba(0,255,159,0.55)" : "rgba(0,255,159,0.1)"}`,
          transition: "all 0.18s ease",
          boxShadow: canSend ? "0 0 10px rgba(0,255,159,0.15)" : "none",
        }}>
        {loading ? "···" : compact ? "▶" : "EXEC ▶"}
      </button>
    </div>
  )
}

// ─── Sidebar Content (shared between desktop and tablet drawer) ───────────────
function LeftSidebarContent({ actions, selectedLang, setSelectedLang, streak, checking, claiming, doClaimReward, sendMessage, address, messages, selfAgentStatus, onStartVerification }: any) {
  const isOwner = address && selfAgentStatus?.ownerAddress &&
    address.toLowerCase() === selfAgentStatus.ownerAddress.toLowerCase()
  const selfVerified = selfAgentStatus?.registered && selfAgentStatus?.isVerified

  return (
    <>
      <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.35, letterSpacing: "0.15em", marginBottom: 8, borderBottom: "1px solid rgba(0,255,159,0.1)", paddingBottom: 6 }}>// QUICK_ACTIONS</div>
      {actions.map((action: any, i: number) => (
        <QBtn key={i} action={action} onClick={() => sendMessage(action.msg)} />
      ))}
      <div style={{ marginTop: 14, fontSize: 9, color: "#00ff9f", opacity: 0.35, letterSpacing: "0.15em", borderBottom: "1px solid rgba(0,255,159,0.1)", paddingBottom: 6, marginBottom: 8 }}>// LANGUAGE_SELECT</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {LANGUAGES.map(lang => (
          <div key={lang.code} onClick={() => setSelectedLang(selectedLang === lang.code ? null : lang.code)} title={lang.label}
            style={{ fontSize: 18, cursor: "pointer", opacity: selectedLang === null || selectedLang === lang.code ? 1 : 0.2, padding: 2, borderRadius: 3, transition: "opacity 0.15s" }}>
            {lang.flag}
          </div>
        ))}
      </div>
      {selectedLang && <div style={{ fontSize: 9, color: "#00ff9f", letterSpacing: "0.1em", opacity: 0.6, marginTop: 4 }}>▶ {LANGUAGES.find(l => l.code === selectedLang)?.label.toUpperCase()}</div>}
      <div style={{ marginTop: 12, padding: "10px", borderRadius: 3, background: "rgba(0,255,159,0.04)", border: "1px solid rgba(0,255,159,0.13)" }}>
        <div style={{ fontSize: 9, color: "#00ff9f", letterSpacing: "0.1em", marginBottom: 4, opacity: 0.65 }}>⬡ ERC-8004 IDENTITY</div>
        <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.3, lineHeight: 1.9 }}>AGENT REGISTERED<br />ON-CHAIN VERIFIABLE<br />CELO MAINNET</div>
      </div>
      <div style={{ padding: "10px", borderRadius: 3, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}>
        <div style={{ fontSize: 9, color: "#6366f1", letterSpacing: "0.1em", marginBottom: 4 }}>🔐 SELF AGENT ID</div>
        {selfVerified
          ? <div style={{ fontSize: 9, color: "#6366f1", opacity: 0.8, lineHeight: 1.9 }}>VERIFIED ✓<br />ZK_PROOF_ONCHAIN<br />ID #{selfAgentStatus?.agentId}</div>
          : <div style={{ fontSize: 9, color: "#6366f1", opacity: 0.55, lineHeight: 1.9 }}>NOT_YET_VERIFIED<br />INTEGRATION<br />IN_PROGRESS</div>
        }
        {isOwner && !selfVerified && onStartVerification && (
          <button onClick={onStartVerification} style={{ marginTop: 6, width: "100%", padding: "5px", borderRadius: 3, fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em", cursor: "pointer", background: "rgba(99,102,241,0.14)", border: "1px solid rgba(99,102,241,0.45)", color: "#6366f1", transition: "all 0.18s" }}>
            ▶ START VERIFICATION
          </button>
        )}
      </div>
      {address && (
        <div style={{ padding: "10px", borderRadius: 3, background: "rgba(0,255,159,0.03)", border: "1px solid rgba(0,255,159,0.18)" }}>
          <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.5, letterSpacing: "0.1em", marginBottom: 4 }}>🔓 NON-CUSTODIAL</div>
          <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.35, lineHeight: 1.9 }}>YOU SIGN YOUR TX<br />AGENT NEVER HOLDS<br />YOUR FUNDS</div>
        </div>
      )}
      {address && (
        <div style={{ marginTop: 4, padding: "10px", borderRadius: 3, background: streak.canCheckIn ? "rgba(255,215,0,0.06)" : "rgba(0,255,159,0.03)", border: streak.canCheckIn ? "1px solid rgba(255,215,0,0.28)" : "1px solid rgba(0,255,159,0.15)" }}>
          <div style={{ fontSize: 9, color: streak.canCheckIn ? "#ffd700" : "#00ff9f", letterSpacing: "0.1em", marginBottom: 6 }}>🔥 DAILY_STREAK</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: streak.canCheckIn ? "#ffd700" : "#00ff9f", marginBottom: 3, letterSpacing: "-0.02em" }}>{streak.current}<span style={{ fontSize: 11, opacity: 0.5 }}>d</span></div>
          <div style={{ fontSize: 8, color: "#445", marginBottom: 8, opacity: 0.7 }}>Best: {streak.best}d · Total: {streak.total}</div>
          {streak.canClaim && (
            <button onClick={() => { doClaimReward() }}
              disabled={claiming}
              style={{ width: "100%", padding: "6px", borderRadius: 3, fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", cursor: "pointer", background: "rgba(0,255,159,0.14)", border: "1px solid rgba(0,255,159,0.45)", color: "#00ff9f", marginBottom: 5, transition: "all 0.18s" }}>
              {claiming ? "···" : "🎁 CLAIM DROP"}
            </button>
          )}
          <button onClick={() => sendMessage("__CHECKIN__")} disabled={!streak.canCheckIn || checking}
            style={{ width: "100%", padding: "6px", borderRadius: 3, fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em", cursor: streak.canCheckIn ? "pointer" : "default", background: streak.canCheckIn ? "rgba(255,215,0,0.12)" : "rgba(0,255,159,0.04)", border: streak.canCheckIn ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(0,255,159,0.12)", color: streak.canCheckIn ? "#ffd700" : "rgba(0,255,159,0.25)", transition: "all 0.18s" }}>
            {checking ? "CONFIRMING···" : streak.canCheckIn ? "▶ CHECK_IN · 0.001Ξ" : "✓ DONE TODAY"}
          </button>
        </div>
      )}
    </>
  )
}

// ─── PriceBadge (outside App — stable component identity, no remount on App re-render) ──
function PriceBadge({ celoPrice, priceTrend }: { celoPrice: string | null; priceTrend: "up" | "down" | null }) {
  const color = priceTrend === "up" ? "#00ff9f" : priceTrend === "down" ? "#ff4d6d" : "#00d4ff"
  return (
    <div style={{ padding: "4px 10px", borderRadius: 3, background: "rgba(0,255,159,0.05)", border: "1px solid rgba(0,255,159,0.25)", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 9, color: "#00ff9f", opacity: 0.45 }}>CELO</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: "-0.01em" }}>{celoPrice ? `$${celoPrice}` : "···"}</span>
      {priceTrend && <span style={{ fontSize: 9, color }}>{priceTrend === "up" ? "▲" : "▼"}</span>}
    </div>
  )
}

// ─── ChatMessages (outside App — stable component identity, prevents message re-animation) ──
function ChatMessages({ messages, loading, address, isFarcaster, isMiniPay, farcasterUser, bottomRef, compact = false }: {
  messages: Message[]; loading: boolean; address?: string; isFarcaster: boolean; isMiniPay: boolean
  farcasterUser: { fid?: number; username?: string } | null; bottomRef: React.RefObject<HTMLDivElement | null>; compact?: boolean
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: compact ? "12px" : "20px", display: "flex", flexDirection: "column", gap: compact ? 12 : 16 }}>
      {messages.map((msg, i) => (
        <MessageBubble key={i} msg={msg} address={address} isFarcaster={isFarcaster} isMiniPay={isMiniPay} farcasterUser={farcasterUser} compact={compact} />
      ))}
      {loading && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: compact ? 8 : 10, animation: "fadeIn 0.2s ease" }}>
          <div style={{ width: compact ? 24 : 30, height: compact ? 24 : 30, borderRadius: 3, overflow: "hidden", border: "1px solid rgba(0,255,159,0.3)", flexShrink: 0 }}>
            <img src="/logo.svg" alt="Agent" style={{ width: "100%", height: "100%", filter: "hue-rotate(90deg)" }} />
          </div>
          <div style={{ padding: compact ? "9px 12px" : "12px 16px", borderRadius: 3, background: "rgba(0,255,159,0.05)", border: "1px solid rgba(0,255,159,0.22)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#00ff9f", opacity: 0.6, letterSpacing: "0.1em" }}>PROCESSING</span>
            <LoadingDots />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const isMiniPay = detectMiniPay()
  const [isFarcaster, setIsFarcaster] = useState(false)
  const [farcasterUser, setFarcasterUser] = useState<{ fid?: number; username?: string } | null>(null)
  const windowWidth  = useWindowWidth()
  const isMobileCtx  = isMiniPay || isFarcaster
  const isMobileScreen  = windowWidth < 640
  const isTabletScreen  = windowWidth >= 640 && windowWidth < 1024
  const showMobileLayout  = isMobileCtx || isMobileScreen
  const showTabletLayout  = !showMobileLayout && isTabletScreen
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [messages, setMessages] = useState<Message[]>([{
    role: "agent",
    content: isMiniPay
      ? `> CELOBANK_AGENT_v2.0 INITIALIZED\n> MINIPAY WALLET DETECTED ✓\n> STATUS: ONLINE ■■■■■■■■■■ 100%\n\nBienvenue sur CeloBank Agent 🌍\nVotre wallet MiniPay est connecté automatiquement.\nQue puis-je faire pour vous ?`
      : `> CELOBANK_AGENT_v2.0 INITIALIZED\n> CONNECTING TO CELO MAINNET...\n> STATUS: ONLINE ■■■■■■■■■■ 100%\n\nACCÈS À LA FINANCE DÉCENTRALISÉE POUR 1.4B DE NON-BANKÉS.\n\nSÉLECTIONNEZ UNE ACTION OU ENTREZ UNE COMMANDE. 🌍`,
    timestamp: new Date(),
  }])

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [celoPrice, setCeloPrice] = useState<string | null>(null)
  const [priceTrend, setPriceTrend] = useState<"up" | "down" | null>(null)
  const [selectedLang, setSelectedLang] = useState<string | null>(null)
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [blockNum, setBlockNum] = useState(Math.floor(Math.random() * 999999) + 25000000)
  const [pingMs, setPingMs] = useState(Math.floor(Math.random() * 20) + 5)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { address } = useAccount()
  const { connect, connectors } = useConnect()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [streak, setStreak] = useState<StreakData>({ current: 0, best: 0, total: 0, canCheckIn: true, canClaim: false, nextCheckIn: 0 })
  const [checking, setChecking] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [selfAgentStatus, setSelfAgentStatus] = useState<SelfAgentStatus | null>(null)
  const [selfRegSession, setSelfRegSession] = useState<{ deepLink: string; humanInstructions: string[] } | null>(null)

  // Use a ref so loadStreak always reads the latest publicClient without it
  // being a useCallback dependency (avoids re-render loop on unstable wagmi refs).
  const publicClientRef = useRef(publicClient)
  useEffect(() => { publicClientRef.current = publicClient }, [publicClient])

  const walletClientRef = useRef(walletClient)
  useEffect(() => { walletClientRef.current = walletClient }, [walletClient])

  const loadStreak = useCallback(async () => {
    if (!address || !publicClientRef.current) return
    try {
      const data = await (publicClientRef.current as any).readContract({ address: DAILYDROP_CELO, abi: DAILYDROP_ABI, functionName: "getUserData", args: [address] })
      const stored = localStorage.getItem(`dd_streak_${address}`)
      const best = stored ? Math.max(JSON.parse(stored).best ?? 0, Number(data[0])) : Number(data[0])
      const s: StreakData = { current: Number(data[0]), best, total: Number(data[2]), canCheckIn: Boolean(data[3]), canClaim: Boolean(data[4]), nextCheckIn: Number(data[5]) }
      setStreak(s)
      localStorage.setItem(`dd_streak_${address}`, JSON.stringify(s))
    } catch {}
  }, [address])  // publicClient intentionally excluded — read via ref to prevent re-render loop

  useEffect(() => { loadStreak() }, [loadStreak])

  const doCheckIn = useCallback(async (): Promise<string> => {
    const wc = (walletClient ?? (isMiniPay && address ? getMiniPayWalletClient(address as `0x${string}`) : null)) as any
    if (!address || !wc || !publicClient) return "❌ Wallet not connected."
    if (!streak.canCheckIn) {
      const next = streak.nextCheckIn > 0 ? new Date(streak.nextCheckIn * 1000).toLocaleTimeString() : "tomorrow"
      return `⏳ Already checked in today. Come back at ${next}`
    }
    setChecking(true)
    try {
      const feeTx = await wc.sendTransaction({ to: FEE_RECEIVER, value: CHECK_IN_FEE, account: address, chainId: 42220, gas: 200000n, ...(isMiniPay && { feeCurrency: CUSD_ADDRESS }) } as any)
      await (publicClient as any).waitForTransactionReceipt({ hash: feeTx })
      const tx = await wc.sendTransaction({ to: DAILYDROP_CELO, data: encodeFunctionData({ abi: DAILYDROP_ABI, functionName: "checkIn" }), account: address, chainId: 42220, gas: 200000n, ...(isMiniPay && { feeCurrency: CUSD_ADDRESS }) } as any)
      await (publicClient as any).waitForTransactionReceipt({ hash: tx })
      const newStreak = streak.current + 1
      const updated: StreakData = { ...streak, current: newStreak, best: Math.max(streak.best, newStreak), total: streak.total + 1, canCheckIn: false, canClaim: newStreak >= 7 }
      setStreak(updated)
      localStorage.setItem(`dd_streak_${address}`, JSON.stringify(updated))
      const daysLeft = 7 - (newStreak % 7) || 7
      return `✅ CHECK_IN CONFIRMED\nStreak: ${newStreak} day${newStreak > 1 ? "s" : ""} 🔥\n${newStreak % 7 === 0 ? "🎉 7-day bonus! Claim your DROP tokens!" : `${daysLeft} day${daysLeft > 1 ? "s" : ""} until bonus`}\n\nTX: https://celoscan.io/tx/${tx}`
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("User rejected") || msg.includes("user rejected")) return "❌ Check-in cancelled."
      if (msg.includes("already checked in")) { await loadStreak(); return "⏳ Already checked in today!" }
      return `❌ Check-in failed: ${msg}`
    } finally { setChecking(false) }
  }, [address, walletClient, publicClient, streak, loadStreak])

  const doClaimReward = useCallback(async (): Promise<string> => {
    const wc = (walletClient ?? (isMiniPay && address ? getMiniPayWalletClient(address as `0x${string}`) : null)) as any
    if (!address || !wc || !publicClient) return "❌ Wallet not connected."
    if (!streak.canClaim) return `⏳ Need ${7 - streak.current} more days to claim.`
    setClaiming(true)
    try {
      const tx = await wc.sendTransaction({ to: DAILYDROP_CELO, data: encodeFunctionData({ abi: DAILYDROP_ABI, functionName: "claimReward" }), account: address, chainId: 42220, gas: 200000n, ...(isMiniPay && { feeCurrency: CUSD_ADDRESS }) } as any)
      await (publicClient as any).waitForTransactionReceipt({ hash: tx })
      setStreak(s => ({ ...s, current: 0, canClaim: false }))
      return `✅ REWARD CLAIMED!\n+10 DROP tokens 🎁\n\nTX: https://celoscan.io/tx/${tx}`
    } catch (err: unknown) {
      return `❌ Claim failed: ${err instanceof Error ? err.message : String(err)}`
    } finally { setClaiming(false) }
  }, [address, walletClient, publicClient, streak])

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"
    fetch(`${API_URL}/api/self-agent-status`)
      .then(r => r.json())
      .then(setSelfAgentStatus)
      .catch(() => setSelfAgentStatus({ registered: false }))
  }, [])

  const handleStartVerification = useCallback(async () => {
    if (!address || !walletClient) return
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"
    try {
      const sig = await (walletClient as any).signMessage({ message: "CeloBank Agent: Initiate Self Agent ID Registration", account: address })
      const res = await fetch(`${API_URL}/api/self-agent-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerAddress: address, signature: sig }),
      })
      const data = await res.json()
      if (data.deepLink) setSelfRegSession({ deepLink: data.deepLink, humanInstructions: data.humanInstructions ?? [] })
      else setMessages(prev => [...prev, { role: "agent", content: `❌ Registration error: ${data.error}`, timestamp: new Date() }])
    } catch (err) {
      setMessages(prev => [...prev, { role: "agent", content: `❌ ${err instanceof Error ? err.message : String(err)}`, timestamp: new Date() }])
    }
  }, [address, walletClient])

  const executePrepared = useCallback(async (prepared: PrepareResult): Promise<string> => {
    const wc = (walletClientRef.current ?? (isMiniPay && address ? getMiniPayWalletClient(address as `0x${string}`) : null)) as any
    if (!address || !wc || !publicClient) {
      return "❌ Wallet not connected. Please connect your wallet first."
    }
    if (!prepared.success || prepared.transactions.length === 0) {
      return `❌ ${prepared.error ?? "No transactions to execute"}`
    }
    let lastHash = ""
    try {
      for (let i = 0; i < prepared.transactions.length; i++) {
        const tx = prepared.transactions[i]
        const hash = await wc.sendTransaction({ to: tx.to, data: tx.data as `0x${string}`, value: tx.value ? BigInt(tx.value) : undefined, chainId: tx.chainId, account: address, ...(isMiniPay && { feeCurrency: CUSD_ADDRESS }) } as any)
        lastHash = hash
        if (i < prepared.transactions.length - 1) await publicClient.waitForTransactionReceipt({ hash })
      }
      return `✅ ${prepared.summary}\n> TX: https://celoscan.io/tx/${lastHash}\n> Signed by: ${address.slice(0, 6)}...${address.slice(-4)}`
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("User rejected") || msg.includes("user rejected")) return "❌ Transaction cancelled."
      return `❌ Transaction failed: ${msg}`
    }
  }, [address, publicClient])  // walletClient intentionally excluded — read via ref to get latest value

  useEffect(() => {
    async function initFarcaster() {
      try {
        const context = await sdk.context
        if (context?.user) {
          setIsFarcaster(true)
          setFarcasterUser({ fid: context.user.fid, username: context.user.username })
          const farcasterConnector = connectors.find((c: any) => c.id === 'farcasterMiniApp')
          if (farcasterConnector && !address) connect({ connector: farcasterConnector })
          setMessages([{ role: "agent", content: `> CELOBANK_AGENT_v2.0 INITIALIZED\n> FARCASTER MINI APP DETECTED ✓\n> STATUS: ONLINE ■■■■■■■■■■ 100%\n\nWelcome${context.user.username ? ` @${context.user.username}` : ''} 👋\nYour Farcaster wallet is connecting automatically.\nWhat can I do for you?`, timestamp: new Date() }])
        }
      } catch { /* not in Farcaster */ }
    }
    initFarcaster()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss the Farcaster splash screen once the app is ready
  useEffect(() => {
    if (isFarcaster) sdk.actions.ready()
  }, [isFarcaster])

  useEffect(() => {
    if (!isMiniPay || address) return
    // Prefer wagmi connect() so address state is properly populated
    const injectedConnector = connectors.find((c: any) => c.id === 'injected' || c.type === 'injected')
    if (injectedConnector) {
      connect({ connector: injectedConnector })
    } else {
      // Fallback: direct request keeps MiniPay functional even without wagmi connector
      ;(window as any).ethereum?.request({ method: "eth_requestAccounts" }).catch(console.error)
    }
  }, [isMiniPay, address, connect, connectors])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  useEffect(() => {
    const interval = setInterval(() => { setBlockNum(b => b + 1); setPingMs(Math.floor(Math.random() * 20) + 5) }, 12000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd&include_24hr_change=true")
        const data = await res.json()
        setPriceTrend(data.celo.usd_24h_change >= 0 ? "up" : "down")
        setCeloPrice(data.celo.usd.toFixed(4))
      } catch { setCeloPrice("ERR") }
    }
    fetchPrice()
    const interval = setInterval(fetchPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  async function sendMessage(text?: string) {
    const msg = text || input
    if (typeof msg !== 'string' || !msg.trim() || loading) return

    const isCheckInMsg = msg === "__CHECKIN__"
      || /\b(daily[\s-]?check[\s-]?in|check[\s-]?in|checkin)\b/i.test(msg.trim())
    if (isCheckInMsg) {
      const displayMsg = msg === "__CHECKIN__" ? "Daily check-in" : msg
      setMessages(prev => [...prev, { role: "user", content: displayMsg, timestamp: new Date() }])
      setInput("")
      setLoading(true)
      const result = await doCheckIn()
      setMessages(prev => [...prev, { role: "agent", content: result, timestamp: new Date() }])
      setLoading(false)
      return
    }

    setMessages(prev => [...prev, { role: "user", content: msg, timestamp: new Date() }])
    setInput("")
    setLoading(true)

    const langLabel = LANGUAGES.find(l => l.code === selectedLang)?.label
    const enrichedMsg = selectedLang ? `[Respond only in ${langLabel}] ${msg}` : msg

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"
      const defiAction = address ? detectDeFiAction(msg) : null

      if (defiAction && address) {
        setMessages(prev => [...prev, { role: "agent", content: `> PREPARING TX...\n> Action: ${defiAction.action.toUpperCase()}\n> Params: ${JSON.stringify(defiAction.params)}\n> Waiting for wallet signature...`, timestamp: new Date() }])

        const prepareBody = { action: defiAction.action, userAddress: address, params: defiAction.params }
        const prepareRes = await fetch(`${API_URL}/api/v1/prepare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prepareBody) })
        const prepared: PrepareResult = await prepareRes.json()

        if (!prepared.success) {
          setMessages(prev => [...prev, { role: "agent", content: `❌ ${prepared.error ?? "Preparation failed"}`, timestamp: new Date() }])
          return
        }

        setMessages(prev => [...prev, { role: "agent", content: `> ${prepared.summary}\n> ${prepared.transactions.length} TX(s) to sign in your wallet...`, timestamp: new Date() }])

        // Give wagmi 500ms to fully initialize walletClient after address detection
        if (address && !walletClientRef.current) {
          await new Promise<void>(resolve => setTimeout(resolve, 500))
        }
        const result = await executePrepared(prepared)
        setMessages(prev => [...prev, { role: "agent", content: result, timestamp: new Date() }])
      } else {
        const res = await fetch(`${API_URL}/api/v1/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: enrichedMsg, userAddress: address || null }) })
        const data = await res.json()
        setMessages(prev => [...prev, { role: "agent", content: data.response || data.error, timestamp: new Date() }])
      }
    } catch {
      setMessages(prev => [...prev, { role: "agent", content: "ERR_CONNECTION_FAILED: Cannot reach server.", timestamp: new Date() }])
    } finally { setLoading(false) }
  }

  // ── MOBILE LAYOUT (<640px or MiniPay/Farcaster) ────────────────────────────
  if (showMobileLayout) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#020408", color: "#00ff9f", fontFamily: "'Courier New', 'Lucida Console', monospace", overflow: "hidden", position: "relative" }}>
        <style>{BASE_CSS}</style>
        <ScanLine />
        <CRTNoise />
        <HexGrid />
        {isMiniPay && <MiniPayBanner />}
        {isFarcaster && !isMiniPay && <FarcasterBanner username={farcasterUser?.username} />}

        {/* Header */}
        <div style={{ padding: "0 14px", height: 52, flexShrink: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 10, background: "rgba(2,4,8,0.97)", borderBottom: "1px solid rgba(0,255,159,0.25)", boxShadow: "0 1px 20px rgba(0,255,159,0.08)" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(0,255,159,0.8)", boxShadow: "0 0 12px rgba(0,255,159,0.4)" }}>
              <img src="/logo.svg" alt="CeloBank" style={{ width: "100%", height: "100%", filter: "hue-rotate(90deg) brightness(1.2)" }} />
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: "50%", background: "#00ff9f", boxShadow: "0 0 6px #00ff9f", animation: "pulse 2s infinite" }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", color: "#00ff9f", textShadow: "0 0 8px rgba(0,255,159,0.6)" }}><GlitchText text="CELOBANK_AGENT" /></div>
            <div style={{ fontSize: 8, color: "#00ff9f", opacity: 0.35, letterSpacing: "0.08em" }}>#{blockNum.toLocaleString()} · {pingMs}ms</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <PriceBadge celoPrice={celoPrice} priceTrend={priceTrend} />
            {!isMiniPay && !isFarcaster && (
              <div style={{ transform: "scale(0.82)", transformOrigin: "right center" }}><ConnectButton /></div>
            )}
            {address && (isMiniPay || isFarcaster) && (
              <div style={{ padding: "4px 8px", borderRadius: 3, background: isFarcaster ? "rgba(139,92,246,0.1)" : "rgba(53,208,127,0.1)", border: `1px solid ${isFarcaster ? "rgba(139,92,246,0.3)" : "rgba(53,208,127,0.3)"}`, fontSize: 9, color: isFarcaster ? "#a78bfa" : "#35D07F" }}>
                {isFarcaster && farcasterUser?.username ? `@${farcasterUser.username}` : `${address.slice(0,6)}…${address.slice(-4)}`}
              </div>
            )}
          </div>
        </div>

        {/* Terminal bar */}
        <div style={{ padding: "4px 14px", borderBottom: "1px solid rgba(0,255,159,0.08)", background: "rgba(0,255,159,0.015)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 8, color: "#00ff9f", opacity: 0.3, letterSpacing: "0.08em" }}>TERMINAL://celobank/chat — {messages.length} MSG</span>
          <span style={{ marginLeft: "auto", fontSize: 8, color: "#00ff9f", opacity: 0.25 }}>{address ? `${address.slice(0,6)}…${address.slice(-4)}` : "NOT_CONNECTED"}</span>
        </div>

        {/* Messages */}
        <ChatMessages messages={messages} loading={loading} address={address} isFarcaster={isFarcaster} isMiniPay={isMiniPay} farcasterUser={farcasterUser} bottomRef={bottomRef} compact />

        {/* Quick actions strip */}
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(0,255,159,0.1)", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", gap: 6, padding: "8px 12px", overflowX: "auto", scrollbarWidth: "none" }}>
            <button onClick={() => setShowLangPicker(v => !v)} style={{ padding: "6px 10px", borderRadius: 3, cursor: "pointer", fontFamily: "inherit", fontSize: 10, whiteSpace: "nowrap", flexShrink: 0, background: showLangPicker ? "rgba(0,255,159,0.12)" : "rgba(0,255,159,0.04)", border: `1px solid ${showLangPicker ? "rgba(0,255,159,0.5)" : "rgba(0,255,159,0.2)"}`, color: "#00ff9f", fontWeight: 700, transition: "all 0.18s" }}>
              {selectedLang ? `${LANGUAGES.find(l => l.code === selectedLang)?.flag} ${LANGUAGES.find(l => l.code === selectedLang)?.code.toUpperCase()}` : "🌍 LANG"}
            </button>
            <div style={{ width: 1, background: "rgba(0,255,159,0.12)", flexShrink: 0, margin: "2px 0" }} />
            {QUICK_ACTIONS.map((action, i) => <QBtn key={i} action={action} onClick={() => sendMessage(action.msg)} small />)}
          </div>
          {showLangPicker && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 12px", borderTop: "1px solid rgba(0,255,159,0.08)", background: "rgba(0,0,0,0.7)" }}>
              {LANGUAGES.map(lang => (
                <div key={lang.code} onClick={() => { setSelectedLang(selectedLang === lang.code ? null : lang.code); setShowLangPicker(false) }}
                  style={{ fontSize: 22, cursor: "pointer", opacity: selectedLang === null || selectedLang === lang.code ? 1 : 0.3, padding: 2, borderRadius: 3, transition: "opacity 0.15s" }}>
                  {lang.flag}
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(0,255,159,0.08)", background: "rgba(0,0,0,0.6)" }}>
            <InputBar value={input} onChange={setInput} onSend={sendMessage} loading={loading} compact />
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{ display: "flex", borderTop: "1px solid rgba(0,255,159,0.15)", background: "rgba(2,4,8,0.98)", flexShrink: 0, zIndex: 20 }}>
          {BOTTOM_NAV.map((item, i) => (
            <button key={i} onClick={() => sendMessage(item.msg)}
              style={{ flex: 1, padding: "10px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = `${item.color}0e`)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 7, letterSpacing: "0.08em", color: item.color, opacity: 0.7 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── TABLET LAYOUT (640–1024px) ─────────────────────────────────────────────
  if (showTabletLayout) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#020408", color: "#00ff9f", fontFamily: "'Courier New', 'Lucida Console', monospace", overflow: "hidden", position: "relative" }}>
        <style>{BASE_CSS}</style>
        <ScanLine />
        <CRTNoise />
        <HexGrid />

        {/* Header */}
        <div style={{ padding: "0 16px", height: 54, flexShrink: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 12, background: "rgba(2,4,8,0.97)", borderBottom: "1px solid rgba(0,255,159,0.25)", boxShadow: "0 1px 24px rgba(0,255,159,0.08)" }}>
          <button onClick={() => setDrawerOpen(v => !v)} style={{ width: 34, height: 34, borderRadius: 3, background: drawerOpen ? "rgba(0,255,159,0.1)" : "transparent", border: `1px solid ${drawerOpen ? "rgba(0,255,159,0.4)" : "rgba(0,255,159,0.2)"}`, color: "#00ff9f", cursor: "pointer", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 0, transition: "all 0.18s", flexShrink: 0 }}>
            <span style={{ display: "block", width: 14, height: 1.5, background: "#00ff9f", borderRadius: 1 }} />
            <span style={{ display: "block", width: 14, height: 1.5, background: "#00ff9f", borderRadius: 1 }} />
            <span style={{ display: "block", width: 14, height: 1.5, background: "#00ff9f", borderRadius: 1 }} />
          </button>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(0,255,159,0.8)", boxShadow: "0 0 12px rgba(0,255,159,0.4)" }}>
              <img src="/logo.svg" alt="CeloBank" style={{ width: "100%", height: "100%", filter: "hue-rotate(90deg) brightness(1.2)" }} />
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: "50%", background: "#00ff9f", animation: "pulse 2s infinite" }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.14em", color: "#00ff9f", textShadow: "0 0 8px rgba(0,255,159,0.6)" }}><GlitchText text="CELOBANK_AGENT" /></div>
            <div style={{ fontSize: 8, color: "#00ff9f", opacity: 0.4, letterSpacing: "0.1em" }}>#{blockNum.toLocaleString()} · {pingMs}ms · MAINNET</div>
          </div>
          <PriceBadge celoPrice={celoPrice} priceTrend={priceTrend} />
          <div style={{ marginLeft: "auto" }}><ConnectButton /></div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>
          {/* Drawer overlay */}
          {drawerOpen && (
            <>
              <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10, backdropFilter: "blur(2px)" }} />
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 230, background: "rgba(2,4,8,0.98)", borderRight: "1px solid rgba(0,255,159,0.2)", padding: "14px 12px", zIndex: 11, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, animation: "fadeIn 0.18s ease" }}>
                <LeftSidebarContent actions={QUICK_ACTIONS} selectedLang={selectedLang} setSelectedLang={setSelectedLang} streak={streak} checking={checking} claiming={claiming} doClaimReward={doClaimReward} sendMessage={(m: string) => { sendMessage(m); setDrawerOpen(false) }} address={address} messages={messages} selfAgentStatus={selfAgentStatus} onStartVerification={handleStartVerification} />
              </div>
            </>
          )}

          {/* Chat */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "5px 16px", borderBottom: "1px solid rgba(0,255,159,0.08)", background: "rgba(0,255,159,0.015)", display: "flex", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: "#00ff9f", opacity: 0.3, letterSpacing: "0.1em" }}>TERMINAL://celobank/chat — {messages.length} MSGS</span>
              <span style={{ marginLeft: "auto", fontSize: 9, color: "#00ff9f", opacity: 0.25 }}>{address ? `${address.slice(0,6)}…${address.slice(-4)}` : "NOT_CONNECTED"}</span>
            </div>
            <ChatMessages messages={messages} loading={loading} address={address} isFarcaster={isFarcaster} isMiniPay={isMiniPay} farcasterUser={farcasterUser} bottomRef={bottomRef} />
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,255,159,0.12)", background: "rgba(0,0,0,0.5)", flexShrink: 0 }}>
              <InputBar value={input} onChange={setInput} onSend={sendMessage} loading={loading} />
              <div style={{ marginTop: 6, fontSize: 9, color: "#00ff9f", opacity: 0.18, letterSpacing: "0.07em", textAlign: "center" }}>NON-CUSTODIAL · CELO_MAINNET_42220 · ERC-8004</div>
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ width: 190, borderLeft: "1px solid rgba(0,255,159,0.12)", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, background: "rgba(0,255,159,0.015)", overflowY: "auto" }}>
            <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.3, letterSpacing: "0.15em", borderBottom: "1px solid rgba(0,255,159,0.1)", paddingBottom: 6 }}>// NETWORK_STATUS</div>
            {[
              { label: "CHAIN",   val: "CELO",                                sub: "ID:42220",     color: "#00ff9f" },
              { label: "LATENCY", val: `${pingMs}ms`,                         sub: "REALTIME",     color: "#ffbe0b" },
              { label: "BLOCK",   val: `#${(blockNum % 100000).toString().padStart(5,"0")}`, sub: "~5s FINAL", color: "#00d4ff" },
            ].map((item, i) => (
              <div key={i} style={{ padding: "9px", borderRadius: 3, background: `${item.color}06`, border: `1px solid ${item.color}1e` }}>
                <div style={{ fontSize: 8, color: item.color, opacity: 0.45 }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: item.color, letterSpacing: "-0.01em" }}>{item.val}</div>
                <div style={{ fontSize: 8, color: item.color, opacity: 0.3 }}>{item.sub}</div>
              </div>
            ))}
            <div style={{ padding: "9px", borderRadius: 3, background: "rgba(131,56,236,0.06)", border: "1px solid rgba(131,56,236,0.18)" }}>
              <div style={{ fontSize: 8, color: "#8338ec", opacity: 0.6, marginBottom: 3 }}>AI_MODEL</div>
              <div style={{ fontSize: 10, color: "#8338ec", lineHeight: 1.9, opacity: 0.75 }}>CLAUDE_SONNET<br />21_TOOLS_ACTIVE</div>
            </div>
            <a href="https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1" target="_blank" rel="noreferrer" style={{ marginTop: "auto", padding: "8px", borderRadius: 3, background: "rgba(0,255,159,0.03)", border: "1px solid rgba(0,255,159,0.18)", color: "#00ff9f", fontSize: 9, textAlign: "center", textDecoration: "none", letterSpacing: "0.08em", display: "block", transition: "all 0.18s" }}>
              ⬡ CELOSCAN ↗
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── DESKTOP LAYOUT (>1024px) ───────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#020408", color: "#00ff9f", fontFamily: "'Courier New', 'Lucida Console', monospace", overflow: "hidden", position: "relative" }}>
      <style>{BASE_CSS}</style>
      <ScanLine />
      <CRTNoise />
      <HexGrid />
      <DataStream />

      {/* Header */}
      <div style={{ padding: "0 22px", height: 58, flexShrink: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 16, background: "rgba(2,4,8,0.97)", borderBottom: "1px solid rgba(0,255,159,0.25)", boxShadow: "0 1px 30px rgba(0,255,159,0.09), inset 0 -1px 0 rgba(0,255,159,0.15)" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(0,255,159,0.85)", boxShadow: "0 0 18px rgba(0,255,159,0.5)" }}>
            <img src="/logo.svg" alt="CeloBank" style={{ width: "100%", height: "100%", filter: "hue-rotate(90deg) brightness(1.2)" }} />
          </div>
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: "#00ff9f", boxShadow: "0 0 8px #00ff9f", animation: "pulse 2s infinite" }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.16em", color: "#00ff9f", textShadow: "0 0 12px rgba(0,255,159,0.7)" }}><GlitchText text="CELOBANK_AGENT" /></div>
          <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.45, letterSpacing: "0.1em" }}>BLOCK #{blockNum.toLocaleString()} · {pingMs}ms · MAINNET</div>
        </div>
        <div style={{ marginLeft: 12 }}><PriceBadge celoPrice={celoPrice} priceTrend={priceTrend} /></div>
        <div style={{ display: "flex", gap: 7, marginLeft: 8 }}>
          {[{ label: "GAS", val: "<$0.001", color: "#00ff9f" }, { label: "ERC", val: "8004", color: "#00d4ff" }, { label: "NET", val: "CELO", color: "#ffbe0b" }].map((s, i) => (
            <div key={i} style={{ padding: "3px 9px", borderRadius: 3, fontSize: 9, letterSpacing: "0.1em", background: `${s.color}0e`, border: `1px solid ${s.color}35`, color: s.color }}>{s.label}:{s.val}</div>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}><ConnectButton /></div>
      </div>

      {/* 3-column body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>
        {/* Left sidebar */}
        <div style={{ width: 224, borderRight: "1px solid rgba(0,255,159,0.12)", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, overflowY: "auto", background: "rgba(0,255,159,0.018)" }}>
          <LeftSidebarContent actions={QUICK_ACTIONS} selectedLang={selectedLang} setSelectedLang={setSelectedLang} streak={streak} checking={checking} claiming={claiming} doClaimReward={doClaimReward} sendMessage={sendMessage} address={address} messages={messages} selfAgentStatus={selfAgentStatus} onStartVerification={handleStartVerification} />
        </div>

        {/* Chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "6px 22px", borderBottom: "1px solid rgba(0,255,159,0.08)", background: "rgba(0,255,159,0.015)", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: "#00ff9f", opacity: 0.3, letterSpacing: "0.1em" }}>TERMINAL://celobank/chat — {messages.length} MSGS</span>
            <span style={{ marginLeft: "auto", fontSize: 9, color: "#00ff9f", opacity: 0.25 }}>{address ? `WALLET: ${address.slice(0,6)}…${address.slice(-4)}` : "WALLET: NOT_CONNECTED"}</span>
          </div>
          <ChatMessages messages={messages} loading={loading} address={address} isFarcaster={isFarcaster} isMiniPay={isMiniPay} farcasterUser={farcasterUser} bottomRef={bottomRef} />
          <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(0,255,159,0.13)", background: "rgba(0,0,0,0.55)", flexShrink: 0 }}>
            <InputBar value={input} onChange={setInput} onSend={sendMessage} loading={loading} />
            <div style={{ marginTop: 7, fontSize: 9, color: "#00ff9f", opacity: 0.16, letterSpacing: "0.08em", textAlign: "center" }}>NON-CUSTODIAL · GAS PAID BY YOU · CELO_MAINNET_42220 · ERC-8004 · CLAUDE_SONNET</div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ width: 204, borderLeft: "1px solid rgba(0,255,159,0.12)", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, background: "rgba(0,255,159,0.018)" }}>
          <div style={{ fontSize: 9, color: "#00ff9f", opacity: 0.3, letterSpacing: "0.15em", borderBottom: "1px solid rgba(0,255,159,0.1)", paddingBottom: 6 }}>// NETWORK_STATUS</div>
          {[
            { label: "CHAIN",   val: "CELO",                                            sub: "ID:42220",      color: "#00ff9f" },
            { label: "RPC",     val: "ONLINE",                                          sub: "forno.celo.org",color: "#00ff9f" },
            { label: "LATENCY", val: `${pingMs}ms`,                                     sub: "REALTIME",      color: "#ffbe0b" },
            { label: "BLOCK",   val: `#${(blockNum % 100000).toString().padStart(5,"0")}`, sub: "~5s FINALITY", color: "#00d4ff" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "10px", borderRadius: 3, background: `${item.color}06`, border: `1px solid ${item.color}1e`, transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 8, color: item.color, opacity: 0.45 }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: item.color, letterSpacing: "-0.01em" }}>{item.val}</div>
              <div style={{ fontSize: 8, color: item.color, opacity: 0.32 }}>{item.sub}</div>
            </div>
          ))}
          <div style={{ padding: "10px", borderRadius: 3, background: "rgba(131,56,236,0.06)", border: "1px solid rgba(131,56,236,0.18)" }}>
            <div style={{ fontSize: 8, color: "#8338ec", opacity: 0.6, marginBottom: 4 }}>AI_MODEL</div>
            <div style={{ fontSize: 10, color: "#8338ec", lineHeight: 1.9, opacity: 0.75 }}>CLAUDE_SONNET<br />21_TOOLS_ACTIVE<br />ERC-8004 · G$</div>
          </div>
          <div style={{ padding: "10px", borderRadius: 3, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <div style={{ fontSize: 8, color: "#6366f1", opacity: 0.6, marginBottom: 4 }}>SELF_AGENT</div>
            {selfAgentStatus?.registered && selfAgentStatus?.isVerified
              ? <div style={{ fontSize: 10, color: "#6366f1", lineHeight: 1.9, opacity: 0.85 }}>VERIFIED ✓<br />ZK_PROOF_ONCHAIN<br />ID #{selfAgentStatus.agentId}</div>
              : <div style={{ fontSize: 10, color: "#6366f1", lineHeight: 1.9, opacity: 0.72 }}>NOT_YET_VERIFIED<br />SETUP_IN_PROGRESS<br />PENDING_OWNER</div>
            }
          </div>
          <div style={{ padding: "10px", borderRadius: 3, background: "rgba(255,190,11,0.05)", border: "1px solid rgba(255,190,11,0.18)" }}>
            <div style={{ fontSize: 8, color: "#ffbe0b", opacity: 0.6, marginBottom: 4 }}>IMPACT</div>
            <div style={{ fontSize: 10, color: "#ffbe0b", lineHeight: 1.9, opacity: 0.72 }}>1.4B UNBANKED<br />25+ STABLES<br />15M+ MINIPAY</div>
          </div>
          <a href="https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1" target="_blank" rel="noreferrer"
            style={{ marginTop: "auto", padding: "9px", borderRadius: 3, background: "rgba(0,255,159,0.03)", border: "1px solid rgba(0,255,159,0.18)", color: "#00ff9f", fontSize: 9, textAlign: "center", textDecoration: "none", letterSpacing: "0.1em", display: "block", transition: "all 0.18s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,255,159,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,255,159,0.4)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,255,159,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,255,159,0.18)" }}>
            ⬡ CELOSCAN_EXPLORER ↗
          </a>
        </div>
      </div>
      {selfRegSession && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ maxWidth: 440, width: "90%", background: "#040810", border: "1px solid rgba(99,102,241,0.5)", borderRadius: 6, padding: 24, boxShadow: "0 0 40px rgba(99,102,241,0.2)" }}>
            <div style={{ fontSize: 11, color: "#6366f1", letterSpacing: "0.14em", marginBottom: 12, fontWeight: 700 }}>🔐 SELF AGENT ID — START VERIFICATION</div>
            <div style={{ fontSize: 10, color: "#6366f1", opacity: 0.7, marginBottom: 12, lineHeight: 1.8 }}>
              {selfRegSession.humanInstructions.map((s, i) => <div key={i}>{s}</div>)}
            </div>
            <a href={selfRegSession.deepLink} target="_blank" rel="noreferrer"
              style={{ display: "block", padding: "10px 16px", borderRadius: 3, background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.5)", color: "#6366f1", fontSize: 10, textAlign: "center", textDecoration: "none", letterSpacing: "0.1em", marginBottom: 10 }}>
              ▶ OPEN IN SELF APP ↗
            </a>
            <div style={{ fontSize: 9, color: "#6366f1", opacity: 0.4, wordBreak: "break-all", marginBottom: 12 }}>{selfRegSession.deepLink}</div>
            <button onClick={() => setSelfRegSession(null)} style={{ width: "100%", padding: "7px", borderRadius: 3, background: "transparent", border: "1px solid rgba(99,102,241,0.25)", color: "#6366f1", fontSize: 9, fontFamily: "monospace", cursor: "pointer", letterSpacing: "0.1em" }}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
