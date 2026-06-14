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
export interface CatalogTool {
    id: string;
    name: string;
    description: string;
    category: "read" | "write";
    pricing: {
        scheme: "free" | "exact";
        amount?: string;
        currency?: string;
        amountWei?: string;
        asset?: string;
        chainId?: number;
    };
    requiredHeaders?: string[];
    input: Record<string, string>;
}
export interface CatalogResult {
    schema: string;
    generatedAt: string;
    service: {
        id: string;
        name: string;
        description: string;
        version: string;
        baseUrl: string;
        entrypoint: string;
        network: string;
        chainId: number;
        health: {
            endpoint: string;
            status: string;
            uptime: number;
        };
    };
    idempotency: {
        header: string;
        behavior: string;
        window: string;
    };
    spendLimits: {
        perCall: {
            max: string;
            currency: string;
        };
        perDay: {
            max: string;
            currency: string;
        };
        note: string;
    };
    x402: {
        facilitator: string;
        paymentToken: {
            symbol: string;
            address: string;
            decimals: number;
            chainId: number;
        };
        payTo: string;
        requiredHeader: string;
        receiptHeader: string;
    };
    schemas: {
        payment402Response: unknown;
        receiptFormat: unknown;
        failureRefund: {
            states: string[];
            behavior: {
                onFailure: string;
                onRevert: string;
            };
            sampleFailureResponse: {
                status: number;
                body: {
                    error: {
                        code: string;
                        message: string;
                        paymentStatus: string;
                        txHash: string | null;
                    };
                };
            };
        };
    };
    tools: CatalogTool[];
}
//# sourceMappingURL=types.d.ts.map