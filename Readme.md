<div align="center">

<img src="src/ui/logo.svg" alt="CeloBank Agent" width="120" height="120" />

# CeloBank Agent

### 🌍 The autonomous AI bank for the 1.4 billion unbanked

[![Celo](https://img.shields.io/badge/Built%20on-Celo-35D07F?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMzNUQwN0YiLz48L3N2Zz4=)](https://celo.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Powered-FCFF52?style=for-the-badge)](https://8004scan.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[Demo](#demo) · [Features](#features) · [Quick Start](#quick-start) · [Architecture](#architecture)

</div>

---

## 🎯 The Problem

**1.4 billion people** have no access to banking services. They can't save, borrow, send money, or build credit history. Traditional banks require documents, physical presence, and minimum balances they can't afford.

Western Union charges **10-15% fees** to send $200. A bank transfer takes **3-5 days**. For Fatou in Senegal, Carlos in Mexico, or Arun in India — this is economic exclusion.

## 💡 The Solution

CeloBank Agent is an **autonomous AI agent** that acts as a complete bank — accessible via a simple chat interface in any language. No paperwork. No minimum balance. No branch visits.

Built on **Celo L2** with sub-cent transaction fees, powered by **ERC-8004** for verifiable on-chain identity.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **Natural Language** | Chat in French, English, Spanish, Arabic, Swahili, Italian |
| 💸 **Send Money** | Transfer CELO instantly to anyone, anywhere |
| 📊 **Real-time Prices** | Live CELO price from CoinGecko |
| 🏦 **DeFi Savings** | Deposit cUSD on Aave to earn interest automatically |
| 🔄 **Token Swap** | Exchange CELO ↔ cUSD via Ubeswap |
| 📈 **Portfolio** | Check balances and DeFi positions |
| 🤖 **ERC-8004 Identity** | Verifiable on-chain agent identity |
| ⚡ **Sub-cent fees** | Gas fees under $0.001 on Celo |

---

## 🏗️ Architecture

```
User (any language)
       ↓
  Chat Interface (React + Vite)
       ↓
  Express API Server
       ↓
  AI Agent (Ollama / Mistral)
  ├── get_celo_price    → CoinGecko API
  ├── get_balance       → Celo RPC (viem)
  ├── send_celo         → Celo blockchain tx
  ├── get_aave_position → Aave V3 contract
  ├── save_cusd         → Aave supply
  └── swap_celo_to_cusd → Ubeswap router
       ↓
  Celo Blockchain (Sepolia Testnet)
  └── ERC-8004 Agent Identity Registry
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Git

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
PRIVATE_KEY=0x...          # Wallet private key (testnet only!)
CELO_RPC=https://forno.celo-sepolia.celo-testnet.org
OLLAMA_API_KEY=ollama_...  # From ollama.com/settings/keys
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

👤 "Check balance of 0xDEAc..."
🤖 "The address 0xDEAc... has 208.40 CELO."

👤 "Send 0.01 CELO to 0xABCD..."
🤖 "✅ Transfer successful! TX: 0x9489dc51..."

👤 "Deposit 10 cUSD on Aave"
🤖 "✅ 10 cUSD deposited on Aave. Earning interest automatically 💰"
```

---

## 🌐 Supported Languages

🇫🇷 French · 🇬🇧 English · 🇪🇸 Spanish · 🇸🇦 Arabic · 🇹🇿 Swahili · 🇮🇹 Italian

---

## 🔗 ERC-8004 Agent Identity

CeloBank Agent is registered on the **ERC-8004 Identity Registry** on Celo — the emerging trust standard for autonomous AI agents.

- **Identity**: Portable, verifiable on-chain NFT
- **Reputation**: Track record that travels across organizations  
- **Verification**: Cryptographic enforcement, no trust required

Track this agent: [8004scan.io](https://8004scan.io)

---

## 🛠️ Tech Stack

- **Blockchain**: Celo L2 (OP Stack) — Sepolia Testnet
- **AI**: Ollama cloud (Mistral / Gemma3)
- **Agent Framework**: Custom tool-calling loop
- **On-chain**: viem v2
- **DeFi**: Aave V3, Ubeswap
- **UI**: React + Vite
- **API**: Express.js
- **Language**: TypeScript

---

## 📁 Project Structure

```
celobank-agent/
├── src/
│   ├── agent/
│   │   └── agent.ts        # AI agent with tool-calling loop
│   ├── tools/
│   │   ├── celo.ts         # On-chain tools (balance, send, price)
│   │   └── defi.ts         # DeFi tools (Aave, swap)
│   ├── ui/
│   │   ├── App.tsx         # React chat interface
│   │   ├── main.tsx        # Entry point
│   │   └── logo.svg        # CeloBank logo
│   ├── server.ts           # Express API server
│   └── index.ts            # CLI testing
├── .env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🏆 Hackathon

Built for **Build Agents for the Real World V2** by Celo Public Goods and **The Synthesis** by Ethereum Foundation.

- **Track 1**: Best Agent on Celo
- **Track 3**: Highest Rank on AgentScan
- **The Synthesis**: Ethereum Foundation $10,000 track

---

## 🤝 Contributing

PRs welcome! This project is open source and built for financial inclusion.

---

## 📄 License

MIT © 2026 [@wkalidev](https://github.com/wkalidev)

---

<div align="center">

**Built with ❤️ by Wkalidev(zcodebase) for the unbanked · Powered by Celo · Secured by ERC-8004**

</div>