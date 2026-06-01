export declare const CELO_CHAIN_ID = 42220;
export declare const CELO_RPC_DEFAULT = "https://forno.celo.org";
export declare const TOKENS: {
    readonly CELO: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo";
    };
    readonly cUSD: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo-dollar";
    };
    readonly cEUR: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo-euro";
    };
    readonly cREAL: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo-brazilian-real";
    };
    readonly USDC: {
        readonly address: `0x${string}`;
        readonly decimals: 6;
        readonly coingeckoId: "usd-coin";
    };
    readonly USDT: {
        readonly address: `0x${string}`;
        readonly decimals: 6;
        readonly coingeckoId: "tether";
    };
    readonly STCELO: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "staked-celo";
    };
    readonly G$: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "good-dollar";
    };
};
export type TokenSymbol = keyof typeof TOKENS;
export declare const MENTO_BROKER: `0x${string}`;
export declare const MENTO_BI_POOL_MANAGER: `0x${string}`;
export declare const MENTO_EXCHANGE_IDS: Record<string, `0x${string}`>;
export declare const AAVE_POOL: `0x${string}`;
export declare const ERC8004_REGISTRY: `0x${string}`;
//# sourceMappingURL=constants.d.ts.map