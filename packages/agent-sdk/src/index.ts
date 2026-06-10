// ─── Classe principale ────────────────────────────────────────────────────────
export { CeloBankSDK } from "./CeloBankSDK.js"

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  CeloBankConfig,
  BalanceResult,
  PriceResult,
  SwapResult,
  SendResult,
  AavePosition,
  AaveSupplyResult,
  SendParams,
  SwapParams,
  SwapTokensParams,
  SupplyAaveParams,
  GetPortfolioParams,
  GetPricesParams,
  GetAavePositionParams,
  LaunchTokenParams,
  LaunchTokenResult,
} from "./types.js"

// ─── Constants (utiles pour les intégrateurs) ─────────────────────────────────
export {
  TOKENS,
  MENTO_BROKER,
  MENTO_BI_POOL_MANAGER,
  MENTO_EXCHANGE_IDS,
  UNISWAP_V3_ROUTER,
  UNISWAP_V3_FEE,
  TOKEN_FACTORY,
  AAVE_POOL,
  ERC8004_REGISTRY,
  CELO_CHAIN_ID,
  CELO_RPC_DEFAULT,
  type TokenSymbol,
} from "./constants.js"

// ─── ABIs (pour les devs qui veulent interagir directement) ──────────────────
export { ERC20_ABI, BROKER_ABI, AAVE_POOL_ABI } from "./abis.js"