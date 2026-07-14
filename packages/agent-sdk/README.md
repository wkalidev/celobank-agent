# @celobank/agent-sdk

> **Infrastructure SDK for building autonomous DeFi agents on Celo**

[![npm](https://img.shields.io/npm/v/@celobank/agent-sdk?style=for-the-badge)](https://www.npmjs.com/package/@celobank/agent-sdk)
[![Built on Celo](https://img.shields.io/badge/Built%20on-Celo-35D07F?style=for-the-badge)](https://celo.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Deployed-FCFF52?style=for-the-badge)](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

`@celobank/agent-sdk` is the **infrastructure layer** any developer needs to build autonomous financial agents on Celo. Portfolio reads, token swaps via Mento V2, Aave V3 DeFi positions, native CELO transfers, and daily check-ins — all in one typed SDK.

---

## Why this SDK?

Building a DeFi agent on Celo from scratch means:
- Wiring up viem clients, ABIs, and chain configs
- Finding the right Mento V2 exchange IDs (loaded dynamically from BiPoolManager)
- Handling Aave V3 supply/withdraw flows
- Managing approve → waitForReceipt → execute patterns safely

**This SDK handles all of that.** You import, you call, it works.

```typescript
import { CeloBankSDK } from "@celobank/agent-sdk"

const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })

const portfolio = await sdk.getPortfolio()
const swap      = await sdk.swapTokens({ tokenIn: "cUSD", tokenOut: "USDC", amount: "10" })
const supply    = await sdk.supplyAave({ amount: "50" })
const token     = await sdk.launchToken({ name: "MyCoin", symbol: "MYC", totalSupply: "1000000" })
const streak    = await sdk.getStreak()
const checkIn   = await sdk.checkIn()
const gStatus   = await sdk.checkGoodDollar()
const rewards   = await sdk.getEngagementRewards()
```

---

## Installation

```bash
npm install @celobank/agent-sdk
```

**Requirements**: Node.js 18+, a Celo wallet private key.

---

## Quick Start

```typescript
import { CeloBankSDK } from "@celobank/agent-sdk"

const sdk = new CeloBankSDK({
  privateKey: process.env.PRIVATE_KEY!,
  rpcUrl: "https://forno.celo.org",  // optional, this is the default
})

console.log("Agent wallet:", sdk.address)
```

---

## API Reference

### SDK Methods

| Method | Description |
|--------|-------------|
| `getPortfolio(params?)` | Native CELO + all ERC20 balances for any address |
| `getPrices(params?)` | Real-time USD prices + 24h change via CoinGecko |
| `send(params)` | Send native CELO to any address |
| `swap(params)` | Swap CELO → stablecoin via Mento V2 (legacy) |
| `swapTokens(params)` | Universal swap: Mento V2 or Uniswap V3 for 26+ token pairs ✨ |
| `launchToken(params)` | Deploy a new ERC20 token on Celo via TokenFactory ✨ |
| `getAavePosition(params?)` | Read Aave V3 position (collateral, debt, health factor) |
| `supplyAave(params)` | Deposit asset on Aave V3 to earn yield |
| `getStreak(params?)` | Read DailyDrop check-in streak for any address |
| `checkIn()` | Daily check-in (0.001 CELO fee + on-chain TX) |
| `claimDrop()` | Claim 10 DROP tokens after a 7-day streak |
| `checkGoodDollar(params?)` | Read G$ balance + GoodDollar human verification status ✨ |
| `getEngagementRewards(params?)` | Read engagement reward stats (users onboarded, G$ distributed) ✨ |
| `getCatalog(params?)` | Fetch the live `/catalog` — tool list, pricing, idempotency, spend limits, failure/refund schema ✨ |

---

### `getPortfolio(params?)`

Returns native CELO + all ERC20 token balances for an address.

```typescript
const portfolio = await sdk.getPortfolio()
// or for any address:
const portfolio = await sdk.getPortfolio({ address: "0xABC..." })

// Returns:
{
  address: "0xDEAc...",
  native: "207.340000",
  tokens: {
    cUSD:  "45.200000",
    cEUR:  "0.000000",
    cREAL: "0.000000",
    USDC:  "12.500000",
    USDT:  "0.000000",
  }
}
```

---

### `getPrices(params?)`

Real-time prices from CoinGecko with 24h change.

```typescript
const prices = await sdk.getPrices()
const prices = await sdk.getPrices({ tokens: ["CELO", "cUSD", "USDC"] })

// Returns:
[
  { symbol: "CELO", priceUsd: 0.072, change24h: -1.05 },
  { symbol: "cUSD", priceUsd: 0.999, change24h:  0.00 },
]
```

---

### `send(params)`

Send native CELO to any address.

```typescript
const result = await sdk.send({ to: "0xRecipient...", amount: "1.5" })

// Returns:
{
  success: true,
  to: "0xRecipient...",
  amount: "1.5",
  txHash: "0xabc...",
  explorerUrl: "https://celoscan.io/tx/0xabc..."
}
```

---

### `swap(params)`

Swap CELO for a stablecoin via **Mento V2**.

```typescript
const result = await sdk.swap({
  amount: "10",
  tokenOut: "cUSD",  // "cUSD" | "cEUR" | "cREAL" | "KESm" | "NGNm" | "GHSm" | "XOFm" | "ZARm"
})

// Returns:
{
  success: true,
  amountIn: "10",
  tokenOut: "cUSD",
  txHash: "0xabc...",
  explorerUrl: "https://celoscan.io/tx/0xabc..."
}
```

---

### `swapTokens(params)` ✨ New in v1.0.4

Universal swap between **any two tokens** on Celo. Routes through **Mento V2** for CELO ↔ stablecoin pairs, and **Uniswap V3** (0.3% fee) for all other pairs. Case-insensitive token symbols.

```typescript
// Mento V2 path: CELO ↔ any Mento stablecoin
const result = await sdk.swapTokens({
  tokenIn:  "CELO",
  tokenOut: "cUSD",
  amount:   "10",
})

// Uniswap V3 path: any other pair
const result = await sdk.swapTokens({
  tokenIn:  "cUSD",
  tokenOut: "USDC",
  amount:   "10",
})

// Returns:
{
  success: true,
  amountIn: "10",
  tokenOut: "USDC",
  txHash: "0xabc...",
  explorerUrl: "https://celoscan.io/tx/0xabc..."
}
```

**Supported tokens (26):** CELO, cUSD/USDm, cEUR/EURm, cREAL/BRLm, KESm, NGNm, GHSm, XOFm, ZARm, GBPm, PHPm, COPm, CADm, AUDm, CHFm, JPYm, USDC, USDT, WETH, WBTC, stCELO, UBE, USDGLO, EURC

---

### `launchToken(params)` ✨ New in v1.0.4

Deploy a new ERC20 token on Celo mainnet via the **CeloBank TokenFactory** (`0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e`).

```typescript
const result = await sdk.launchToken({
  name:        "MyCoin",
  symbol:      "MYC",
  totalSupply: "1000000",
})

// Returns:
{
  success:      true,
  name:         "MyCoin",
  symbol:       "MYC",
  totalSupply:  "1000000",
  tokenAddress: "0xNewToken...",
  txHash:       "0xabc...",
  explorerUrl:  "https://celoscan.io/tx/0xabc..."
}
```

---

### `getAavePosition(params?)`

Read a DeFi position on **Aave V3 Celo**.

```typescript
const position = await sdk.getAavePosition()

// Returns:
{
  address: "0xDEAc...",
  totalCollateralUsd: "102.45",
  totalDebtUsd: "0.00",
  availableBorrowsUsd: "71.71",
  healthFactor: "∞"
}
```

---

### `supplyAave(params)`

Deposit an asset on Aave V3 to earn yield automatically.

```typescript
const result = await sdk.supplyAave({ amount: "50", asset: "cUSD" })

// Returns:
{
  success: true,
  asset: "cUSD",
  amount: "50",
  txHash: "0xabc...",
  explorerUrl: "https://celoscan.io/tx/0xabc..."
}
```

---

### `getStreak(params?)` ✨ New in v1.0.2

Read the DailyDrop streak for an address — Proof of Presence on Celo.

```typescript
const streak = await sdk.getStreak()
// or for any address:
const streak = await sdk.getStreak({ address: "0xABC..." })

// Returns:
{
  address:         "0xDEAc...",
  streak:          7,           // current streak in days
  totalCheckIns:   42,          // all-time check-ins
  canCheckIn:      false,       // already checked in today
  canClaim:        true,        // 7-day streak reached → claim DROP
  nextCheckIn:     1780613801,  // unix timestamp
  nextCheckInDate: "2026-06-05T08:00:00.000Z"
}
```

---

### `checkIn()` ✨ New in v1.0.2

Daily check-in on the DailyDrop contract. Sends 0.001 CELO fee + calls `checkIn()` on-chain.
After 7 consecutive days → call `claimDrop()` to receive 10 DROP tokens.

```typescript
const result = await sdk.checkIn()

// Returns:
{
  success:       true,
  streak:        1,
  feeTxHash:     "0xfee...",
  checkInTxHash: "0xcheckin...",
  explorerUrl:   "https://celoscan.io/tx/0xcheckin...",
  message:       "6 days until reward"
}
```

**Error if already checked in today:**
```
Error: Already checked in today. Next: 2026-06-06T08:00:00.000Z
```

---

### `claimDrop()` ✨ New in v1.0.2

Claim 10 DROP tokens after completing a 7-day streak.

```typescript
const result = await sdk.claimDrop()

// Returns:
{
  success:     true,
  txHash:      "0xabc...",
  explorerUrl: "https://celoscan.io/tx/0xabc...",
  amount:      "10 DROP"
}
```

---

### `checkGoodDollar(params?)` ✨ New in v1.0.6

Read the G$ (GoodDollar) balance and human verification status for any wallet on Celo.
Verification is managed by `IdentityV4` (`0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`).

```typescript
const status = await sdk.checkGoodDollar()
// or for any address:
const status = await sdk.checkGoodDollar({ address: "0xABC..." })

// Returns:
{
  address:        "0xDEAc...",
  gBalance:       "12.4500",   // G$ balance (18 decimals)
  isVerified:     true,        // GoodDollar FaceTec identity verified
  identityExpiry: "2026-12-31T00:00:00.000Z"  // ISO 8601, "N/A" if not verified
}
```

---

### `getEngagementRewards(params?)` ✨ New in v1.0.6

Read engagement reward statistics from the GoodDollar EngagementRewards contract.
Shows how many users an app has onboarded and how much G$ has been distributed as referral rewards.

```typescript
const rewards = await sdk.getEngagementRewards()
// or for any registered app:
const rewards = await sdk.getEngagementRewards({ appAddress: "0xAPP..." })

// Returns:
{
  appAddress:          "0xDEAc...",
  numberOfRewards:     47,         // total users onboarded
  totalAppRewards:     "23.5000",  // total G$ distributed
  totalUserRewards:    "18.8000",  // G$ received by users
  totalInviterRewards: "4.7000",   // G$ received by inviters
  rewardPerUser:       "0.5000",   // current reward amount per new user
}
```

---

## Universal Token Swap

`swapTokens()` automatically picks the best routing path:

- **Mento V2** — for CELO ↔ any Mento stablecoin (cUSD, cEUR, cREAL, KESm, NGNm, GHSm, XOFm, ZARm, GBPm, PHPm, COPm, CADm, AUDm, CHFm, JPYm)
- **Uniswap V3** (0.3% fee) — for all other pairs (USDC, USDT, WETH, WBTC, stCELO, UBE, USDGLO, EURC, and cross-stablecoin)

```typescript
import { CeloBankSDK } from "@celobank/agent-sdk"

const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })

// CELO → cUSD via Mento V2
const mentoSwap = await sdk.swapTokens({ tokenIn: "CELO", tokenOut: "cUSD", amount: "5" })

// cUSD → USDC via Uniswap V3
const uniSwap = await sdk.swapTokens({ tokenIn: "cUSD", tokenOut: "USDC", amount: "10" })

// CELO → WETH via Uniswap V3
const wethSwap = await sdk.swapTokens({ tokenIn: "CELO", tokenOut: "WETH", amount: "2" })

// Swap Kenyan shillings for Nigerian naira
const fxSwap = await sdk.swapTokens({ tokenIn: "KESm", tokenOut: "NGNm", amount: "1000" })
```

---

## Token Launcher

`launchToken()` deploys a new ERC20 token on Celo mainnet in a single transaction using the CeloBank TokenFactory.

```typescript
import { CeloBankSDK } from "@celobank/agent-sdk"

const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })

const result = await sdk.launchToken({
  name:        "MyCoin",
  symbol:      "MYC",
  totalSupply: "1000000",
})

console.log("Token deployed at:", result.tokenAddress)
console.log("Explorer:", result.explorerUrl)
```

The deploying wallet receives the entire supply. The token is a standard ERC20 and immediately tradeable on any Celo DEX.

---

## Real-World Examples

| Example | Use Case | File |
|---------|----------|------|
| Auto-Savings Bot | Deposit surplus cUSD on Aave automatically | [`examples/01-auto-savings-bot.ts`](./examples/01-auto-savings-bot.ts) |
| E-Commerce Agent | Accept CELO payments, auto-convert to cUSD | [`examples/02-ecommerce-payment-agent.ts`](./examples/02-ecommerce-payment-agent.ts) |
| Remittance Agent | Send money internationally for ~$0.001 fee | [`examples/03-remittance-agent.ts`](./examples/03-remittance-agent.ts) |

---

## Token Registry

```typescript
import { TOKENS, AAVE_POOL, MENTO_BROKER, MENTO_BI_POOL_MANAGER } from "@celobank/agent-sdk"

console.log(TOKENS.cUSD.address)   // 0x765DE816845861e75A25fCA122bb6898B8B1282a
console.log(TOKENS.USDC.decimals)  // 6
```

---

## Supported Tokens

26 verified tokens across two routing protocols:

**Mento V2 (CELO ↔ stablecoin)**

| Symbol | Name | Decimals |
|--------|------|----------|
| CELO | Celo | 18 |
| cUSD / USDm | Celo Dollar | 18 |
| cEUR / EURm | Celo Euro | 18 |
| cREAL / BRLm | Celo Brazilian Real | 18 |
| KESm | Mento Kenyan Shilling | 18 |
| NGNm | Mento Nigerian Naira | 18 |
| GHSm | Mento Ghanaian Cedi | 18 |
| XOFm | Mento West African CFA Franc | 18 |
| ZARm | Mento South African Rand | 18 |
| GBPm | Mento British Pound | 18 |
| PHPm | Mento Philippine Peso | 18 |
| COPm | Mento Colombian Peso | 18 |
| CADm | Mento Canadian Dollar | 18 |
| AUDm | Mento Australian Dollar | 18 |
| CHFm | Mento Swiss Franc | 18 |
| JPYm | Mento Japanese Yen | 18 |

**Uniswap V3 (all other pairs)**

| Symbol | Name | Decimals |
|--------|------|----------|
| USDC | USD Coin | 6 |
| USDT | Tether | 6 |
| WETH | Wrapped Ether | 18 |
| WBTC | Wrapped Bitcoin | 8 |
| stCELO | Staked Celo | 18 |
| UBE | Ubeswap | 18 |
| USDGLO | Glo Dollar | 18 |
| EURC | Euro Coin | 6 |

---

## On-Chain Infrastructure

| Protocol | Purpose | Address |
|----------|---------|---------|
| TokenFactory | Token deployment | `0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e` |
| Uniswap V3 Router | Universal swaps | `0x5615CDAb10dc425a742d643d949a7F474C01abc4` |
| Mento V2 Broker | CELO ↔ stablecoin swaps | `0x777A8255cA72412f0d706dc03C9D1987306B4CaD` |
| Mento BiPool Manager | Exchange provider | `0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901` |
| Aave V3 Pool | Lending/borrowing | `0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402` |
| ERC-8004 Registry | Agent identity | `0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1` |
| DailyDrop | Check-in & streak | `0x63596cf6601ec2240A295ff2840C8d6653252AE6` |
| GoodDollar EngagementRewards | Referral rewards ($0.50 G$/user) | `0x25db74CF4E7BA120526fd87e159CF656d94bAE43` |
| GoodDollar IdentityV4 | Human verification status | `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42` |
| G$ Token | GoodDollar SuperToken on Celo | `0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A` |

---

## Security & Rate Limits

The CeloBank Agent server enforces the following on all API endpoints:

| Endpoint type | Rate limit | Auth required |
|---------------|-----------|---------------|
| `POST /api/v1/chat`, `POST /chat` | 20 req/min | None (public) |
| `POST /api/v1/prepare` | 30 req/min | None (public) |
| `GET /api/v1/portfolio/:address`, `GET /api/v1/aave/:address` | 20 req/min | None (public) |
| `GET /api/v1/prices`, `GET /api/v1/tokens` | 60 req/min | None (public) |
| `POST /mcp` (read tools) | 60 req/min | None (free) |
| `POST /mcp` (write tools) | 60 req/min | `X-PAYMENT` header (x402, 0.001 cUSD) |

**CORS**: Browser requests must originate from a known origin. Non-browser clients (curl, Node.js SDK, mobile) without an `Origin` header pass through unrestricted.

**x402 payment enforcement**: The 7 write MCP tools (`send_celo`, `swap_tokens`, `supply_aave`, `borrow_aave`, `repay_aave`, `launch_token`, `check_in`) require a valid `X-PAYMENT` header. The server verifies the payment on Celo Mainnet before executing and settles after. Insufficient or missing payment returns HTTP 402.

**Supabase RLS**: `agent_actions` is locked to service-role only. `agent_stats` allows public SELECT; all writes are service-role only.

---

## Changelog

### v1.1.1
- **Critical fix**: the Uniswap V3 `exactInputSingle` ABI used by `swap()` and `swapTokens()` included a `deadline` field that does not exist on `SwapRouter02` (the router actually deployed on Celo Mainnet). This produced the wrong function selector, causing every non-Mento swap (any pair besides CELO↔stablecoin) to revert on-chain. Fixed.
- Added live slippage protection to `swap()` and `swapTokens()` — Mento V2 quotes via `Broker.getAmountOut`, Uniswap V3 quotes via `QuoterV2.quoteExactInputSingle`, both with a 1% default tolerance applied to `amountOutMin`/`amountOutMinimum`. Previously both were hardcoded to `0n` (no MEV/sandwich protection). If a live quote fails, the SDK falls back to `0n` rather than throwing, so calls degrade gracefully instead of blocking — callers who need guaranteed protection should check `SwapResult` and treat a suspiciously large slippage as a signal to retry.
- Added `getAmountOut` to `BROKER_ABI` in `abis.ts` to support the new Mento quoting.
- Note: this SDK's `swap()`/`send()`/etc. sign transactions with the private key passed into the constructor by design — that's the intended usage for developers building their own autonomous agents. This is different from the main CeloBank Agent app (server + chat UI), which is strictly non-custodial and never holds a private key; that fix was separate and unrelated to this SDK.

### v1.1.0
- x402 payment enforcement on all 7 MCP write tools (verify → execute → settle, 0.001 cUSD per call)
- OASF-compliant agent card at `/.well-known/agent-card.json`
- Security: CORS origin enforcement — browser requests restricted to known origins
- Security: rate limiting on all public GET endpoints (portfolio/aave 20 req/min, prices/tokens 60 req/min)
- Security: input validation hardened on `/chat` alias (empty messages + >2000 chars rejected)
- Security: internal error details sanitized in tool error responses
- Supabase RLS: deny-all policies on `agent_actions`; public SELECT + deny-write on `agent_stats`

### v1.0.9
- 📖 Updated README: getCatalog() in methods table, v1.0.7/v1.0.8 changelog entries

### v1.0.8
- ✨ `getCatalog(params?)` — fetch the live `/catalog` endpoint and return a fully-typed `CatalogResult`
- 📦 Added `CatalogResult` and `CatalogTool` exported types

### v1.0.7
- ✨ `/catalog` endpoint on the server: x402 machine-readable service catalog with tool list, pricing, idempotency contract, spend limits, and failure/refund state schema

### v1.0.6
- ✨ `checkGoodDollar(params?)` — read G$ balance + `isVerified`/`getIdentityExpiry` from GoodDollar IdentityV4 on Celo
- ✨ `getEngagementRewards(params?)` — read `appsStats()` + `rewardAmount()` from EngagementRewards contract
- 📦 Added `GoodDollarStatus` and `EngagementRewardsResult` exported types
- 🌱 GoodBuilders Season 4: CeloBank registered with EngagementRewards (`0x25db74...`) on Celo Mainnet

### v1.0.5
- 📖 Updated README with full API docs for swapTokens() and launchToken()

### v1.0.4
- ✨ `swapTokens()` — universal swap via Mento V2 + Uniswap V3 (26 token pairs)
- ✨ `launchToken()` — deploy ERC20 tokens via TokenFactory on Celo mainnet
- 📦 Expanded token registry: WETH, WBTC, stCELO, UBE, USDGLO, EURC
- 🔧 Case-insensitive token symbol matching

### v1.0.2
- ✨ `getStreak(params?)` — read DailyDrop streak for any address
- ✨ `checkIn()` — daily check-in with 0.001 CELO fee + on-chain TX
- ✨ `claimDrop()` — claim 10 DROP tokens after 7-day streak
- 🔧 Added DOM lib to tsconfig for fetch support

### v1.0.1
- Initial public release
- `getPortfolio`, `getPrices`, `send`, `swap`, `getAavePosition`, `supplyAave`

---

## License

MIT © 2026 [@wkalidev](https://github.com/wkalidev)

---

**Built for the 1.4 billion unbanked · Powered by Celo Mainnet · Secured by ERC-8004**