# CeloBank Agent: Open Infrastructure for Autonomous DeFi on Celo

**Version 2.0 · June 2026**

---

## Abstract

1.4 billion adults worldwide remain unbanked — not because financial tools do not exist, but because existing interfaces assume literacy, documentation, stable connectivity, and minimum balances that billions do not have (World Bank Global Findex, 2021). Decentralized finance solves the trust and access problem at the infrastructure layer, but replaces it with an interface problem: wallets, gas fees, slippage, health factors, and protocol-specific UX remain inaccessible to the people who would benefit most.

CeloBank Agent addresses the interface problem directly. It is a non-custodial, conversational DeFi agent deployed on Celo Mainnet (Chain ID 42220) that exposes 21 on-chain tools — swapping, lending, staking, token launch, yield discovery, and more — through natural language in 19 languages. Users sign every transaction with their own wallet; the agent never holds funds or private keys.

CeloBank Agent is also an open platform. The `@celobank/agent-sdk` npm package (v1.0.9) lets any developer build their own autonomous DeFi agent on Celo in minutes. A machine-readable `/catalog` endpoint — implementing the x402-catalog/1.0 schema — enables autonomous agent-to-agent commerce: any AI agent can discover, price, and call CeloBank tools programmatically without human mediation.

This document describes the system's architecture, protocol integrations, security model, and on-chain identity as they exist today. Planned future work is clearly labeled as **Roadmap**.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [Architecture](#3-architecture)
4. [DeFi Protocol Integrations](#4-defi-protocol-integrations)
5. [Ecosystem Integrations](#5-ecosystem-integrations)
6. [Agent-to-Agent Commerce](#6-agent-to-agent-commerce)
7. [Open Source SDK](#7-open-source-sdk)
8. [Security Model](#8-security-model)
9. [On-Chain Identity](#9-on-chain-identity)
10. [Roadmap](#10-roadmap)
11. [Token](#11-token)
12. [Conclusion](#12-conclusion)
13. [References](#13-references)

---

## 1. Problem Statement

### 1.1 The Unbanked Population

According to the World Bank Global Findex 2021, approximately **1.4 billion adults** globally lack access to a financial account. This population is concentrated in Sub-Saharan Africa (57% account ownership vs. 94% in high-income economies), South Asia, Latin America, and Southeast Asia — precisely the regions where Celo and GoodDollar focus.

The barriers are well-documented:

- **Geographic exclusion**: no physical bank branches within reachable distance
- **Documentation requirements**: national ID, proof of address, employment records
- **Minimum balance requirements**: fees that make small accounts economically unviable
- **Language barriers**: financial products available only in dominant languages

Mobile money (M-Pesa in East Africa, GCash in the Philippines) has made real progress on access. But mobile money is custodial, centralized, and still requires local agent networks. It does not give users control over their own funds or access to global DeFi yields.

### 1.2 DeFi's Interface Problem

Decentralized finance solves the custody and trust problem: anyone with a smartphone and an internet connection can access lending, stablecoins, and yield protocols without a bank account. Celo specifically was designed for this: sub-cent gas fees, mobile-first design, and a suite of emerging-market stablecoins (cUSD, cEUR, KESm, NGNm, GHSm, and others).

But the current DeFi interface requires users to understand:

- Wallet concepts (seed phrases, gas, nonces)
- Protocol-specific UX (Mento swap routing, Aave health factors, staking unbonding periods)
- Token approval flows, slippage, price impact
- Bridge mechanics when moving assets across chains

This is a significant cognitive burden. A first-time user in Lagos, Nairobi, or Jakarta — who would benefit enormously from DeFi yield and stablecoin access — cannot realistically navigate current DeFi interfaces.

CeloBank Agent's thesis is that a conversational AI layer, deployed non-custodially with clear language support and deep protocol expertise baked into its system prompt, can close this gap.

---

## 2. Solution Overview

CeloBank Agent is two things simultaneously:

**A live non-custodial DeFi agent** — deployed at [celobank-agent.vercel.app](https://celobank-agent.vercel.app), serving real users on Celo Mainnet today. Users connect their own wallet (MiniPay, MetaMask, Coinbase Wallet, or any EIP-1193 compatible wallet) and interact via natural language. The agent prepares unsigned transactions; the user signs in their wallet. The agent never holds funds.

**Open infrastructure for agent developers** — `@celobank/agent-sdk` is a published TypeScript npm package providing typed access to Celo DeFi protocols. Any developer can install it and build their own autonomous agent in minutes. A `/catalog` endpoint provides a machine-readable service manifest enabling agent-to-agent discovery and commerce.

### Key Properties (Current, Verified)

| Property | Value |
|---|---|
| Network | Celo Mainnet (Chain ID 42220) |
| Agent tools | 21 |
| Languages supported | 19 |
| Custody model | Non-custodial — user signs all transactions |
| AI primary | Anthropic Claude Sonnet 4.6 |
| AI fallback | Groq LLaMA 3.3-70b |
| SDK | `@celobank/agent-sdk` v1.0.9 |
| On-chain identity | ERC-8004 agent #9225 |
| Token | None |

---

## 3. Architecture

### 3.1 Non-Custodial Design

CeloBank Agent v2 separates reading from writing at the API boundary. All DeFi operations that modify on-chain state are handled via a dedicated unsigned transaction builder, never by the agent itself.

```
User (any language, any device)
         │
         ▼
   React UI (Vite + wagmi + RainbowKit)
   ├── MiniPay auto-detection & auto-connect
   ├── Farcaster Mini App detection (sdk.context)
   └── detectDeFiAction() — identifies swap/save/send/stake intent
         │
         ├─── Chat messages ──────────────▶ POST /api/v1/chat
         │                                  AI agent (read-only)
         │                                  returns natural language
         │
         └─── DeFi actions ──────────────▶ POST /api/v1/prepare
                                            Returns unsigned transactions
                                                    │
                                                    ▼
                                          User wallet (MiniPay / RainbowKit)
                                          User signs — agent never signs
                                                    │
                                                    ▼
                                          Celo Mainnet — TX broadcast
```

Every transaction that moves funds on-chain requires an explicit signature from the user's own wallet. The agent wallet (used for read-only RPC calls at startup) never signs user transactions.

### 3.2 AI Layer

**Primary model**: Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`)

Claude receives a detailed system prompt covering: protocol parameters (Mento slippage, Aave health factors, stCELO unbonding), security rules (jailbreak detection, no unsolicited transactions, no private key discussion), language detection instructions, and a per-session wallet address injection that ensures tool calls always target the connected user's address rather than the agent wallet.

The agent runs a tool-call loop with a maximum of 5 iterations per request. Tools classified as `DIRECT_RETURN_TOOLS` (swap, send, save, stake, and all other write-adjacent tools) return their formatted output directly to the user rather than feeding it back into the model — preventing the model from paraphrasing unsigned transaction data.

**Fallback model**: Groq LLaMA 3.3-70b Versatile (`llama-3.3-70b-versatile`)

If the Anthropic API is unavailable or returns an error, the agent falls back to Groq using the OpenAI-compatible API. The same tool schemas and system prompt are used; Groq receives them in the OpenAI function-calling format.

### 3.3 Language Detection

Language detection runs server-side in `src/server.ts` via a `detectLanguage()` function. Detection is ordered to avoid false positives:

1. **Non-Latin Unicode ranges first** (unambiguous): Devanagari (Hindi), Bengali, Ethiopic (Amharic), Cyrillic (Russian), CJK (Chinese), Arabic
2. **Latin with unique diacritics**: Vietnamese (ơ, ư, đ + vocabulary), Yoruba (ẹ, ọ, ṣ), Portuguese (ã, õ + vocabulary), German (ß, or ä/ö/ü + vocabulary)
3. **Latin vocabulary matching**: French, Italian, Spanish, Swahili, Turkish, Indonesian, Tagalog, Hausa
4. **Default**: English

**Supported languages (19):**

| Code | Language | Script/Detection |
|------|----------|-----------------|
| `hi` | Hindi | Devanagari (U+0900–U+097F) |
| `bn` | Bengali | Bengali (U+0980–U+09FF) |
| `am` | Amharic | Ethiopic (U+1200–U+137F) |
| `ru` | Russian | Cyrillic (U+0400–U+04FF) |
| `zh` | Chinese | CJK (U+4E00–U+9FFF, U+3400–U+4DBF) |
| `ar` | Arabic | Arabic (U+0600–U+06FF) |
| `vi` | Vietnamese | ơ, ư, đ + vocabulary |
| `yo` | Yoruba | ẹ, ọ, ṣ diacritics |
| `pt` | Portuguese | ã, õ + vocabulary |
| `de` | German | ß, or ä/ö/ü + vocabulary |
| `fr` | French | Vocabulary (je, tu, il, nous…) |
| `it` | Italian | Vocabulary (io, tu, lui, sono…) |
| `es` | Spanish | Vocabulary (yo, tú, él, hola…) |
| `sw` | Swahili | Vocabulary (habari, asante, karibu…) |
| `tr` | Turkish | ş, ğ + vocabulary |
| `id` | Indonesian | Vocabulary (saya, tidak, dengan…) |
| `tl` | Tagalog/Filipino | Vocabulary (ako, ikaw, salamat…) |
| `ha` | Hausa | Vocabulary (yana, tana, kuma…) |
| `en` | English | Default |

### 3.4 Tool Architecture

21 tools are exposed to the AI via the Anthropic tool schema (`anthropicTools` in `src/agent/agent.ts`), organized across six source modules:

| Module | Tools |
|--------|-------|
| `tools/celo.ts` | `get_balance`, `send_celo`, `get_celo_price` |
| `tools/defi.ts` | `get_portfolio`, `get_multi_price`, `swap_celo`, `swap_tokens`, `get_aave_position`, `save_cusd` |
| `tools/staking.ts` | `stake_celo`, `unstake_celo`, `get_staking_position`, `get_yield_options` |
| `tools/advanced.ts` | `trade_ideas`, `get_market_overview`, `get_bridge_info`, `get_dailydrop_status` |
| `tools/launch.ts` | `launch_token`, `get_tokens`, `get_trending_tokens` |
| `tools/gooddollar.ts` | `check_gooddollar`, `get_engagement_rewards` |

### 3.5 Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| UI (React + Vite) | Vercel | `celobank-agent.vercel.app` |
| API (Express.js) | Railway | `celobank-agent-production.up.railway.app` |

### 3.6 Tech Stack

- **Blockchain interface**: viem v2
- **UI**: React 18 + Vite + wagmi + RainbowKit
- **API**: Express.js + TypeScript (ESM, Node ≥18)
- **AI**: `@anthropic-ai/sdk` (primary), Groq OpenAI-compatible API (fallback)
- **Language**: TypeScript throughout

---

## 4. DeFi Protocol Integrations

All protocol integrations are live on Celo Mainnet. Contract addresses are verifiable on Celoscan.

### 4.1 Mento V2 — Universal Stablecoin Exchange

**Contract**: [`0x777A8255cA72412f0d706dc03C9D1987306B4CaD`](https://celoscan.io/address/0x777A8255cA72412f0d706dc03C9D1987306B4CaD)

Mento V2 is Celo's native algorithmic stablecoin exchange, providing low-slippage swaps (~0.1–0.3%) between CELO and 25+ stablecoins. The `swap_tokens` tool uses Mento V2 as the router for CELO↔stablecoin pairs.

Supported Mento stablecoins: cUSD/USDm, cEUR/EURm, cREAL/BRLm, KESm (Kenyan shilling), NGNm (Nigerian naira), GHSm (Ghanaian cedi), XOFm (West African franc), ZARm (South African rand), GBPm, PHPm, COPm, CADm, AUDm, CHFm, JPYm.

The `swap_celo` tool (legacy) handles CELO-to-stablecoin only. The `swap_tokens` tool provides universal routing: Mento V2 for CELO↔stablecoin pairs, Uniswap V3 for all other pairs.

### 4.2 Aave V3 — Lending and Borrowing

**Contract**: [`0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402`](https://celoscan.io/address/0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402)

Aave V3 on Celo supports cUSD and USDC deposits, currently yielding approximately 3–5% APY (variable, dependent on utilization). The `save_cusd` tool prepares the supply transaction; the user signs and broadcasts it.

The agent's system prompt includes mandatory risk disclosure for all Aave interactions: health factor explanation (liquidation threshold: health factor < 1.0), variable APY disclosure, smart contract risk warning, and a suggestion to test with a small amount first for deposits over $500.

### 4.3 Staked CELO — Liquid Staking

**Contract**: [`0x0239b96D10a434a56CC9E09383077A0490cF9398`](https://celoscan.io/address/0x0239b96D10a434a56CC9E09383077A0490cF9398)

The Staked CELO (stCELO) protocol provides liquid staking at approximately 4% APY with no lockup period. Unstaking has a ~3-day unbonding period. stCELO is lower risk than Aave (no liquidation risk) and is recommended in the agent's yield guidance for conservative users.

Tools: `stake_celo` (prepare stake TX), `unstake_celo` (prepare unstake TX), `get_staking_position` (read stCELO balance + current APY).

### 4.4 Uniswap V3 on Celo

**Contract**: [`0x5615CDAb10dc425a742d643d949a7F474C01abc4`](https://celoscan.io/address/0x5615CDAb10dc425a742d643d949a7F474C01abc4)

Uniswap V3 on Celo handles non-Mento token pairs at a 0.3% fee tier. Supported tokens include USDC, USDT, WETH, WBTC, stCELO, UBE, USDGLO, EURC, and others. The `swap_tokens` tool routes to Uniswap V3 automatically for pairs not handled by Mento.

### 4.5 Token Factory — ERC-20 Deployment

**Contract**: [`0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e`](https://celoscan.io/address/0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e)

The CeloBank Token Factory allows any user to deploy a new ERC-20 token on Celo Mainnet in a single transaction at negligible gas cost (~0.001 CELO). The `launch_token` tool prepares the deployment transaction; the `get_tokens` and `get_trending_tokens` tools enumerate all tokens previously launched through the factory.

All deployed tokens are publicly visible on Celoscan. The agent's system prompt includes mandatory launch warnings: permanence, public visibility, listing requirements for DEX tradability, and legal/reputational risk of misleading token names.

### 4.6 GoodDollar — UBI and Human Verification

| Contract | Address |
|----------|---------|
| G$ Token (SuperGoodDollar on Celo) | [`0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A`](https://celoscan.io/address/0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A) |
| EngagementRewards | [`0x25db74CF4E7BA120526fd87e159CF656d94bAE43`](https://celoscan.io/address/0x25db74CF4E7BA120526fd87e159CF656d94bAE43) |
| IdentityV4 | [`0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`](https://celoscan.io/address/0xC361A6E67822a0EDc17D899227dd9FC50BD62F42) |

GoodDollar provides Universal Basic Income via the G$ token. On Celo, G$ is a bridged token (UBI claiming happens on Ethereum/Fuse; the Celo version is the bridged SuperGoodDollar).

CeloBank is registered with GoodDollar's EngagementRewards contract ([registration TX](https://celoscan.io/tx/0x4f9c91083e103d663a39469fe173ec51096be941b22a18a69c4237df37fe110f)), earning $0.50 G$ per new verified user onboarded through the platform (pending GoodDollar approval flow).

Tools: `check_gooddollar` (G$ balance + `isVerified` / `getIdentityExpiry` from IdentityV4), `get_engagement_rewards` (users onboarded + total G$ distributed from `appsStats()`).

### 4.7 DailyDrop — Proof of Presence Streaks

The `get_dailydrop_status` tool reads DailyDrop streak data for any address — current streak, badge, and reward eligibility. Daily check-ins require the user's wallet signature and are executed via the dedicated CHECK_IN button in the UI; the agent cannot perform check-ins on the user's behalf (non-custodial constraint, enforced in the system prompt).

---

## 5. Ecosystem Integrations

### 5.1 MiniPay

CeloBank Agent auto-detects the MiniPay browser environment and auto-connects the user's wallet without requiring any manual connection step. MiniPay is Opera's mobile crypto wallet integrated into the Opera Mini browser, with over 15 million users primarily in Sub-Saharan Africa. Detection runs at startup via a UA/provider check (`detectMiniPay()` in `src/ui/App.tsx`).

### 5.2 Farcaster Mini App

CeloBank Agent is deployed as a **Farcaster Mini App** using `@farcaster/miniapp-sdk`. On load, it checks `sdk.context` for a Farcaster user context. If detected, it auto-connects the wallet via the Farcaster connector and calls `sdk.actions.ready()` to dismiss the splash screen. The Farcaster Mini App manifest is served at `/.well-known/farcaster.json`, registered to the `celobank-agent.vercel.app` domain with a Neynar webhook for notifications.

### 5.3 Self Protocol

CeloBank Agent is registered with Self Protocol for ZK-verified on-chain identity. A Self Agent ID badge is visible in the UI. Self Protocol allows users to verify real-world identity attributes (nationality, age, etc.) using zero-knowledge proofs derived from passport/ID document data, without exposing the underlying document.

### 5.4 Bridge Routing

The `get_bridge_info` tool provides routing guidance for moving assets to and from Celo via Squid Router, Jumper Exchange, and Wormhole. The tool is informational — it does not prepare bridge transactions; those require the respective bridge's own interface.

---

## 6. Agent-to-Agent Commerce

### 6.1 Machine-Readable Service Catalog

CeloBank Agent exposes a `GET /catalog` endpoint implementing the **x402-catalog/1.0** schema. This endpoint provides a machine-readable JSON manifest that any AI agent can fetch to discover, understand, and autonomously call CeloBank's services — without human configuration.

The catalog includes:

- **Service identity**: `id`, `name`, `version`, `baseUrl`, `entrypoint`, `network`, `chainId`
- **Live health**: `service.health.status` ("operational") and `service.health.uptime` (live `process.uptime()` in seconds)
- **Tool list**: all 21 tools with input schemas, descriptions, categories (`read`/`write`), and per-tool pricing
- **Pricing**: read tools are free; write tools are priced at 0.001 cUSD per call via the x402 payment protocol
- **Idempotency contract**: `Idempotency-Key` header behavior (24h safe-retry window)
- **Advisory spend limits**: 100 cUSD per call, 1,000 cUSD per day
- **Payment schema**: 402 response shape, receipt format (`X-PAYMENT-RECEIPT`), failure/refund state machine

```json
{
  "schema": "x402-catalog/1.0",
  "generatedAt": "<ISO8601>",
  "service": {
    "id": "celobank-agent",
    "version": "2.0.0",
    "health": { "status": "operational", "uptime": 3721 }
  },
  "idempotency": {
    "header": "Idempotency-Key",
    "behavior": "Safe retries — identical key within 24h returns original result",
    "window": "24h"
  },
  "spendLimits": {
    "perCall": { "max": "100", "currency": "cUSD" },
    "perDay":  { "max": "1000", "currency": "cUSD" }
  }
}
```

### 6.2 x402 Payment Protocol

The x402 protocol is an HTTP 402-based micropayment scheme for machine-to-machine payments. A calling agent includes an `X-PAYMENT` header with a signed payment authorization; on success, the server returns an `X-PAYMENT-RECEIPT` header confirming settlement.

CeloBank Agent's x402 configuration:

| Parameter | Value |
|-----------|-------|
| Payment token | cUSD at `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| Chain | Celo Mainnet (42220) |
| Price per write call | 0.001 cUSD |
| Facilitator | `https://x402.org/facilitator` |
| Required request header | `X-PAYMENT` |
| Receipt response header | `X-PAYMENT-RECEIPT` |

Payment is not captured on failure. If an on-chain action reverts after payment authorization, the `X-PAYMENT` is voided and not settled. The catalog's `schemas.failureRefund` field documents this guarantee with explicit state transitions: `pending → settled | failed | refunded`.

> **Note**: x402 payment enforcement is declared in the catalog but not yet enforced at the server middleware layer. The catalog is an accurate declaration of the intended contract; enforcement is on the roadmap.

### 6.3 MCP Endpoint

CeloBank Agent exposes a JSON-RPC endpoint at `POST /mcp` implementing the **Model Context Protocol** (protocol version `2024-11-05`). Supported methods:

- `initialize` — returns server info, protocol version, and `capabilities: { tools: {} }`
- `tools/list` — returns all 21 tool names and descriptions
- `tools/call` — redirects callers to `/api/v1/chat` or `/api/v1/prepare` for actual execution

The MCP endpoint enables MCP-compatible AI orchestration frameworks to enumerate CeloBank Agent's tools programmatically.

---

## 7. Open Source SDK

### 7.1 Package

```
npm install @celobank/agent-sdk
```

- **npm**: `@celobank/agent-sdk` v1.0.9
- **Weekly downloads**: ~1,118 (as of June 2026 — verify current figure at npmjs.com)
- **License**: MIT
- **Runtime**: TypeScript, ESM, Node ≥18
- **Dependencies**: viem v2, zod

### 7.2 SDK Methods

| Method | Description |
|--------|-------------|
| `getPortfolio(params?)` | Native CELO + all ERC-20 balances for any address |
| `getPrices(params?)` | Real-time USD prices + 24h change via CoinGecko |
| `send(params)` | Send native CELO to any address |
| `swap(params)` | Swap CELO → stablecoin via Mento V2 (legacy) |
| `swapTokens(params)` | Universal swap: Mento V2 or Uniswap V3 for 26+ token pairs |
| `launchToken(params)` | Deploy a new ERC-20 token on Celo via TokenFactory |
| `getAavePosition(params?)` | Read Aave V3 position (collateral, debt, health factor) |
| `supplyAave(params)` | Deposit cUSD/USDC to Aave V3 to earn yield |
| `checkGoodDollar(params?)` | G$ balance + GoodDollar human verification status |
| `getEngagementRewards(params?)` | Users onboarded + G$ distributed from EngagementRewards |
| `getCatalog(params?)` | Fetch live `/catalog` — tool list, pricing, payment schema |

### 7.3 Example Usage

```typescript
import { CeloBankSDK } from "@celobank/agent-sdk"

const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })

// Read portfolio for any address
const portfolio = await sdk.getPortfolio({ address: "0x..." })

// Swap 10 CELO to USDC (Uniswap V3)
const swap = await sdk.swapTokens({ tokenIn: "CELO", tokenOut: "USDC", amount: "10" })

// Supply 50 cUSD to Aave V3
const supply = await sdk.supplyAave({ amount: "50" })

// Deploy a new ERC-20 token
const token = await sdk.launchToken({ name: "MyToken", symbol: "MTK", totalSupply: "1000000" })

// Fetch the agent catalog for agent-to-agent discovery
const catalog = await sdk.getCatalog()
```

The SDK is the same infrastructure used by the CeloBank Agent server itself. Developers building autonomous agents can use it to perform on-chain reads and prepared-transaction writes without standing up their own Celo RPC integration.

---

## 8. Security Model

### 8.1 Non-Custodial Guarantee

The agent never holds user funds. All transaction preparation returns unsigned transaction data to the frontend; the user's connected wallet (MiniPay, MetaMask, RainbowKit) signs and broadcasts. The agent wallet (`PRIVATE_KEY` environment variable) is used only for read-only RPC operations that require a sender address for gas estimation.

### 8.2 Jailbreak and Prompt Injection Defense

The system prompt includes an explicit security section with rules the model is instructed cannot be overridden by any subsequent instruction or framing:

- **Private key protection**: refuse any request touching private keys, seed phrases, or API keys with a fixed response ("I cannot help with that") regardless of roleplay, debugging, or hypothetical framing
- **No unsolicited transactions**: never prepare or suggest a transaction the user did not explicitly request
- **Address safety**: never suggest sending funds to an address the user did not provide; warn on suspicious address patterns
- **Jailbreak detection**: explicit enumeration of common jailbreak patterns (DAN, developer mode, "ignore previous instructions", authority/urgency social engineering) — all refused identically
- **No misleading actions**: refuse assistance creating tokens, messages, or transactions designed to defraud

These are enforced at the prompt level. The agent's non-custodial architecture means that even a successfully jailbroken model cannot broadcast unauthorized transactions — any write action still requires user wallet signature.

### 8.3 Amount Safeguards

The system prompt includes graduated warnings: any amount over $50 equivalent triggers explicit size confirmation; amounts over $500 trigger a recommendation to test with a small amount first; "send all" or unusual round numbers trigger explicit confirmation requests.

### 8.4 API Security

Standard Express.js middleware: CORS, request size limits. The `/api/v1/chat` and `/api/v1/prepare` endpoints validate required parameters before passing to the agent or transaction builder.

---

## 9. On-Chain Identity

### 9.1 ERC-8004 Agent Identity

CeloBank Agent is registered as **token #9225** in the official ERC-8004 registry contract at [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) on Celo Mainnet. ERC-8004 is the emerging on-chain standard for autonomous agent identity; the registry mints a non-fungible token for each registered agent.

The registration NFT is viewable at:
- Celoscan: [`celoscan.io/nft/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/9225`](https://celoscan.io/nft/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/9225)
- 8004scan: [`8004scan.io/agents/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://8004scan.io)

CeloBank Agent also deploys its own agent contract at [`0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1`](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1) — this is the project's custom CeloBankAgent contract, distinct from the standard ERC-8004 registry above.

| Field | Value |
|-------|-------|
| ERC-8004 registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Agent token ID | #9225 |
| CeloBankAgent contract | `0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1` |
| 8004scan health | 100/100 |
| Registration type | `registration-v1` |
| Metadata | data URI (inline JSON, decoded by 8004scan) |
| Capabilities declared | `["tools"]` |
| MCP version | `2024-11-05` |
| x402 support | `true` |
| Last updated block | 69604057 |

The registration metadata was generated via `scripts/gen-metadata-uri.ts` and committed on-chain. The metadata URI encodes a JSON object conforming to the ERC-8004 `registration-v1` schema, including service descriptions, MCP endpoint, x402 support flag, and a description of all 21 tools.

The 100/100 health score on 8004scan reflects full compliance with the required fields of the `registration-v1` schema.

### 9.2 Smart Contract Addresses (Complete)

| Contract | Address | Network |
|----------|---------|---------|
| ERC-8004 Registry (standard) | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) | Celo Mainnet |
| CeloBankAgent contract | [`0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1`](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1) | Celo Mainnet |
| TokenFactory | [`0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e`](https://celoscan.io/address/0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e) | Celo Mainnet |
| Mento V2 Broker | [`0x777A8255cA72412f0d706dc03C9D1987306B4CaD`](https://celoscan.io/address/0x777A8255cA72412f0d706dc03C9D1987306B4CaD) | Celo Mainnet |
| Uniswap V3 Router | [`0x5615CDAb10dc425a742d643d949a7F474C01abc4`](https://celoscan.io/address/0x5615CDAb10dc425a742d643d949a7F474C01abc4) | Celo Mainnet |
| Aave V3 Pool | [`0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402`](https://celoscan.io/address/0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402) | Celo Mainnet |
| stCELO Manager | [`0x0239b96D10a434a56CC9E09383077A0490cF9398`](https://celoscan.io/address/0x0239b96D10a434a56CC9E09383077A0490cF9398) | Celo Mainnet |
| GoodDollar EngagementRewards | [`0x25db74CF4E7BA120526fd87e159CF656d94bAE43`](https://celoscan.io/address/0x25db74CF4E7BA120526fd87e159CF656d94bAE43) | Celo Mainnet |
| GoodDollar IdentityV4 | [`0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`](https://celoscan.io/address/0xC361A6E67822a0EDc17D899227dd9FC50BD62F42) | Celo Mainnet |
| G$ Token (SuperGoodDollar) | [`0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A`](https://celoscan.io/address/0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A) | Celo Mainnet |
| cUSD (payment token) | [`0x765DE816845861e75A25fCA122bb6898B8B1282a`](https://celoscan.io/address/0x765DE816845861e75A25fCA122bb6898B8B1282a) | Celo Mainnet |

---

## 10. Roadmap

The following items are planned future work. None of them are currently live.

**Agent-to-Agent Commerce**
- x402 payment enforcement at the server middleware layer (currently declared but not enforced)
- Idempotency key enforcement (24h deduplication, currently declared but not enforced)
- Agent registry integration for CeloBank to be discoverable by third-party agent orchestrators

**Protocol Coverage**
- Additional Mento stablecoin pairs as they launch
- Aave V3 borrowing flow (currently read-only for borrow position; `save_cusd` covers supply only)
- Uniswap V3 liquidity provision

**Infrastructure**
- Multi-chain expansion (Ethereum mainnet, Base) — same SDK interface, different chain config
- WebSocket streaming for real-time price feeds and transaction status
- Rate limiting and per-wallet session management

**Identity**
- ERC-8004 compliance updates as the standard matures
- Self Protocol identity verification flow within the agent conversation

**Ecosystem**
- Deeper MiniPay integration (MiniPay-native push notifications for transaction confirmation)
- Additional language support beyond 19 (dialect-level detection)

---

## 11. Token

**CeloBank Agent has no token.**

There is no CELO-B token, no governance token, no utility token, and no tokenomics. This document does not speculate about future token launches. Any future token would be a separate governance decision and would be announced through official channels with full documentation.

The only tokens CeloBank Agent interacts with are existing Celo ecosystem tokens (CELO, cUSD, cEUR, and the others described in Section 4) on behalf of users.

---

## 12. Conclusion

CeloBank Agent demonstrates that the gap between the 1.4 billion unbanked and the DeFi infrastructure built for them is primarily an interface problem — one that a well-engineered AI layer can close without sacrificing the non-custodial guarantees that make DeFi meaningful.

By building on Celo's sub-cent fees, mobile-first design, and emerging-market stablecoin suite, and by exposing that infrastructure through natural language in 19 languages, CeloBank Agent makes DeFi usable for someone in Nairobi, Lagos, or Dhaka with a smartphone — without a seed phrase tutorial, without gas estimation anxiety, without English fluency requirements.

The open SDK and machine-readable `/catalog` endpoint extend this infrastructure to other developers and agents. Any AI agent can install `@celobank/agent-sdk` and gain typed access to Celo DeFi in minutes. Any autonomous agent can fetch `/catalog` and immediately understand what CeloBank offers, what it costs, and how to pay — without human configuration.

All claims in this document are grounded in the current codebase and on-chain state. Contract addresses are verifiable on Celoscan. The SDK is available on npm. The ERC-8004 registration is verifiable on 8004scan. The agent is live and accessible today.

---

## 13. References

**Live Application**
- Demo: https://celobank-agent.vercel.app
- API: https://celobank-agent-production.up.railway.app
- GitHub: https://github.com/wkalidev/celobank-agent

**SDK**
- npm: https://www.npmjs.com/package/@celobank/agent-sdk

**On-Chain Identity**
- ERC-8004 registry (agent #9225 NFT): https://celoscan.io/nft/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/9225
- ERC-8004 registry contract: https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- CeloBankAgent contract: https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1
- 8004scan: https://8004scan.io
- ERC-8004 specification: https://eips.ethereum.org/EIPS/eip-8004
- GoodDollar registration TX: https://celoscan.io/tx/0x4f9c91083e103d663a39469fe173ec51096be941b22a18a69c4237df37fe110f

**Smart Contracts on Celoscan**
- TokenFactory: https://celoscan.io/address/0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e
- Mento V2 Broker: https://celoscan.io/address/0x777A8255cA72412f0d706dc03C9D1987306B4CaD
- Uniswap V3 Router: https://celoscan.io/address/0x5615CDAb10dc425a742d643d949a7F474C01abc4
- Aave V3 Pool: https://celoscan.io/address/0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402
- stCELO Manager: https://celoscan.io/address/0x0239b96D10a434a56CC9E09383077A0490cF9398
- GoodDollar EngagementRewards: https://celoscan.io/address/0x25db74CF4E7BA120526fd87e159CF656d94bAE43
- GoodDollar IdentityV4: https://celoscan.io/address/0xC361A6E67822a0EDc17D899227dd9FC50BD62F42
- G$ Token: https://celoscan.io/address/0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A

**External Standards and Protocols**
- x402 payment protocol: https://x402.org
- Model Context Protocol: https://modelcontextprotocol.io
- World Bank Global Findex 2021: https://www.worldbank.org/en/publication/globalfindex
- Mento Protocol: https://mento.org
- GoodDollar: https://gooddollar.org
- Self Protocol: https://self.xyz

**Ecosystem**
- Celo: https://celo.org
- Farcaster: https://docs.farcaster.xyz/developers/frames/v2/getting-started
- MiniPay: https://minipay.opera.com
- Aave on Celo: https://app.aave.com

---

*CeloBank Agent is open source (MIT License). Contributions welcome at github.com/wkalidev/celobank-agent.*

*This whitepaper reflects the state of the system as of June 2026. For the most current information, refer to the live codebase and on-chain state.*
