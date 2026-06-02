export declare const CELO_CHAIN_ID = 42220;
export declare const CELO_RPC_DEFAULT = "https://forno.celo.org";
export declare const TOKENS: {
    readonly CELO: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo";
        readonly name: "Celo";
    };
    readonly cUSD: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo-dollar";
        readonly name: "Celo Dollar";
    };
    readonly cEUR: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo-euro";
        readonly name: "Celo Euro";
    };
    readonly cREAL: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo-brazilian-real";
        readonly name: "Celo Brazilian Real";
    };
    readonly USDC: {
        readonly address: `0x${string}`;
        readonly decimals: 6;
        readonly coingeckoId: "usd-coin";
        readonly name: "USD Coin";
    };
    readonly USDT: {
        readonly address: `0x${string}`;
        readonly decimals: 6;
        readonly coingeckoId: "tether";
        readonly name: "Tether";
    };
    readonly STCELO: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "staked-celo";
        readonly name: "Staked Celo";
    };
    readonly axlUSDC: {
        readonly address: `0x${string}`;
        readonly decimals: 6;
        readonly coingeckoId: "usd-coin";
        readonly name: "Axelar Wrapped USDC";
    };
    readonly G$: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "good-dollar";
        readonly name: "GoodDollar";
    };
    readonly GBPm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-british-pound";
        readonly name: "Mento British Pound";
    };
    readonly KESm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-kenyan-shilling";
        readonly name: "Mento Kenyan Shilling";
    };
    readonly PHPm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-philippine-peso";
        readonly name: "Mento Philippine Peso";
    };
    readonly JPYm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-japanese-yen";
        readonly name: "Mento Japanese Yen";
    };
    readonly CHFm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-swiss-franc";
        readonly name: "Mento Swiss Franc";
    };
    readonly CADm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-canadian-dollar";
        readonly name: "Mento Canadian Dollar";
    };
    readonly NGNm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-nigerian-naira";
        readonly name: "Mento Nigerian Naira";
    };
    readonly AUDm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-australian-dollar";
        readonly name: "Mento Australian Dollar";
    };
    readonly XOFm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-west-african-cfa";
        readonly name: "Mento West African CFA Franc";
    };
    readonly GHSm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-ghanaian-cedi";
        readonly name: "Mento Ghanaian Cedi";
    };
    readonly ZARm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-south-african-rand";
        readonly name: "Mento South African Rand";
    };
    readonly EURm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo-euro";
        readonly name: "Mento Euro";
    };
    readonly USDm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo-dollar";
        readonly name: "Mento USD";
    };
    readonly COPm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "mento-colombian-peso";
        readonly name: "Mento Colombian Peso";
    };
    readonly BRLm: {
        readonly address: `0x${string}`;
        readonly decimals: 18;
        readonly coingeckoId: "celo-brazilian-real";
        readonly name: "Mento Brazilian Real";
    };
};
export type TokenSymbol = keyof typeof TOKENS;
export declare const MENTO_BROKER: `0x${string}`;
export declare const MENTO_BI_POOL_MANAGER: `0x${string}`;
export declare const MENTO_EXCHANGE_IDS: Record<string, `0x${string}`>;
export declare const AAVE_POOL: `0x${string}`;
export declare const ERC8004_REGISTRY: `0x${string}`;
export declare const TOKENS_BY_REGION: {
    readonly africa: readonly ["KESm", "NGNm", "GHSm", "ZARm", "XOFm"];
    readonly europe: readonly ["cEUR", "EURm", "GBPm", "CHFm"];
    readonly americas: readonly ["cUSD", "USDm", "cREAL", "BRLm", "CADm", "COPm"];
    readonly asia_pacific: readonly ["PHPm", "JPYm", "AUDm"];
    readonly stable_usd: readonly ["cUSD", "USDm", "USDC", "USDT", "axlUSDC"];
};
//# sourceMappingURL=constants.d.ts.map