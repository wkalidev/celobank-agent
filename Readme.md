<div align="center">

<img src="src/ui/logo.svg" alt="CeloBank Agent" width="120" height="120" />

# CeloBank Agent

### 🏗️ Open infrastructure for autonomous DeFi agents on Celo

[![npm](https://img.shields.io/badge/npm-@celobank%2Fagent--sdk-CB3837?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@celobank/agent-sdk)
[![Celo](https://img.shields.io/badge/Built%20on-Celo-35D07F?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMzNUQwN0YiLz48L3N2Zz4=)](https://celo.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Deployed-FCFF52?style=for-the-badge)](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1)
[![Self Agent](https://img.shields.io/badge/Self_Agent-Verified-6366f1?style=for-the-badge)](https://app.ai.self.xyz/agents)
[![MiniPay](https://img.shields.io/badge/MiniPay-Compatible-35D07F?style=for-the-badge)](https://minipay.opera.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[Demo](https://celobank-agent.vercel.app) · [SDK Docs](#-sdk--celobankagent-sdk) · [Quick Start](#-quick-start) · [Architecture](#️-architecture)

</div>

---

## 🏗️ What is CeloBank Agent?

CeloBank Agent is **two things at once**:

1. **An infrastructure SDK** — `@celobank/agent-sdk` is a published npm package that any developer can use to build autonomous DeFi agents on Celo. Portfolio reads, Mento V2 swaps, Aave V3 supply, native CELO transfers — all in one typed SDK.

2. **A reference implementation** — A full autonomous AI bank built on top of that SDK, showing what's possible: natural language banking for the 1.4 billion unbanked, deployed on Celo Mainnet with sub-cent fees.

> The SDK is the infrastructure. The app is the proof it works.

---

## 📦 SDK — `@celobank/agent-sdk`

Any developer can install the SDK and build their own agent in minutes:

```bash
npm install @celobank/agent-sdk
```

```typescript
import { CeloBankSDK } from "@celobank/agent-sdk"

const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })

// Read portfolio
const portfolio = await sdk.getPortfolio()

// Send CELO
const tx = await sdk.send({ to: "0xABC...", amount: "1.5" })

// Swap via Mento V2
const swap = await sdk.swap({ amount: "10", tokenOut: "cUSD" })

// Earn yield on Aave
const supply = await sdk.supplyAave({ amount: "50" })

// Get real-time prices
const prices = await sdk.getPrices({ tokens: ["CELO", "cUSD"] })
```

**→ Full SDK documentation: [`packages/agent-sdk/README.md`](./packages/agent-sdk/README.md)**

**→ npm package: [npmjs.com/package/@celobank/agent-sdk](https://www.npmjs.com/package/@celobank/agent-sdk)**

### What the SDK provides

| Method | Description |
|--------|-------------|
| `getPortfolio(params?)` | Native CELO + all ERC20 balances for any address |
| `getPrices(params?)` | Real-time USD prices + 24h change via CoinGecko |
| `send(params)` | Send native CELO to any address |
| `swap(params)` | Swap CELO → stablecoin via Mento V2 |
| `getAavePosition(params?)` | Read Aave V3 position (collateral, debt, health factor) |
| `supplyAave(params)` | Deposit asset on Aave V3 to earn yield |

### Who builds on this SDK?

| Project type | How they use it |
|---|---|
| 🤖 AI agent apps | Tool-calling loop for DeFi actions |
| 🛒 E-commerce | Accept CELO, auto-convert to cUSD |
| 💸 Remittance apps | Send money for ~$0.001 fee |
| 🏦 Savings bots | Auto-deposit surplus cUSD on Aave |
| 📊 Portfolio trackers | Read multi-token balances + prices |

**→ See real examples: [`packages/agent-sdk/examples/`](./packages/agent-sdk/examples/)**

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
| 🏦 **DeFi Savings** | Deposit cUSD on Aave V3 to earn interest automatically |
| 🔄 **Token Swap** | Exchange CELO ↔ cUSD / cEUR / cREAL via Mento V2 (on-chain verified) |
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
  └── @celobank/agent-sdk ← any project can use this
      ├── getPortfolio()    → Multi-token balances (CELO, cUSD, cEUR, cREAL, USDC, USDT)
      ├── getPrices()       → CoinGecko API
      ├── send()            → Celo Mainnet tx
      ├── swap()            → Mento V2 router (approve → waitForReceipt → swapIn)
      ├── getAavePosition() → Aave V3 contract
      └── supplyAave()      → Aave V3 supply (approve → waitForReceipt → supply)
       ↓
  Celo Mainnet (Chain ID: 42220)
  ├── Mento V2 Broker:    0x777A8255cA72412f0d706dc03C9D1987306B4CaD
  ├── Aave V3 Pool:       0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402
  └── ERC-8004 Registry:  0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Git
- [Groq API key](https://console.groq.com) (free — use Dev Tier for higher TPM limits)

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
🤖 "CELO: $0.072 (-1.05% 24h) | cUSD: $0.999 | USDC: $0.999"

👤 "Check my balance"
🤖 "Wallet 0xDEAcDe... | CELO: 207.2600 (native) | cUSD: 0.0312 | ..."

👤 "Send 0.01 CELO to 0xABCD..."
🤖 "✅ Sent 0.01 CELO | TX: https://celoscan.io/tx/0x..."

👤 "Swap 0.02 CELO to cUSD"
🤖 "Swap done: 0.02 CELO → cUSD | TX: https://celoscan.io/tx/0x31a4ee..."

👤 "Deposit 10 cUSD on Aave"
🤖 "Deposited 10 cUSD on Aave. TX: https://celoscan.io/tx/0x..."
```

---

## 🌐 Supported Languages

🇫🇷 French · 🇬🇧 English · 🇪🇸 Spanish · 🇸🇦 Arabic · 🇹🇿 Swahili · 🇮🇹 Italian · 🇵🇹 Portuguese · 🇨🇳 Chinese

---

## 📁 Project Structure

```
celobank-agent/
├── packages/
│   └── agent-sdk/          # 📦 @celobank/agent-sdk — npm package
│       ├── src/             # SDK source (CeloBankSDK, constants, ABIs, types)
│       ├── examples/        # Integration examples for builders
│       ├── dist/            # Compiled output
│       └── README.md        # SDK documentation
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
│   │   └── defi.ts         # DeFi tools (Mento V2 swap, Aave V3 supply/position)
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

## 🛠️ Tech Stack

- **Blockchain**: Celo L2 (OP Stack) — **Mainnet**
- **Smart Contract**: ERC-8004 Identity Registry (Solidity 0.8.25)
- **AI**: Groq Cloud — LLaMA 3.1-8b-instant (ultra-fast inference)
- **Agent Framework**: Custom tool-calling loop with direct return for action tools
- **SDK**: `@celobank/agent-sdk` — published on npm
- **On-chain**: viem v2
- **DeFi**: Aave V3 (`0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402`), Mento V2 (`0x777A8255cA72412f0d706dc03C9D1987306B4CaD`)
- **Identity**: ERC-8004 + Self Protocol (ZK-verified)
- **UI**: React + Vite
- **API**: Express.js
- **Deploy**: Vercel (UI) + Railway (API)
- **Language**: TypeScript

---

## 🏆 Hackathon

Built for the **Celo Onchain Agents Hackathon 2026**.

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