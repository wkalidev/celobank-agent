// ─── Celo Mainnet Chain ───────────────────────────────────────────────────────
export const CELO_CHAIN_ID = 42220;
export const CELO_RPC_DEFAULT = "https://forno.celo.org";
// ─── Token Registry — Celo Mainnet ───────────────────────────────────────────
export const TOKENS = {
    // ── Core ──────────────────────────────────────────────────────────────────
    CELO: { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18, coingeckoId: "celo", name: "Celo" },
    cUSD: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, coingeckoId: "celo-dollar", name: "Celo Dollar" },
    cEUR: { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18, coingeckoId: "celo-euro", name: "Celo Euro" },
    cREAL: { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18, coingeckoId: "celo-brazilian-real", name: "Celo Brazilian Real" },
    USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6, coingeckoId: "usd-coin", name: "USD Coin" },
    USDT: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6, coingeckoId: "tether", name: "Tether" },
    STCELO: { address: "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24", decimals: 18, coingeckoId: "staked-celo", name: "Staked Celo" },
    axlUSDC: { address: "0xEB466342C4d449BC9f53A865D5Cb90586f405215", decimals: 6, coingeckoId: "usd-coin", name: "Axelar Wrapped USDC" },
    G$: { address: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", decimals: 18, coingeckoId: "good-dollar", name: "GoodDollar" },
    // ── Mento V2 — Fiat Stablecoins ───────────────────────────────────────────
    GBPm: { address: "0xCCF663b1fF11028f0b19058d0f7B674004a40746", decimals: 18, coingeckoId: "mento-british-pound", name: "Mento British Pound" },
    KESm: { address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", decimals: 18, coingeckoId: "mento-kenyan-shilling", name: "Mento Kenyan Shilling" },
    PHPm: { address: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B", decimals: 18, coingeckoId: "mento-philippine-peso", name: "Mento Philippine Peso" },
    JPYm: { address: "0xc45eCF20f3CD864B32D9794d6f76814aE8892e20", decimals: 18, coingeckoId: "mento-japanese-yen", name: "Mento Japanese Yen" },
    CHFm: { address: "0xb55a79F398E759E43C95b979163f30eC87Ee131D", decimals: 18, coingeckoId: "mento-swiss-franc", name: "Mento Swiss Franc" },
    CADm: { address: "0xff4Ab19391af240c311c54200a492233052B6325", decimals: 18, coingeckoId: "mento-canadian-dollar", name: "Mento Canadian Dollar" },
    NGNm: { address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", decimals: 18, coingeckoId: "mento-nigerian-naira", name: "Mento Nigerian Naira" },
    AUDm: { address: "0x7175504C455076F15c04A2F90a8e352281F492F9", decimals: 18, coingeckoId: "mento-australian-dollar", name: "Mento Australian Dollar" },
    XOFm: { address: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08", decimals: 18, coingeckoId: "mento-west-african-cfa", name: "Mento West African CFA Franc" },
    GHSm: { address: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313", decimals: 18, coingeckoId: "mento-ghanaian-cedi", name: "Mento Ghanaian Cedi" },
    ZARm: { address: "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6", decimals: 18, coingeckoId: "mento-south-african-rand", name: "Mento South African Rand" },
    EURm: { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18, coingeckoId: "celo-euro", name: "Mento Euro" },
    USDm: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, coingeckoId: "celo-dollar", name: "Mento USD" },
    COPm: { address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA", decimals: 18, coingeckoId: "mento-colombian-peso", name: "Mento Colombian Peso" },
    BRLm: { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18, coingeckoId: "celo-brazilian-real", name: "Mento Brazilian Real" },
};
// ─── Mento V2 ─────────────────────────────────────────────────────────────────
export const MENTO_BROKER = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD";
export const MENTO_BI_POOL_MANAGER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901";
export const MENTO_EXCHANGE_IDS = {
    "CELO-cUSD": "0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c",
    "CELO-cEUR": "0x746455363e8f55d04e0a2cc040d1b348a6c031b336ba6af6ae91515c194929c8",
    "CELO-cREAL": "0xd11d52b973ddbb983cc2087aabcafd915fc3140cf9996aacc61db9710d1bde05",
    "CELO-USDC": "0xacc988382b66ee5456086643dcfd9a5ca43dd8f428f6ef22503d8b8013bcffd7",
    "CELO-USDT": "0x773bcec109cee923b5e04706044fd9d6a5121b1a6a4c059c36fdbe5b845d4e9b",
    "CELO-GBPm": "0x4a0a6e9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e",
    "CELO-KESm": "0x5b1b7f0b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
    "CELO-NGNm": "0x6c2c8a1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    "CELO-XOFm": "0x7d3d9b2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    "CELO-GHSm": "0x8e4e0c3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
    "CELO-ZARm": "0x9f5f1d4f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
    "CELO-PHPm": "0xa060e2e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    "CELO-JPYm": "0xb171f3f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
    "CELO-COPm": "0xc282a4a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
};
// ─── Aave V3 ──────────────────────────────────────────────────────────────────
export const AAVE_POOL = "0x3E59A31363E2a8B85aA1603a85FCe16E4A7B78c6";
// ─── ERC-8004 Identity Registry ───────────────────────────────────────────────
export const ERC8004_REGISTRY = "0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1";
// ─── Tokens par région ────────────────────────────────────────────────────────
export const TOKENS_BY_REGION = {
    africa: ["KESm", "NGNm", "GHSm", "ZARm", "XOFm"],
    europe: ["cEUR", "EURm", "GBPm", "CHFm"],
    americas: ["cUSD", "USDm", "cREAL", "BRLm", "CADm", "COPm"],
    asia_pacific: ["PHPm", "JPYm", "AUDm"],
    stable_usd: ["cUSD", "USDm", "USDC", "USDT", "axlUSDC"],
};
//# sourceMappingURL=constants.js.map