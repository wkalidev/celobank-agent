import type { TokenSymbol } from "./constants.js"

// ─── Config ───────────────────────────────────────────────────────────────────

/** Configuration pour initialiser le CeloBankSDK */
export interface CeloBankConfig {
  /** Clé privée du wallet (avec ou sans préfixe 0x) */
  privateKey: string
  /** URL RPC Celo (défaut: https://forno.celo.org) */
  rpcUrl?: string
}

// ─── Résultats ────────────────────────────────────────────────────────────────

export interface BalanceResult {
  address: `0x${string}`
  native: string        // CELO natif formaté
  tokens: Record<string, string>  // symbol → montant formaté
}

export interface PriceResult {
  symbol: string
  priceUsd: number
  change24h: number | null
}

export interface SwapResult {
  success: boolean
  amountIn: string
  tokenOut: TokenSymbol
  txHash: `0x${string}`
  explorerUrl: string
}

export interface SendResult {
  success: boolean
  to: `0x${string}`
  amount: string
  txHash: `0x${string}`
  explorerUrl: string
}

export interface AavePosition {
  address: `0x${string}`
  totalCollateralUsd: string
  totalDebtUsd: string
  availableBorrowsUsd: string
  healthFactor: string
}

export interface AaveSupplyResult {
  success: boolean
  asset: string
  amount: string
  txHash: `0x${string}`
  explorerUrl: string
}

// ─── Paramètres des méthodes ──────────────────────────────────────────────────

export interface SendParams {
  to: `0x${string}`
  amount: string          // ex: "0.5"
}

export interface SwapParams {
  amount: string          // montant CELO à échanger
  tokenOut: string        // "cUSD" | "cEUR" | "cREAL" | "USDC" | "USDT"
}

export interface SupplyAaveParams {
  amount: string          // montant cUSD
  asset?: string          // défaut: "cUSD"
}

export interface GetPortfolioParams {
  address?: `0x${string}`  // défaut: wallet de l'agent
}

export interface GetPricesParams {
  tokens?: string[]       // défaut: tous les tokens
}

export interface GetAavePositionParams {
  address?: `0x${string}`
}

export interface SwapTokensParams {
  tokenIn?: string   // source token symbol (default: "CELO")
  tokenOut: string   // destination token symbol
  amount: string     // amount of tokenIn to swap
}

export interface LaunchTokenParams {
  name: string         // full token name (e.g. "My Token")
  symbol: string       // ticker symbol, max 11 chars (e.g. "MTK")
  totalSupply: string  // total supply as a plain number string (e.g. "1000000")
}

export interface LaunchTokenResult {
  success: boolean
  name: string
  symbol: string
  totalSupply: string
  tokenAddress: string
  txHash: `0x${string}`
  explorerUrl: string
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export interface CatalogTool {
  id: string
  name: string
  description: string
  category: "read" | "write"
  pricing: {
    scheme: "free" | "exact"
    amount?: string
    currency?: string
    amountWei?: string
    asset?: string
    chainId?: number
  }
  requiredHeaders?: string[]
  input: Record<string, string>
}

export interface CatalogResult {
  schema: string
  generatedAt: string
  service: {
    id: string
    name: string
    description: string
    version: string
    baseUrl: string
    entrypoint: string
    network: string
    chainId: number
    health: {
      endpoint: string
      status: string
      uptime: number
    }
  }
  idempotency: {
    header: string
    behavior: string
    window: string
  }
  spendLimits: {
    perCall: { max: string; currency: string }
    perDay:  { max: string; currency: string }
    note: string
  }
  x402: {
    facilitator: string
    paymentToken: { symbol: string; address: string; decimals: number; chainId: number }
    payTo: string
    requiredHeader: string
    receiptHeader: string
  }
  schemas: {
    payment402Response: unknown
    receiptFormat: unknown
    failureRefund: {
      states: string[]
      behavior: {
        onFailure: string
        onRevert: string
      }
      sampleFailureResponse: {
        status: number
        body: {
          error: {
            code: string
            message: string
            paymentStatus: string
            txHash: string | null
          }
        }
      }
    }
  }
  tools: CatalogTool[]
}