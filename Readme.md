<div align="center">

<img src="src/ui/logo.svg" alt="CeloBank Agent" width="120" height="120" />

# CeloBank Agent

### 🏗️ Open infrastructure for autonomous DeFi agents on Celo

[![npm](https://img.shields.io/badge/npm-@celobank%2Fagent--sdk-CB3837?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@celobank/agent-sdk)
[![Celo](https://img.shields.io/badge/Built%20on-Celo-35D07F?style=for-the-badge)](https://celo.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Deployed-FCFF52?style=for-the-badge)](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1)
[![Self Agent](https://img.shields.io/badge/Self_Agent_ID-Verified_%23171-6366f1?style=for-the-badge)](https://github.com/selfxyz/self-agent-id)
[![MiniPay](https://img.shields.io/badge/MiniPay-Compatible-35D07F?style=for-the-badge)](https://minipay.opera.com)
[![GoodBuilders](https://img.shields.io/badge/GoodBuilders-Season%204-00C853?style=for-the-badge)](https://celobuilders.xyz/hackathons/celo-onchain-agents)
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
| `send(params)` | Send CELO or any registered token (cUSD, cEUR, USDC, ...) to any address — defaults to CELO |
| `swap(params)` | Swap CELO → stablecoin via Mento V2 (legacy) |
| `swapTokens(params)` | Universal swap: Mento V2 or Uniswap V3 for 26+ token pairs |
| `launchToken(params)` | Deploy a new ERC20 token on Celo via TokenFactory |
| `getAavePosition(params?)` | Read Aave V3 position (collateral, debt, health factor) |
| `supplyAave(params)` | Deposit asset on Aave V3 to earn yield |
| `checkGoodDollar(params?)` | Read G$ balance + GoodDollar human verification status |
| `getEngagementRewards(params?)` | Read CeloBank engagement reward stats (users onboarded, G$ distributed) |
| `getCatalog(params?)` | Fetch live `/catalog` — tool list, pricing, idempotency, spend limits, failure/refund schema |

---

## ✨ Features (v2 — 24 tools)

| Feature | Description |
|---------|-------------|
| 💬 **Natural Language** | Chat in 19 languages: FR, EN, ES, AR, SW, IT, PT, ZH, HI, BN, YO, HA, AM, ID, DE, RU, TR, VI, TL |
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
| 🌱 **GoodDollar G$** | Check G$ balance, human verification status + referral engagement rewards |
| 🤖 **ERC-8004 Identity** | Verifiable on-chain agent identity |
| 🔐 **Self Agent ID** | ZK-identity binding via Self Protocol — agent #171 verified on-chain, proof valid until 2027-06-18 |
| 📱 **MiniPay Compatible** | Auto-detect & auto-connect — zero friction for 15M+ users |
| 🌱 **G$ Button in UI** | One-tap G$ status check — balance, verification, referral reward stats |
| ⚡ **Sub-cent fees** | Gas fees under $0.001 on Celo |
| 🔓 **Non-Custodial** | User signs every TX — agent never holds funds |

---

## 🔗 Smart Contracts

| Contract | Address | Network | Celoscan verified |
|----------|---------|---------|--------------------|
| **TokenFactory** | [`0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e`](https://celoscan.io/address/0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e#code) | Celo Mainnet | ✅ Verified — Exact Match |
| ERC-8004 Identity | [`0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1`](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1#code) | Celo Mainnet | ✅ Verified — Exact Match |
| Mento V2 Broker | `0x777A8255cA72412f0d706dc03C9D1987306B4CaD` | Celo Mainnet | |
| Uniswap V3 Router | `0x5615CDAb10dc425a742d643d949a7F474C01abc4` | Celo Mainnet | |
| Aave V3 Pool | `0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402` | Celo Mainnet | |
| stCELO Manager | `0x0239b96D10a434a56CC9E09383077A0490cF9398` | Celo Mainnet | |
| **GoodDollar EngagementRewards** | [`0x25db74CF4E7BA120526fd87e159CF656d94bAE43`](https://celoscan.io/address/0x25db74CF4E7BA120526fd87e159CF656d94bAE43) | Celo Mainnet | |
| GoodDollar IdentityV4 | [`0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`](https://celoscan.io/address/0xC361A6E67822a0EDc17D899227dd9FC50BD62F42) | Celo Mainnet | |
| G$ Token | [`0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A`](https://celoscan.io/address/0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A) | Celo Mainnet | |

`TokenFactory` (`v0.8.28+commit.7893614a`) and `ERC-8004 Identity` (`v0.8.25+commit.b61c2a91`)
are our own contracts, both confirmed as **Source Code Verified — Exact Match** on Celoscan.

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
ANTHROPIC_API_KEY=sk-ant-...      # From console.anthropic.com
GROQ_API_KEY=gsk_...              # Optional fallback if ANTHROPIC_API_KEY not set
```

---

## 🌐 REST API

| Endpoint | Method | Rate limit | Description |
|----------|--------|-----------|-------------|
| `/api/v1/chat` | POST | 20/min | Natural language AI agent |
| `/chat` | POST | 20/min | Alias (same behavior) |
| `/api/v1/prepare` | POST | 30/min | Prepare unsigned TX (non-custodial) |
| `/api/v1/portfolio/:address` | GET | 20/min | Full wallet portfolio (runs LLM) |
| `/api/v1/aave/:address` | GET | 20/min | Aave V3 position (runs LLM) |
| `/api/v1/prices` | GET | 60/min | Real-time token prices (proxied) |
| `/api/v1/tokens` | GET | 60/min | All verified Celo tokens (proxied) |
| `/mcp` | POST | 60/min | MCP JSON-RPC — 14 free read tools + 7 paid write tools (x402) |
| `/catalog` | GET | — | x402 machine-readable service catalog |
| `/.well-known/agent-card.json` | GET | — | OASF-compliant agent card |
| `/health` | GET | — | API status |
| `/docs` | GET | — | Swagger UI |

### POST /mcp — Model Context Protocol

CeloBank Agent exposes a full MCP server at `POST /mcp`. Agents and AI clients can call all 24 tools directly over JSON-RPC.

**Free read tools (15)**: `get_balance`, `get_portfolio`, `get_celo_price`, `get_multi_price`, `get_aave_position`, `get_staking_position`, `get_yield_options`, `trade_ideas`, `get_market_overview`, `get_bridge_info`, `get_dailydrop_status`, `get_tokens`, `get_trending_tokens`, `check_gooddollar`, `get_engagement_rewards`

**Paid write tools (9)** — require `X-PAYMENT` header (0.001 cUSD on Celo Mainnet via x402):
`send_celo`, `swap_celo`, `swap_tokens`, `save_cusd`, `stake_celo`, `unstake_celo`, `continue_unstake`, `claim_unstake`, `launch_token`

```bash
# Free read tool — no payment needed
curl -X POST https://celobank-agent-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_portfolio","arguments":{"address":"0xYOUR..."}},"id":1}'

# Write tool — requires X-PAYMENT header
curl -X POST https://celobank-agent-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <x402-payment-payload>" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"swap_tokens","arguments":{"userAddress":"0x...","tokenIn":"CELO","tokenOut":"cUSD","amount":"5"}},"id":2}'
```

The x402 payment flow: agent pays 0.001 cUSD → server verifies on-chain → executes action → settles. Insufficient payment returns HTTP 402. Use `GET /catalog` to discover pricing and schema.

### GET /catalog — Agent-to-Agent Commerce

Machine-readable JSON declaration for autonomous agent discovery. All fields are read-only and declarative — no middleware or enforcement.

```jsonc
{
  "schema": "x402-catalog/1.0",
  "generatedAt": "<ISO8601>",

  // Service identity + live health
  "service": {
    "id": "celobank-agent",
    "version": "2.0.0",
    "baseUrl": "https://celobank-agent-production.up.railway.app",
    "health": {
      "endpoint": "/health",
      "status": "operational",   // always set when handler is reachable
      "uptime": 3721             // live process.uptime() in seconds
    }
  },

  // Safe-retry contract for write tools
  "idempotency": {
    "header": "Idempotency-Key",
    "behavior": "Safe retries — identical Idempotency-Key within 24h returns the original result without re-executing the on-chain action",
    "window": "24h"
  },

  // Advisory spend caps (not enforced server-side)
  "spendLimits": {
    "perCall": { "max": "100",  "currency": "cUSD" },
    "perDay":  { "max": "1000", "currency": "cUSD" },
    "note": "Advisory limits; agents should not exceed without explicit user approval"
  },

  // x402 payment config, schemas (402 response, receipt, failure/refund), tools...
  "schemas": {
    "failureRefund": {
      "states": ["pending", "settled", "failed", "refunded"],
      "behavior": {
        "onFailure": "Payment is not captured — settlement occurs only on success",
        "onRevert":  "If an on-chain action reverts after payment, the X-PAYMENT is voided and not settled"
      },
      "sampleFailureResponse": {
        "status": 200,
        "body": {
          "error": {
            "code": "ON_CHAIN_REVERT",
            "message": "Transaction reverted — swap failed due to insufficient liquidity",
            "paymentStatus": "refunded",
            "txHash": null
          }
        }
      }
    }
  }
}
```

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
| `send` | `to`, `amount`, `token?` | Send CELO or any registered token (cUSD, cEUR, USDC, ...) to an address — defaults to CELO |
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
  AI Agent (Anthropic Claude Sonnet 4.6)
  └── 24 tools across 7 files:
      ├── tools/celo.ts        → balance, send, price
      ├── tools/defi.ts        → swap, Aave
      ├── tools/staking.ts     → stCELO stake/unstake, yield options
      ├── tools/advanced.ts    → trade ideas, market, bridge, DailyDrop
      ├── tools/launch.ts      → token launcher, list tokens, trending
      ├── tools/gooddollar.ts  → G$ balance, identity verification, engagement rewards
      └── tools/prepare.ts     → unsigned TX builder (non-custodial)
       ↓
  Celo Mainnet (Chain ID: 42220)
```

---

## 🛠️ Tech Stack

- **Blockchain**: Celo L2 (OP Stack) — Mainnet
- **AI**: Anthropic Claude Sonnet 4.6 (primary) / Groq LLaMA 3.3-70b (fallback)
- **On-chain**: viem v2
- **DeFi**: Mento V2, Aave V3, Staked CELO
- **Identity**: ERC-8004 + Self Protocol (integration in progress)
- **UI**: React + Vite + wagmi + RainbowKit
- **API**: Express.js
- **Deploy**: Vercel (UI) + Railway (API)
- **Language**: TypeScript

---

## ⚡ Performance & MiniPay Compliance

### PageSpeed / Core Web Vitals

| Optimization | Details |
|---|---|
| **Non-blocking fonts** | Google Fonts loaded via `preload` + `onload` swap — no render-blocking request |
| **LCP preload** | `<link rel="preload" href="/logo.svg" as="image">` ensures LCP image is fetched first |
| **API timeout** | Self-agent status fetch aborts after 3s — Railway cold starts don't delay render |
| **Meta description** | Added `<meta name="description">` for search snippet and PageSpeed compliance |
| **Touch targets** | All interactive elements ≥44×44px (footer links, quick-action buttons) |
| **Security headers** | `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` served via Vercel |

### MiniPay Compliance Checklist

| Requirement | Status |
|---|---|
| Auto-detect `window.ethereum.isMiniPay` | ✅ `detectMiniPay()` runs on mount |
| Auto-connect wallet (no button required) | ✅ `useEffect` connects `injected` connector immediately |
| Hide Connect button in MiniPay | ✅ `{!isMiniPay && !isFarcaster && <ConnectButton />}` |
| Celo Mainnet only (Chain 42220) | ✅ `wallet_switchEthereumChain` enforced on launch |
| Mobile viewport ≥360px, `minimum-scale=1.0` | ✅ viewport meta includes `minimum-scale=1.0` |
| Gas in cUSD (`feeCurrency`) | ✅ All MiniPay transactions set `feeCurrency: CUSD_ADDRESS` |
| Terms & Privacy accessible in-app | ✅ `/terms.html` and `/privacy.html` open within the WebView (`target="_self"`) |
| Support URL in footer | ✅ `https://github.com/wkalidev/celobank-agent/issues` |
| Graceful error handling | ✅ All wallet and API errors caught and surfaced as chat messages |
| Deeplink parsing (`?to=&amount=&token=`) | ✅ URL params pre-fill the input on load |

---

## 🏷️ On-Chain Attribution

Every transaction CeloBank Agent prepares gets a [Celo Builders (ERC-8021)](https://docs.celo.org/build-on-celo/attribution-tags)
attribution suffix appended to its calldata via a single choke point
(`applyAttribution` in `src/lib/attribution.ts`), called once for every successful
`PrepareResult` right before it's returned. Because every entry point — REST
`/api/v1/prepare`, chat `/api/v1/chat` & `/chat`, and MCP `tools/call` — ultimately
routes through the same `prepare*` / `launch*` functions, tagging covers every write
path with no per-route special-casing and no way for a new entry point to skip it.

A Divvi referral-tag integration was evaluated here in July 2026 and has since been
**removed**: `@divvi/referral-sdk` was deprecated on npm, the `divvi-xyz` GitHub org
was archived, and `app.divvi.xyz` no longer resolves. Only the Celo Builders tag
above remains.

---

## 🌱 GoodBuilders Season 4

CeloBank Agent is participating in **[GoodBuilders Season 4](https://celobuilders.xyz/hackathons/celo-onchain-agents)** — building AI agents on Celo with GoodDollar integration.

### GoodDollar Integration

| Component | Detail |
|-----------|--------|
| G$ Token | [`0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A`](https://celoscan.io/address/0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A) — SuperGoodDollar on Celo |
| EngagementRewards | [`0x25db74CF4E7BA120526fd87e159CF656d94bAE43`](https://celoscan.io/address/0x25db74CF4E7BA120526fd87e159CF656d94bAE43) — $0.50 G$ per verified user |
| IdentityV4 | [`0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`](https://celoscan.io/address/0xC361A6E67822a0EDc17D899227dd9FC50BD62F42) — human verification |
| Registration TX | [`0x4f9c9108...`](https://celoscan.io/tx/0x4f9c91083e103d663a39469fe173ec51096be941b22a18a69c4237df37fe110f) — CeloBank registered on-chain |

### What's integrated

- **`check_gooddollar` agent tool** — reads G$ balance + `isVerified` / `getIdentityExpiry` from IdentityV4 for any wallet
- **`get_engagement_rewards` agent tool** — reads `appsStats()` from EngagementRewards: users onboarded, total G$ distributed
- **🌱 G$ button in the UI** — one-tap G$ status check in both desktop sidebar and mobile quick-action strip
- **SDK methods** — `checkGoodDollar()` and `getEngagementRewards()` available in `@celobank/agent-sdk`
- **CeloBank registered** with EngagementRewards contract (pending GoodDollar approval) — earns $0.50 G$ per new verified user onboarded

### Try it

```
👤 "check my GoodDollar G$ balance and verification status"
🤖 🌱 GoodDollar (G$) Status:
   > Address: 0xYour...
   > G$ Balance: 12.4500 G$
   > Verified Human: ✅ Yes — identity expires 12/31/2026
   💡 Your identity is verified! Invite friends to CeloBank to earn $0.50 G$ per new user.

👤 "show engagement rewards"
🤖 🎁 CeloBank × GoodDollar Engagement Rewards:
   > Users Onboarded: 47
   > Total G$ Distributed: 23.50 G$
   >   └ To Users: 18.80 G$
   >   └ To Inviters: 4.70 G$
   > Reward per New User: 0.5000 G$
```

---

## 🔒 Security

| Layer | Detail |
|-------|--------|
| **CORS** | Browser requests restricted to known origins; non-browser clients (curl, Node.js, mobile) pass through |
| **Rate limiting** | Per-endpoint limits: chat 20/min, prepare 30/min, LLM-backed GETs 20/min, proxied GETs 60/min, MCP 60/min |
| **Input validation** | All POST bodies validated (type, length, format); addresses and amounts checked before any blockchain call |
| **x402 enforcement** | Write tools on `/mcp` require a verified on-chain payment before execution |
| **Error sanitization** | Tool errors logged server-side; clients receive generic messages — no internal stack traces or API keys leaked |
| **Supabase RLS** | Migration `supabase/migrations/20260630_rls_policies.sql` defines `agent_actions` (service-role only) and `agent_stats` (public SELECT, writes service-role only). ⚠️ Not yet wired into the running server — no code path currently reads or writes these tables. Policies are ready to activate once logging is implemented. |
| **No SQL** | All blockchain interaction via viem — no SQL queries, no SQL injection surface |
| **Secrets** | All credentials in `.env` (gitignored); no hardcoded keys in source |
| **Headers** | `X-Powered-By` removed; `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` set |
| **Non-custodial enforcement** | Every write action (chat tool-calling AND `/api/v1/prepare`) returns an unsigned transaction — the agent wallet (`PRIVATE_KEY`) is never used to sign or broadcast user-initiated transactions, only for read-only RPC calls |
| **Slippage protection** | Live quotes before every swap — Mento V2 via `Broker.getAmountOut`, Uniswap V3 via `QuoterV2` — with a 1% default tolerance applied to the on-chain minimum-output guard |

---

## 🔐 Self Agent ID

CeloBank Agent integrates [Self Agent ID](https://github.com/selfxyz/self-agent-id), a ZK proof-of-human binding for autonomous agents that extends ERC-8004.

Self Agent ID proves an autonomous agent is bound to a real verified human via a ZK passport proof, without revealing personal data. This satisfies the "ERC-8004 registration and Self Agent ID compliance" criterion in grant programs that score on-chain identity compliance independently.

**Status: VERIFIED** — `isVerifiedAgent: true` confirmed on-chain. ZK passport proof submitted by the agent owner and recorded in the Self registry on 2026-06-18. Proof valid until **2027-06-18**.

- Self registry (Celo Mainnet): [`0xaC3DF9ABf80d0F5c020C06B04Cced27763355944`](https://celoscan.io/address/0xaC3DF9ABf80d0F5c020C06B04Cced27763355944)
- Network: Celo Mainnet (Chain ID 42220)
- Agent ID: `#171`
- Agent address: [`0x1d4f46f24e353acdf9a6cc40f8eeDfb9F3C51646`](https://celoscan.io/address/0x1d4f46f24e353acdf9a6cc40f8eeDfb9F3C51646)
- The in-app badge shows "VERIFIED ✓" and reflects live on-chain status

---

## 📄 License

MIT © 2026 [@wkalidev](https://github.com/wkalidev)

---

<div align="center">

**Built with ❤️ for the unbanked · Powered by Celo Mainnet · Non-Custodial · ERC-8004 · Self Agent ID**

</div>