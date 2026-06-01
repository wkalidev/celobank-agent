// ─── Celo Mainnet Chain ───────────────────────────────────────────────────────
export const CELO_CHAIN_ID = 42220;
export const CELO_RPC_DEFAULT = "https://forno.celo.org";
// ─── Token Registry ───────────────────────────────────────────────────────────
export const TOKENS = {
    CELO: { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18, coingeckoId: "celo" },
    cUSD: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, coingeckoId: "celo-dollar" },
    cEUR: { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18, coingeckoId: "celo-euro" },
    cREAL: { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18, coingeckoId: "celo-brazilian-real" },
    USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6, coingeckoId: "usd-coin" },
    USDT: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6, coingeckoId: "tether" },
    STCELO: { address: "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24", decimals: 18, coingeckoId: "staked-celo" },
    G$: { address: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", decimals: 18, coingeckoId: "good-dollar" },
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
};
// ─── Aave V3 ──────────────────────────────────────────────────────────────────
export const AAVE_POOL = "0x3E59A31363E2a8B85aA1603a85FCe16E4A7B78c6";
// ─── ERC-8004 Identity Registry ───────────────────────────────────────────────
export const ERC8004_REGISTRY = "0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1";
//# sourceMappingURL=constants.js.map