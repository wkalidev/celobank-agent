<div align="center">

<img src="src/ui/logo.svg" alt="CeloBank Agent" width="120" height="120" />

# CeloBank Agent

### 🌍 The autonomous AI bank for the 1.4 billion unbanked

[![Celo](https://img.shields.io/badge/Built%20on-Celo-35D07F?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMzNUQwN0YiLz48L3N2Zz4=)](https://celo.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Deployed-FCFF52?style=for-the-badge)](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1)
[![Self Agent](https://img.shields.io/badge/Self_Agent-Verified-6366f1?style=for-the-badge)](https://app.ai.self.xyz/agents)
[![MiniPay](https://img.shields.io/badge/MiniPay-Compatible-35D07F?style=for-the-badge)](https://minipay.opera.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[Demo](https://celobank-agent.vercel.app) · [Features](#features) · [Quick Start](#quick-start) · [Architecture](#architecture)

</div>

---

## 🎯 The Problem

**1.4 billion people** have no access to banking services. They can't save, borrow, send money, or build credit history. Traditional banks require documents, physical presence, and minimum balances they can't afford.

Western Union charges **10-15% fees** to send $200. A bank transfer takes **3-5 days**. For Fatou in Senegal, Carlos in Mexico, or Arun in India — this is economic exclusion.

## 💡 The Solution

CeloBank Agent is an **autonomous AI agent** that acts as a complete bank — accessible via a simple chat interface in any language. No paperwork. No minimum balance. No branch visits.

Built on **Celo Mainnet** with sub-cent transaction fees, powered by **ERC-8004** for verifiable on-chain identity, and **MiniPay compatible** for instant access to 15M+ users.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **Natural Language** | Chat in French, English, Spanish, Arabic, Swahili, Italian, Portuguese, Chinese |
| 💸 **Send Money** | Transfer CELO instantly to anyone, anywhere |
| 📊 **Real-time Prices** | Live CELO + multi-token prices from CoinGecko |
| 🏦 **DeFi Savings** | Deposit cUSD on Aave to earn interest automatically |
| 🔄 **Token Swap** | Exchange CELO ↔ cUSD / cEUR / cREAL via Mento V2 |
| 📈 **Portfolio** | Full multi-token balances and DeFi positions |
| 🤖 **ERC-8004 Identity** | Verifiable on-chain agent identity — deployed on Celo Mainnet |
| 🔐 **Self Agent ID** | Privacy-first ZK-verified onchain identity via Self Protocol |
| 📱 **MiniPay Compatible** | Auto-detect & auto-connect — zero friction for 15M+ MiniPay users |
| ⚡ **Sub-cent fees** | Gas fees under $0.001 on Celo |

---

## 🔗 Smart Contract — ERC-8004 Identity

| | |
|--|--|
| **Contract** | `0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1` |
| **Network** | Celo Mainnet (Chain ID: 42220) |
| **Block** | #66926976 |
| **Explorer** | [View on CeloScan](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1) |
| **TX Deploy** | [0x7746895c...](https://celoscan.io/tx/0x7746895ca9ef7a88ca1af8e4433b2130e60ea7c714750fdad9a9364abc26ba00) |
| **TX Register** | [0xb5e5ef91...](https://celoscan.io/tx/0xb5e5ef9120f798babb9beac7eb59993ba60c6da1f7861b84a38b202dfdc99fbd) |

---

## 🔐 Self Agent ID

CeloBank Agent is registered as a verified onchain AI agent via [Self Protocol](https://app.ai.self.xyz):

| Property | Value |
|---|---|
| Agent Address | `0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1` |
| Network | Celo Mainnet |
| Verification | ✅ ZK-verified onchain identity |
| Privacy | Zero personal data exposed — cryptographic proof only |

Every agent action is cryptographically signed — verifiable on-chain, no trust required.

---

## 📱 MiniPay Integration

CeloBank Agent is fully compatible with [MiniPay](https://minipay.opera.com) — Opera's lightweight wallet with 15M+ users across Africa.

- **Auto-detect**: The app automatically detects the MiniPay environment
- **Auto-connect**: Wallet connects in one tap — no popups, no friction
- **Gas in cUSD**: Users pay gas fees in stablecoins — no need to hold CELO for gas
- **Zero setup**: Works out of the box inside the MiniPay browser

---

## 🏗️ Architecture

```
User (any language, any device)
       ↓
  Chat Interface (React + Vite)
  └── MiniPay auto-detection & auto-connect
       ↓
  Express API Server (Railway)
       ↓
  AI Agent (Groq — LLaMA 3.1-8b-instant)
  ├── get_celo_price    → CoinGecko API
  ├── get_balance       → Celo RPC (viem)
  ├── get_portfolio     → Multi-token balances
  ├── get_multi_price   → Live prices + 24h change
  ├── send_celo         → Celo Mainnet tx
  ├── swap_celo         → Mento V2 router
  ├── get_aave_position → Aave V3 contract
  └── save_cusd         → Aave supply
       ↓
  Celo Mainnet (Chain ID: 42220)
  ├── ERC-8004 Registry: 0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1
  └── Self Agent ID: ZK-verified onchain identity
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Git
- [Groq API key](https://console.groq.com) (free)

### Installation

```bash
# Clone the repo
git clone https://github.com/wkalidev/celobank-agent.git
cd celobank-agent

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys
```

### Environment Variables

```env
PRIVATE_KEY=0x...                    # Agent wallet private key
CELO_RPC=https://forno.celo.org      # Celo Mainnet RPC
GROQ_API_KEY=gsk_...                 # From console.groq.com (free)
CONTRACT_ADDRESS=0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1
```

### Run

```bash
# Start everything (API + UI)
npm run dev

# Open http://localhost:5173
```

---

## 💬 Example Interactions

```
👤 "What is the current CELO price?"
🤖 "The current CELO price is $0.092 USD."

👤 "Check my balance"
🤖 "Your address 0xDEAc... has 207.26 CELO ($19.07 USD)."

👤 "Send 0.01 CELO to 0xABCD..."
🤖 "✅ Transfer successful! TX: 0x9489dc51..."

👤 "Deposit 10 cUSD on Aave"
🤖 "✅ 10 cUSD deposited on Aave. Earning interest automatically 💰"

👤 "Swap 1 CELO to cUSD"
🤖 "✅ Swap successful! 1 CELO → cUSD via Mento V2"
```

---

## 🌐 Supported Languages

🇫🇷 French · 🇬🇧 English · 🇪🇸 Spanish · 🇸🇦 Arabic · 🇹🇿 Swahili · 🇮🇹 Italian · 🇵🇹 Portuguese · 🇨🇳 Chinese

---

## 🛠️ Tech Stack

- **Blockchain**: Celo L2 (OP Stack) — **Mainnet**
- **Smart Contract**: ERC-8004 Identity Registry (Solidity 0.8.25)
- **AI**: Groq Cloud — LLaMA 3.1-8b-instant (ultra-fast inference)
- **Agent Framework**: Custom tool-calling loop with fetch
- **On-chain**: viem v2
- **DeFi**: Aave V3, Mento V2
- **Identity**: ERC-8004 + Self Protocol (ZK-verified)
- **UI**: React + Vite
- **API**: Express.js
- **Deploy**: Vercel (UI) + Railway (API)
- **Language**: TypeScript

---

## 📁 Project Structure

```
celobank-agent/
├── contracts/
│   └── CeloBankAgent.sol   # ERC-8004 Identity contract
├── scripts/
│   ├── deploy.ts           # Deployment script
│   └── register.ts         # Agent registration script
├── src/
│   ├── agent/
│   │   └── agent.ts        # AI agent — Groq LLaMA 3.1 + tool-calling loop
│   ├── tools/
│   │   ├── celo.ts         # On-chain tools (balance, send, price)
│   │   └── defi.ts         # DeFi tools (Aave, Mento swap)
│   ├── ui/
│   │   ├── App.tsx         # React chat interface + MiniPay detection
│   │   ├── main.tsx        # Entry point
│   │   └── logo.svg        # CeloBank logo
│   ├── server.ts           # Express API server
│   └── index.ts            # CLI testing
├── .env.example
├── hardhat.config.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🏆 Hackathon

Built for the **Celo Onchain Agents Hackathon 2026** — May 22 to June 15, 2026.

| Track | Prize |
|-------|-------|
| 🥇 Track 1 — Best Agent on Celo | $2,500 |
| 🥈 Track 2 — Most Onchain Transactions | $500 |
| 🥉 Track 3 — Highest Rank on 8004scan | $500 |

**Why CeloBank wins:**
- Real transactions on Celo Mainnet — every chat message can trigger an on-chain tx
- ERC-8004 registered + Self Agent ID verified — top-tier agent identity stack
- MiniPay compatible — immediate access to 15M+ real users
- Financial inclusion mission aligned with Celo's core values

---

## 🤝 Contributing

PRs welcome! This project is open source and built for financial inclusion.

---

## 📄 License

MIT © 2026 [@wkalidev](https://github.com/wkalidev)

---

<div align="center">
**Built with ❤️ by [Wkalidev](https://github.com/wkalidev) for the unbanked · Powered by Celo Mainnet · Groq LLaMA 3.1 · ERC-8004 · Self Agent ID**
</div>