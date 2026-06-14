import type { CeloBankConfig, BalanceResult, PriceResult, SwapResult, SendResult, AavePosition, AaveSupplyResult, SendParams, SwapParams, SwapTokensParams, SupplyAaveParams, GetPortfolioParams, GetPricesParams, GetAavePositionParams, LaunchTokenParams, LaunchTokenResult, CatalogResult } from "./types.js";
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
export interface GoodDollarStatus {
    address: string;
    gBalance: string;
    isVerified: boolean;
    identityExpiry: string;
}
export interface EngagementRewardsResult {
    appAddress: string;
    numberOfRewards: number;
    totalAppRewards: string;
    totalUserRewards: string;
    totalInviterRewards: string;
    rewardPerUser: string;
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
     * Universal swap: routes CELO↔stablecoin via Mento V2, all other pairs via Uniswap V3
     */
    swapTokens(params: SwapTokensParams): Promise<SwapResult>;
    /**
     * Deploy a new ERC20 token on Celo via TokenFactory
     */
    launchToken(params: LaunchTokenParams): Promise<LaunchTokenResult>;
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
    /**
     * Read G$ balance and GoodDollar human verification status for an address.
     * Verification is required to earn UBI on Ethereum/Fuse; verified status is
     * also checked by the EngagementRewards contract on Celo.
     * @example
     * const status = await sdk.checkGoodDollar()
     * console.log(`G$ balance: ${status.gBalance}`)
     * console.log(`Verified: ${status.isVerified}`)
     */
    checkGoodDollar(params?: {
        address?: string;
    }): Promise<GoodDollarStatus>;
    /**
     * Read CeloBank's GoodDollar engagement reward stats from the EngagementRewards
     * contract on Celo — users onboarded and G$ distributed via referrals.
     * @example
     * const rewards = await sdk.getEngagementRewards()
     * console.log(`Users onboarded: ${rewards.numberOfRewards}`)
     * console.log(`Total G$ distributed: ${rewards.totalAppRewards}`)
     */
    getEngagementRewards(params?: {
        appAddress?: string;
    }): Promise<EngagementRewardsResult>;
    /**
     * Fetch the live /catalog endpoint and return the parsed JSON.
     * Useful for agent-to-agent discovery of available tools, pricing, and payment schema.
     * @example
     * const catalog = await sdk.getCatalog()
     * console.log(catalog.service.health.uptime)
     * console.log(catalog.tools.filter(t => t.category === "free"))
     */
    getCatalog(params?: {
        baseUrl?: string;
    }): Promise<CatalogResult>;
    private _getExchangeId;
}
//# sourceMappingURL=CeloBankSDK.d.ts.map