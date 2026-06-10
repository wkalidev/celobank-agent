<div align="center">

<img src="src/ui/logo.svg" alt="CeloBank Agent" width="120" height="120" />

# CeloBank Agent

### 🏗️ Open infrastructure for autonomous DeFi agents on Celo

[![npm](https://img.shields.io/badge/npm-@celobank%2Fagent--sdk-CB3837?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@celobank/agent-sdk)
[![Celo](https://img.shields.io/badge/Built%20on-Celo-35D07F?style=for-the-badge)](https://celo.org)
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

1. **An infrastructure SDK** — `@celobank/agent-sdk` is a published npm package that any developer can use to build autonomous DeFi agents on Celo. Portfolio reads, Mento V2 swaps, Aave V3 supply, staking, trade ideas — all in one typed SDK.

2. **A reference implementation** — A full autonomous AI bank built on top of that SDK, showing what's possible: natural language banking for the 1.4 billion unbanked, deployed on Celo Mainnet with sub-cent fees.

> The SDK is the infrastructure. The app is the proof it works.

---

## 🔓 Non-Custodial Architecture (v2)

CeloBank Agent v2 is **fully non-custodial** — the agent never holds user funds.

```
User types "swap 10 CELO to cUSD"
         ↓
Frontend detects DeFi action
         ↓
POST /api/v1/prepare → returns unsigned transactions
         ↓
User signs in their own wallet (MiniPay / RainbowKit / MetaMask)
         ↓
Gas fees paid by the USER ✅
Agent never touches private keys ✅
```

Every DeFi action (swap, save, stake, send) is signed by the user's own wallet. The agent only prepares transactions — it never executes them on your behalf.

---

## 📦 SDK — `@celobank/agent-sdk`

Any developer can install the SDK and build their own agent in minutes:

```bash
npm install @celobank/agent-sdk
```

```typescript
import { CeloBankSDK } from "@celobank/agent-sdk"

const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })

const portfolio = await sdk.getPortfolio()
const swap      = await sdk.swapTokens({ tokenIn: "CELO", tokenOut: "USDC", amount: "10" })
const supply    = await sdk.supplyAave({ amount: "50" })
const prices    = await sdk.getPrices({ tokens: ["CELO", "cUSD"] })
const token     = await sdk.launchToken({ name: "MyToken", symbol: "MTK", totalSupply: "1000000" })
```

**→ npm package: [npmjs.com/package/@celobank/agent-sdk](https://www.npmjs.com/package/@celobank/agent-sdk)**

### SDK Methods

| Method | Description |
|--------|-------------|
| `getPortfolio(params?)` | Native CELO + all ERC20 balances for any address |
| `getPrices(params?)` | Real-time USD prices + 24h change via CoinGecko |
| `send(params)` | Send native CELO to any address |
| `swap(params)` | Swap CELO → stablecoin via Mento V2 (legacy) |
| `swapTokens(params)` | Universal swap: Mento V2 or Uniswap V3 for 26+ token pairs |
| `launchToken(params)` | Deploy a new ERC20 token on Celo via TokenFactory |
| `getAavePosition(params?)` | Read Aave V3 position (collateral, debt, health factor) |
| `supplyAave(params)` | Deposit asset on Aave V3 to earn yield |

---

## ✨ Features (v2 — 19 tools)

| Feature | Description |
|---------|-------------|
| 💬 **Natural Language** | Chat in 8 languages: FR, EN, ES, AR, SW, IT, PT, ZH |
| 💸 **Send Money** | Transfer CELO instantly — user signs their own TX |
| 📊 **Real-time Prices** | Live prices + 24h change for all Celo tokens |
| 🔄 **Universal Swap** | 26+ tokens: Mento V2 (CELO ↔ stablecoins) + Uniswap V3 (all other pairs) |
| 🏦 **Aave Savings** | Supply cUSD/USDC to Aave V3 — earn ~3-5% APY |
| 🔒 **Staking** | Stake CELO → stCELO — earn ~4% APY (liquid, no lockup) |
| 💡 **Trade Ideas** | AI portfolio analysis + personalized DeFi recommendations |
| 📈 **Market Overview** | Full market dashboard for all Celo tokens |
| 🌉 **Bridge Info** | How to move tokens to/from Celo (Squid, Jumper, Wormhole) |
| 🔥 **DailyDrop Streak** | Check Proof of Presence streak + badge directly in agent |
| 🚀 **Token Launcher** | Deploy any ERC20 token on Celo in one transaction — name, symbol, supply |
| 🤖 **ERC-8004 Identity** | Verifiable on-chain agent identity |
| 🔐 **Self Agent ID** | ZK-verified onchain identity via Self Protocol |
| 📱 **MiniPay Compatible** | Auto-detect & auto-connect — zero friction for 15M+ users |
| ⚡ **Sub-cent fees** | Gas fees under $0.001 on Celo |
| 🔓 **Non-Custodial** | User signs every TX — agent never holds funds |

---

## 🔗 Smart Contracts

| Contract | Address | Network |
|----------|---------|---------|
| **TokenFactory** | [`0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e`](https://celoscan.io/address/0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e) | Celo Mainnet |
| ERC-8004 Identity | [`0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1`](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1) | Celo Mainnet |
| Mento V2 Broker | `0x777A8255cA72412f0d706dc03C9D1987306B4CaD` | Celo Mainnet |
| Uniswap V3 Router | `0x5615CDAb10dc425a742d643d949a7F474C01abc4` | Celo Mainnet |
| Aave V3 Pool | `0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402` | Celo Mainnet |
| stCELO Manager | `0x0239b96D10a434a56CC9E09383077A0490cF9398` | Celo Mainnet |

---

## 🚀 Quick Start

```bash
git clone https://github.com/wkalidev/celobank-agent.git
cd celobank-agent
npm install
cp .env.example .env
# Edit .env with your keys
npm run dev
# Open http://localhost:5173
```

### Environment Variables

```env
PRIVATE_KEY=0x...                 # Agent wallet (read-only ops only in v2)
CELO_RPC=https://forno.celo.org   # Celo Mainnet RPC
GROQ_API_KEY=gsk_...              # From console.groq.com (free)
```

---

## 🌐 REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/chat` | POST | Natural language AI agent |
| `/api/v1/prepare` | POST | Prepare unsigned TX (non-custodial) |
| `/api/v1/portfolio/:address` | GET | Full wallet portfolio |
| `/api/v1/prices` | GET | Real-time token prices |
| `/api/v1/aave/:address` | GET | Aave V3 position |
| `/api/v1/tokens` | GET | List all verified Celo tokens (88 from official token list) |
| `/health` | GET | API status |
| `/docs` | GET | Swagger UI |

### Non-Custodial Prepare Endpoint

```bash
POST /api/v1/prepare
{
  "action": "swap",
  "userAddress": "0xYOUR_WALLET",
  "params": { "amount": "10", "tokenOut": "cUSD" }
}

# Returns unsigned transactions the frontend signs with wagmi
```

**Supported actions**: `swap`, `supply_aave`, `send`, `stake`, `launch_token`, `get_tokens`, `get_trending`

| Action | Required params | Description |
|--------|-----------------|-------------|
| `swap` | `amount`, `tokenOut`, `tokenIn?` | Swap any token pair — Mento V2 or Uniswap V3 routing |
| `supply_aave` | `amount`, `asset?` | Deposit to Aave V3 |
| `send` | `to`, `amount` | Send CELO to an address |
| `stake` | `amount` | Stake CELO → stCELO |
| `launch_token` | `name`, `symbol`, `totalSupply` | Deploy a new ERC20 token on Celo |
| `get_tokens` | _(none)_ | List all tokens launched via the factory |
| `get_trending` | _(none)_ | Get the 5 most recently launched tokens |

---

## 💬 Example Interactions

```
👤 "swap 5 CELO to cUSD"
🤖 > PREPARING TX... Action: SWAP
   > Ready to swap 5 CELO → cUSD via Mento V2. Sign 2 transactions in your wallet.
   ✅ TX signed by YOUR wallet: 0xABC...

👤 "swap 10 cUSD to USDC"
🤖 > PREPARING TX... Action: SWAP
   > Ready to swap 10 cUSD → USDC via Uniswap V3 (0.3%). Sign 2 transactions.
   ✅ TX signed by YOUR wallet: 0xDEF...

👤 "stake 10 CELO"
🤖 > Ready to stake 10 CELO → stCELO (~4% APY). Sign 1 transaction.
   ✅ Staked! TX: https://celoscan.io/tx/0x...

👤 "trade ideas"
🤖 💡 Portfolio analysis + 5 personalized recommendations...

👤 "get bridge info"
🤖 🌉 Squid Router, Jumper Exchange, Wormhole — routes & fees...

👤 "launch a token called SunCoin, symbol SUN, 1 million supply"
🤖 > PREPARING TX... Action: LAUNCH_TOKEN
   > Ready to launch SunCoin (SUN) with 1,000,000 tokens. Sign 1 transaction.
   ✅ Token deployed! 📍 https://celoscan.io/address/0x...

👤 "show me trending tokens"
🤖 🔥 Trending on CeloBank — 5 most recent launches:
   1. SunCoin (SUN) — 1,000,000 supply
      📍 0x...
```

---

## 🏗️ Architecture

```
User (any language, any device)
       ↓
  React UI (Vite + wagmi + RainbowKit)
  ├── MiniPay auto-detection & auto-connect
  ├── detectDeFiAction() — swap/save/send/stake
  └── executePrepared() — signs via user wallet
       ↓
  Express API Server (Railway)
  ├── POST /api/v1/chat    → AI agent (read-only)
  └── POST /api/v1/prepare → unsigned TX builder
       ↓
  AI Agent (Groq — llama-3.3-70b-versatile)
  └── 19 tools across 4 files:
      ├── tools/celo.ts     → balance, send, price
      ├── tools/defi.ts     → swap, Aave
      ├── tools/staking.ts  → stCELO stake/unstake, yield options
      ├── tools/advanced.ts → trade ideas, market, bridge, DailyDrop
      ├── tools/launch.ts   → token launcher, list tokens, trending
      └── tools/prepare.ts  → unsigned TX builder (non-custodial)
       ↓
  Celo Mainnet (Chain ID: 42220)
```

---

## 🛠️ Tech Stack

- **Blockchain**: Celo L2 (OP Stack) — Mainnet
- **AI**: Groq Cloud — LLaMA 3.3-70b-versatile
- **On-chain**: viem v2
- **DeFi**: Mento V2, Aave V3, Staked CELO
- **Identity**: ERC-8004 + Self Protocol (ZK-verified)
- **UI**: React + Vite + wagmi + RainbowKit
- **API**: Express.js
- **Deploy**: Vercel (UI) + Railway (API)
- **Language**: TypeScript

---

## 📄 License

MIT © 2026 [@wkalidev](https://github.com/wkalidev)

---

<div align="center">

**Built with ❤️ for the unbanked · Powered by Celo Mainnet · Non-Custodial · ERC-8004 · Self Agent ID**

</div>