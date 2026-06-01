import type { CeloBankConfig, BalanceResult, PriceResult, SwapResult, SendResult, AavePosition, AaveSupplyResult, SendParams, SwapParams, SupplyAaveParams, GetPortfolioParams, GetPricesParams, GetAavePositionParams } from "./types.js";
/**
 * CeloBankSDK — Infrastructure pour construire des agents DeFi autonomes sur Celo
 *
 * @example
 * ```typescript
 * import { CeloBankSDK } from "@celobank/agent-sdk"
 *
 * const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })
 *
 * // Lire le portefeuille
 * const portfolio = await sdk.getPortfolio()
 *
 * // Envoyer des CELO
 * const tx = await sdk.send({ to: "0xABC...", amount: "1.5" })
 *
 * // Swapper via Mento V2
 * const swap = await sdk.swap({ amount: "10", tokenOut: "cUSD" })
 *
 * // Déposer sur Aave
 * const supply = await sdk.supplyAave({ amount: "50" })
 * ```
 */
export declare class CeloBankSDK {
    private account;
    private publicClient;
    private walletClient;
    readonly address: `0x${string}`;
    constructor(config: CeloBankConfig);
    /**
     * Récupère les soldes CELO natif + tous les tokens ERC20 d'une adresse
     * @param params.address — adresse cible (défaut: wallet de l'agent)
     */
    getPortfolio(params?: GetPortfolioParams): Promise<BalanceResult>;
    /**
     * Récupère les prix en USD depuis CoinGecko avec variation 24h
     * @param params.tokens — liste de symboles (défaut: tous)
     */
    getPrices(params?: GetPricesParams): Promise<PriceResult[]>;
    /**
     * Envoie des CELO natifs à une adresse
     * @param params.to — adresse destinataire
     * @param params.amount — montant en CELO (ex: "1.5")
     */
    send(params: SendParams): Promise<SendResult>;
    /**
     * Swap CELO → stablecoin via Mento V2
     * @param params.amount — montant CELO à échanger
     * @param params.tokenOut — token de sortie: "cUSD" | "cEUR" | "cREAL" | "USDC" | "USDT"
     */
    swap(params: SwapParams): Promise<SwapResult>;
    /**
     * Retourne la position DeFi complète d'une adresse sur Aave V3
     * @param params.address — adresse cible (défaut: wallet de l'agent)
     */
    getAavePosition(params?: GetAavePositionParams): Promise<AavePosition>;
    /**
     * Dépose un asset sur Aave V3 pour générer des intérêts automatiquement
     * @param params.amount — montant à déposer
     * @param params.asset — token à déposer (défaut: "cUSD")
     */
    supplyAave(params: SupplyAaveParams): Promise<AaveSupplyResult>;
}
//# sourceMappingURL=CeloBankSDK.d.ts.map