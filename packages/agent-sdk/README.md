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
- Finding the right Mento V2 exchange IDs (undocumented)
- Handling Aave V3 supply/withdraw flows
- Managing approve→execute patterns safely

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
  native: "207.340000",       // CELO natif
  tokens: {
    cUSD:   "45.200000",
    cEUR:   "0.000000",
    cREAL:  "0.000000",
    USDC:   "12.500000",
    USDT:   "0.000000",
    STCELO: "0.000000",
    "G$":   "0.000000",
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
  { symbol: "CELO", priceUsd: 0.092, change24h: -1.23 },
  { symbol: "cUSD", priceUsd: 1.001, change24h: 0.01  },
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

Swap CELO for a stablecoin via **Mento V2** (no slippage on stable pairs).

```typescript
const result = await sdk.swap({
  amount: "10",        // CELO to swap
  tokenOut: "cUSD",    // "cUSD" | "cEUR" | "cREAL" | "USDC" | "USDT"
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
import { TOKENS, MENTO_EXCHANGE_IDS, AAVE_POOL } from "@celobank/agent-sdk"

console.log(TOKENS.cUSD.address)   // 0x765DE8...
console.log(TOKENS.USDC.decimals)  // 6
```

---

## Supported Tokens

| Symbol | Address | Decimals |
|--------|---------|----------|
| CELO   | `0x471EcE...` | 18 |
| cUSD   | `0x765DE8...` | 18 |
| cEUR   | `0xD8763C...` | 18 |
| cREAL  | `0xe8537a...` | 18 |
| USDC   | `0xcebA93...` | 6  |
| USDT   | `0x48065f...` | 6  |

---

## On-Chain Infrastructure

This SDK wraps verified mainnet contracts:

| Protocol | Contract | Address |
|----------|----------|---------|
| Mento V2 Broker | Swap router | `0x777A82...` |
| Mento BiPool Manager | Exchange provider | `0x22d9db...` |
| Aave V3 Pool | Lending/borrowing | `0x3E59A3...` |
| ERC-8004 Registry | Agent identity | `0x4ebef6...` |

---

## Tech Stack

- **Blockchain**: Celo L2 (OP Stack), Mainnet only
- **On-chain**: viem v2
- **Language**: TypeScript (fully typed)
- **DeFi**: Mento V2, Aave V3
- **Identity**: ERC-8004

---

## Contributing

PRs welcome. This is open infrastructure — built for the builders.

---

## License

MIT © 2026 [@wkalidev](https://github.com/wkalidev)

---

**Built for the 1.4 billion unbanked · Powered by Celo Mainnet · Secured by ERC-8004**