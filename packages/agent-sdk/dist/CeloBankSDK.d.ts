import type { CeloBankConfig, BalanceResult, PriceResult, SwapResult, SendResult, AavePosition, AaveSupplyResult, SendParams, SwapParams, SupplyAaveParams, GetPortfolioParams, GetPricesParams, GetAavePositionParams } from "./types.js";
export interface StreakResult {
    address: string;
    streak: number;
    totalCheckIns: number;
    canCheckIn: boolean;
    canClaim: boolean;
    nextCheckIn: number;
    nextCheckInDate: string;
}
export interface CheckInResult {
    success: boolean;
    streak: number;
    feeTxHash: string;
    checkInTxHash: string;
    explorerUrl: string;
    message: string;
}
export interface ClaimRewardResult {
    success: boolean;
    txHash: string;
    explorerUrl: string;
    amount: string;
}
/**
 * CeloBankSDK — Infrastructure pour construire des agents DeFi autonomes sur Celo
 *
 * @example
 * ```typescript
 * import { CeloBankSDK } from "@celobank/agent-sdk"
 *
 * const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })
 *
 * const portfolio = await sdk.getPortfolio()
 * const swap      = await sdk.swap({ amount: "10", tokenOut: "cUSD" })
 * const supply    = await sdk.supplyAave({ amount: "50" })
 * const streak    = await sdk.getStreak()
 * const checkIn   = await sdk.checkIn()
 * ```
 */
export declare class CeloBankSDK {
    private account;
    private publicClient;
    private walletClient;
    readonly address: `0x${string}`;
    constructor(config: CeloBankConfig);
    /**
     * Retourne le portefeuille complet : CELO natif + tous les tokens ERC20
     */
    getPortfolio(params?: GetPortfolioParams): Promise<BalanceResult>;
    /**
     * Prix en temps réel + variation 24h via CoinGecko
     */
    getPrices(params?: GetPricesParams): Promise<PriceResult[]>;
    /**
     * Envoyer du CELO natif
     */
    send(params: SendParams): Promise<SendResult>;
    /**
     * Swapper CELO → stablecoin via Mento V2
     */
    swap(params: SwapParams): Promise<SwapResult>;
    /**
     * Lire la position Aave V3
     */
    getAavePosition(params?: GetAavePositionParams): Promise<AavePosition>;
    /**
     * Déposer sur Aave V3 pour générer des intérêts
     */
    supplyAave(params: SupplyAaveParams): Promise<AaveSupplyResult>;
    /**
     * Lire le streak DailyDrop d'une adresse
     * @example
     * const streak = await sdk.getStreak()
     * console.log(`Streak: ${streak.streak} days`)
     */
    getStreak(params?: {
        address?: string;
    }): Promise<StreakResult>;
    /**
     * Daily check-in sur DailyDrop
     * - Envoie 0.001 CELO de fee
     * - Appelle checkIn() sur le contrat
     * - Après 7 jours → claimDrop() pour recevoir 10 DROP
     * @example
     * const result = await sdk.checkIn()
     * console.log(result.message) // "6 days until reward"
     */
    checkIn(): Promise<CheckInResult>;
    /**
     * Claim 10 DROP tokens après 7 jours de streak
     * @example
     * const result = await sdk.claimDrop()
     */
    claimDrop(): Promise<ClaimRewardResult>;
    private _getExchangeId;
}
//# sourceMappingURL=CeloBankSDK.d.ts.map