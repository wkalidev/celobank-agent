# @celobank/agent-sdk

> **Infrastructure SDK for building autonomous DeFi agents on Celo**

[![npm](https://img.shields.io/npm/v/@celobank/agent-sdk?style=for-the-badge)](https://www.npmjs.com/package/@celobank/agent-sdk)
[![Built on Celo](https://img.shields.io/badge/Built%20on-Celo-35D07F?style=for-the-badge)](https://celo.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Deployed-FCFF52?style=for-the-badge)](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

`@celobank/agent-sdk` is the **infrastructure layer** any developer needs to build autonomous financial agents on Celo. Portfolio reads, token swaps via Mento V2, Aave V3 DeFi positions, and native CELO transfers — all in one typed SDK.

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
const swap      = await sdk.swap({ amount: "10", tokenOut: "cUSD" })
const supply    = await sdk.supplyAave({ amount: "50" })
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

### `getPortfolio(params?)`

Returns native CELO + all ERC20 token balances for an address.

```typescript
const portfolio = await sdk.getPortfolio()
// or for any address:
const portfolio = await sdk.getPortfolio({ address: "0xABC..." })

// Returns:
{
  address: "0xDEAc...",
  native: "207.340000",       // native CELO
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
// or specific tokens:
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
const result = await sdk.send({
  to: "0xRecipient...",
  amount: "1.5",   // CELO
})

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

Exchange IDs are loaded dynamically from the BiPoolManager contract — no hardcoded values, always up to date.

The swap flow is: `approve → waitForTransactionReceipt → swapIn` to avoid nonce collisions.

```typescript
const result = await sdk.swap({
  amount: "10",        // CELO to swap
  tokenOut: "cUSD",    // "cUSD" | "cEUR" | "cREAL" | "KESm" | "NGNm" | "GHSm" | "XOFm" | "ZARm"
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

### `getAavePosition(params?)`

Read a DeFi position on **Aave V3 Celo**.

```typescript
const position = await sdk.getAavePosition()
// or:
const position = await sdk.getAavePosition({ address: "0xABC..." })

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

The supply flow is: `approve → waitForTransactionReceipt → supply` to avoid nonce collisions.

```typescript
const result = await sdk.supplyAave({
  amount: "50",      // amount to deposit
  asset: "cUSD",     // optional, defaults to "cUSD"
})

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

## Real-World Examples

| Example | Use Case | File |
|---------|----------|------|
| Auto-Savings Bot | Deposit surplus cUSD on Aave automatically | [`examples/01-auto-savings-bot.ts`](./examples/01-auto-savings-bot.ts) |
| E-Commerce Agent | Accept CELO payments, auto-convert to cUSD | [`examples/02-ecommerce-payment-agent.ts`](./examples/02-ecommerce-payment-agent.ts) |
| Remittance Agent | Send money internationally for ~$0.001 fee | [`examples/03-remittance-agent.ts`](./examples/03-remittance-agent.ts) |

---

## Token Registry

All Celo Mainnet token addresses are exported from the SDK:

```typescript
import { TOKENS, AAVE_POOL, BROKER, BI_POOL_MANAGER } from "@celobank/agent-sdk"

console.log(TOKENS.cUSD.address)   // 0x765DE816845861e75A25fCA122bb6898B8B1282a
console.log(TOKENS.USDC.decimals)  // 6
```

---

## Supported Tokens

| Symbol | Address | Decimals |
|--------|---------|----------|
| CELO   | `0x471EcE3750Da237f93B8E339c536989b8978a438` | 18 |
| cUSD   | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 |
| cEUR   | `0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73` | 18 |
| cREAL  | `0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787` | 18 |
| USDC   | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6  |
| USDT   | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6  |

Extra swap tokens (Mento stablecoins): `KESm`, `NGNm`, `GHSm`, `XOFm`, `ZARm`, `GBPm`

---

## On-Chain Infrastructure

This SDK wraps verified Celo Mainnet contracts:

| Protocol | Contract | Address |
|----------|----------|---------|
| Mento V2 Broker | Swap router | `0x777A8255cA72412f0d706dc03C9D1987306B4CaD` |
| Mento BiPool Manager | Exchange provider | `0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901` |
| Aave V3 Pool | Lending/borrowing | `0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402` |
| ERC-8004 Registry | Agent identity | `0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1` |

---

## Tech Stack

- **Blockchain**: Celo L2 (OP Stack), Mainnet only
- **On-chain**: viem v2
- **Language**: TypeScript (fully typed)
- **DeFi**: Mento V2 (dynamic exchange ID lookup), Aave V3
- **Identity**: ERC-8004

---

## Contributing

PRs welcome. This is open infrastructure — built for the builders.

---

## License

MIT © 2026 [@wkalidev](https://github.com/wkalidev)

---

**Built for the 1.4 billion unbanked · Powered by Celo Mainnet · Secured by ERC-8004**