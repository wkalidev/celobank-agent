import type { TokenSymbol } from "./constants.js";
/** Configuration pour initialiser le CeloBankSDK */
export interface CeloBankConfig {
    /** Clé privée du wallet (avec ou sans préfixe 0x) */
    privateKey: string;
    /** URL RPC Celo (défaut: https://forno.celo.org) */
    rpcUrl?: string;
}
export interface BalanceResult {
    address: `0x${string}`;
    native: string;
    tokens: Record<string, string>;
}
export interface PriceResult {
    symbol: string;
    priceUsd: number;
    change24h: number | null;
}
export interface SwapResult {
    success: boolean;
    amountIn: string;
    tokenOut: TokenSymbol;
    txHash: `0x${string}`;
    explorerUrl: string;
}
export interface SendResult {
    success: boolean;
    to: `0x${string}`;
    amount: string;
    txHash: `0x${string}`;
    explorerUrl: string;
}
export interface AavePosition {
    address: `0x${string}`;
    totalCollateralUsd: string;
    totalDebtUsd: string;
    availableBorrowsUsd: string;
    healthFactor: string;
}
export interface AaveSupplyResult {
    success: boolean;
    asset: string;
    amount: string;
    txHash: `0x${string}`;
    explorerUrl: string;
}
export interface SendParams {
    to: `0x${string}`;
    amount: string;
}
export interface SwapParams {
    amount: string;
    tokenOut: string;
}
export interface SupplyAaveParams {
    amount: string;
    asset?: string;
}
export interface GetPortfolioParams {
    address?: `0x${string}`;
}
export interface GetPricesParams {
    tokens?: string[];
}
export interface GetAavePositionParams {
    address?: `0x${string}`;
}
export interface SwapTokensParams {
    tokenIn?: string;
    tokenOut: string;
    amount: string;
}
export interface LaunchTokenParams {
    name: string;
    symbol: string;
    totalSupply: string;
}
export interface LaunchTokenResult {
    success: boolean;
    name: string;
    symbol: string;
    totalSupply: string;
    tokenAddress: string;
    txHash: `0x${string}`;
    explorerUrl: string;
}
//# sourceMappingURL=types.d.ts.map