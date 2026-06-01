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