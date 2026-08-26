import "dotenv/config"
import {
  createPublicClient,
  http,
  parseEther,
  parseUnits,
  formatUnits,
  encodeFunctionData,
} from "viem"
import { defineChain } from "viem"
import { applyAttribution } from "../lib/attribution.js"

// ─── Chain ────────────────────────────────────────────────────────────────────
const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC ?? "https://forno.celo.org"] } },
})

export const publicClient = createPublicClient({ chain: celo, transport: http() })

// Marker prefix used by the LangChain-facing write tools (celo.ts, defi.ts, staking.ts)
// to signal that their string return value is actually a JSON-encoded PrepareResult
// that server.ts must surface to the frontend as unsigned transactions — instead of
// letting the model paraphrase it or (worse) executing it with the agent's own key.
export const UNSIGNED_TX_MARKER = "__CELOBANK_UNSIGNED_TX__"

// Same purpose as UNSIGNED_TX_MARKER but for an EIP-712 signature request rather than
// a transaction — used by tools/engagement.ts's claim_engagement_reward, which needs
// the user's typed-data signature (not a tx) before the agent's own wallet can submit
// the on-chain claim.
export const UNSIGNED_TYPED_DATA_MARKER = "__CELOBANK_UNSIGNED_TYPED_DATA__"

// ─── Contract Addresses ───────────────────────────────────────────────────────
const BROKER              = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as `0x${string}`
const BI_POOL_MANAGER     = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as `0x${string}`
const AAVE_POOL           = "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402" as `0x${string}`
const STAKED_CELO_MANAGER = "0x0239b96D10a434a56CC9E09383077A0490cF9398" as `0x${string}`
const STAKED_CELO_TOKEN   = "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24" as `0x${string}`
// StakedCelo Account.sol — holds the protocol's locked CELO and is the contract that actually
// interacts with Celo's core Election/LockedGold contracts to vote, unvote, and unlock CELO.
// See https://docs.stcelo.xyz/contracts/account
const STAKED_CELO_ACCOUNT = "0x4aAD04D41FD7fd495503731C5a2579e19054C432" as `0x${string}`
// Celo core protocol contracts (unchanged by the March 2025 L2 migration — see
// https://docs.celo.org/cel2/whats-changed/l1-l2 — Election/LockedGold kept the same addresses
// and semantics; only the consensus layer under them changed). Source: docs.celo.org/contracts/core-contracts
const CELO_ELECTION    = "0x8D6677192144292870907E3Fa8A5527fE55A7ff6" as `0x${string}`
const CELO_LOCKED_GOLD = "0x6cC083Aed9e3ebe302A6336dBC7c921C9f03349E" as `0x${string}`
const UNISWAP_V3_ROUTER   = "0x5615CDAb10dc425a742d643d949a7F474C01abc4" as `0x${string}`
const UNISWAP_V3_QUOTER   = "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8" as `0x${string}`
const UNISWAP_V3_FEE      = 3000 // 0.3%
const DEFAULT_SLIPPAGE_BPS = 100n // 1% default slippage tolerance for swap quotes

// ─── Token Registry (official Celo token list, chainId 42220) ────────────────
// Symbols are canonical; USDm/EURm/BRLm are aliases for cUSD/cEUR/cREAL.
export const TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  // Native CELO ERC20
  CELO:   { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18 },
  // ── Mento V2 stablecoins (CELO ↔ these via Broker) ──────────────────────────
  cUSD:   { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 },
  USDm:   { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 },
  cEUR:   { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18 },
  EURm:   { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18 },
  cREAL:  { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18 },
  BRLm:   { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18 },
  KESm:   { address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", decimals: 18 },
  NGNm:   { address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", decimals: 18 },
  GHSm:   { address: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313", decimals: 18 },
  XOFm:   { address: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08", decimals: 18 },
  ZARm:   { address: "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6", decimals: 18 },
  GBPm:   { address: "0xCCF663b1fF11028f0b19058d0f7B674004a40746", decimals: 18 },
  PHPm:   { address: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B", decimals: 18 },
  COPm:   { address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA", decimals: 18 },
  CADm:   { address: "0xff4Ab19391af240c311c54200a492233052B6325", decimals: 18 },
  AUDm:   { address: "0x7175504C455076F15c04A2F90a8e352281F492F9", decimals: 18 },
  CHFm:   { address: "0xb55a79F398E759E43C95b979163f30eC87Ee131D", decimals: 18 },
  JPYm:   { address: "0xc45eCF20f3CD864B32D9794d6f76814aE8892e20", decimals: 18 },
  // ── Non-Mento tokens (all pairs via Uniswap V3) ───────────────────────────
  USDC:   { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6  },
  USDT:   { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6  },
  WETH:   { address: "0x66803FB87aBd4aaC3cbB3fAd7C3aa01f6F3FB207", decimals: 18 },
  WBTC:   { address: "0xBAAB46E28388d2779e6E31Fd00cF0e5Ad95E327B", decimals: 8  },
  stCELO: { address: "0xC668583dcbDc9ae6FA3CE46462758188adfdfC24", decimals: 18 },
  UBE:    { address: "0x00Be915B9dCf56a3CBE739D9B9c202ca692409EC", decimals: 18 },
  USDGLO: { address: "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3", decimals: 18 },
  EURC:   { address: "0xBddC3554269053544bE0d6d027a73271225E9859", decimals: 6  },
}

// Lowercase addresses of all Mento V2-native stablecoins
const MENTO_STABLECOIN_ADDRS = new Set([
  "0x765de816845861e75a25fca122bb6898b8b1282a", // cUSD / USDm
  "0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73", // cEUR / EURm
  "0xe8537a3d056da446677b9e9d6c5db704eaab4787", // cREAL / BRLm
  "0x456a3d042c0dbd3db53d5489e98dfb038553b0d0", // KESm
  "0xe2702bd97ee33c88c8f6f92da3b733608aa76f71", // NGNm
  "0xfaea5f3404bba20d3cc2f8c4b0a888f55a3c7313", // GHSm
  "0x73f93dcc49cb8a239e2032663e9475dd5ef29a08", // XOFm
  "0x4c35853a3b4e647fd266f4de678dcc8fec410bf6", // ZARm
  "0xccf663b1ff11028f0b19058d0f7b674004a40746", // GBPm
  "0x105d4a9306d2e55a71d2eb95b81553ae1dc20d7b", // PHPm
  "0x8a567e2ae79ca692bd748ab832081c45de4041ea", // COPm
  "0xff4ab19391af240c311c54200a492233052b6325", // CADm
  "0x7175504c455076f15c04a2f90a8e352281f492f9", // AUDm
  "0xb55a79f398e759e43c95b979163f30ec87ee131d", // CHFm
  "0xc45ecf20f3cd864b32d9794d6f76814ae8892e20", // JPYm
])

// Returns true when the pair can be routed through Mento V2 (CELO ↔ stablecoin only)
function isMentoPair(tokenInAddr: string, tokenOutAddr: string): boolean {
  const celoAddr = TOKENS.CELO.address.toLowerCase()
  const a = tokenInAddr.toLowerCase()
  const b = tokenOutAddr.toLowerCase()
  return (a === celoAddr && MENTO_STABLECOIN_ADDRS.has(b)) ||
         (b === celoAddr && MENTO_STABLECOIN_ADDRS.has(a))
}

// Case-insensitive token lookup — returns { sym, address, decimals } or null
function findToken(symbol: string) {
  const key = Object.keys(TOKENS).find(k => k.toLowerCase() === symbol.toLowerCase())
  return key ? { sym: key, ...TOKENS[key] } : null
}

// ─── ABIs (minimal) ───────────────────────────────────────────────────────────
const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const

const BROKER_ABI = [
  {
    name: "swapIn",
    type: "function",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId",       type: "bytes32"  },
      { name: "tokenIn",          type: "address"  },
      { name: "tokenOut",         type: "address"  },
      { name: "amountIn",         type: "uint256"  },
      { name: "amountOutMin",     type: "uint256"  },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "getAmountOut",
    type: "function",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId",       type: "bytes32"  },
      { name: "tokenIn",          type: "address"  },
      { name: "tokenOut",         type: "address"  },
      { name: "amountIn",         type: "uint256"  },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "view",
  },
] as const

// QuoterV2 on Celo Mainnet — used for pre-flight Uniswap V3 quotes (slippage protection).
// https://docs.celo.org/tooling/contracts/uniswap-contracts
const QUOTER_V2_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",           type: "address" },
          { name: "tokenOut",          type: "address" },
          { name: "amountIn",          type: "uint256" },
          { name: "fee",               type: "uint24"  },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut",               type: "uint256" },
      { name: "sqrtPriceX96After",       type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32"  },
      { name: "gasEstimate",             type: "uint256" },
    ],
  },
] as const

const AAVE_SUPPLY_ABI = [
  {
    name: "supply",
    type: "function",
    inputs: [
      { name: "asset",        type: "address" },
      { name: "amount",       type: "uint256" },
      { name: "onBehalfOf",   type: "address" },
      { name: "referralCode", type: "uint16"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

const STAKED_CELO_ABI = [
  {
    name: "deposit",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
] as const

const BI_POOL_MANAGER_ABI = [
  {
    name: "getExchanges",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "exchangeId", type: "bytes32" },
          { name: "assets",     type: "address[]" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const

// NOTE: the router deployed at UNISWAP_V3_ROUTER is Uniswap's SwapRouter02, not the
// original SwapRouter. SwapRouter02's IV3SwapRouter.ExactInputSingleParams does NOT
// include a `deadline` field (unlike ISwapRouter) — including one here changes the
// function selector and makes every encoded swap revert on-chain. Verified against
// https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol
const UNISWAP_V3_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",           type: "address" },
          { name: "tokenOut",          type: "address" },
          { name: "fee",               type: "uint24"  },
          { name: "recipient",         type: "address" },
          { name: "amountIn",          type: "uint256" },
          { name: "amountOutMinimum",  type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
  },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UnsignedTx {
  to:       `0x${string}`
  data:     `0x${string}`
  value?:   string
  chainId:  number
  description: string
}

export interface PrepareResult {
  success:      boolean
  action:       string
  userAddress:  string
  transactions: UnsignedTx[]
  summary:      string
  error?:       string
}

// ─── Exchange ID Cache (Mento) ────────────────────────────────────────────────
let exchangeCache: Map<string, `0x${string}`> | null = null

async function getExchangeId(
  tokenInAddr: string,
  tokenOutAddr: string
): Promise<`0x${string}` | null> {
  if (!exchangeCache) {
    const exchanges = await publicClient.readContract({
      address: BI_POOL_MANAGER,
      abi: BI_POOL_MANAGER_ABI,
      functionName: "getExchanges",
    })
    exchangeCache = new Map()
    for (const ex of exchanges) {
      const key = ex.assets.map((a: string) => a.toLowerCase()).sort().join(":")
      exchangeCache.set(key, ex.exchangeId as `0x${string}`)
    }
  }
  const key = [tokenInAddr.toLowerCase(), tokenOutAddr.toLowerCase()].sort().join(":")
  return exchangeCache?.get(key) ?? null
}

// ─── Slippage Protection ──────────────────────────────────────────────────────
function applySlippage(amountOut: bigint, slippageBps: bigint = DEFAULT_SLIPPAGE_BPS): bigint {
  if (amountOut <= 0n) return 0n
  return amountOut - (amountOut * slippageBps) / 10_000n
}

// Live quote from the Mento Broker. Returns null (never throws) if the quote fails —
// callers fall back to amountOutMin = 0n and surface a warning to the user instead of
// blocking the swap outright.
async function quoteMentoAmountOut(
  exchangeId: `0x${string}`,
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint
): Promise<bigint | null> {
  try {
    const amountOut = await publicClient.readContract({
      address:      BROKER,
      abi:          BROKER_ABI,
      functionName: "getAmountOut",
      args:         [BI_POOL_MANAGER, exchangeId, tokenIn, tokenOut, amountIn],
    })
    return amountOut as bigint
  } catch (e) {
    console.error("[prepare] Mento getAmountOut quote failed:", e instanceof Error ? e.message : e)
    return null
  }
}

// Live quote from Uniswap V3 QuoterV2. quoteExactInputSingle is a non-view function
// (it reverts internally to compute the output) but is safe and standard to call via
// eth_call / simulateContract — no state is ever changed, no approval required.
async function quoteUniswapAmountOut(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint
): Promise<bigint | null> {
  try {
    const { result } = await publicClient.simulateContract({
      address:      UNISWAP_V3_QUOTER,
      abi:          QUOTER_V2_ABI,
      functionName: "quoteExactInputSingle",
      args:         [{ tokenIn, tokenOut, amountIn, fee: UNISWAP_V3_FEE, sqrtPriceLimitX96: 0n }],
    })
    return (result as readonly [bigint, bigint, number, bigint])[0]
  } catch (e) {
    console.error("[prepare] Uniswap V3 quote failed:", e instanceof Error ? e.message : e)
    return null
  }
}

// ─── Prepare: Universal Swap ──────────────────────────────────────────────────
// Routes CELO ↔ Mento stablecoin through Mento V2; all other pairs through Uniswap V3.
async function prepareSwapImpl(
  userAddress: string,
  amount: string,
  tokenOut: string,
  tokenIn = "CELO"
): Promise<PrepareResult> {
  const inToken  = findToken(tokenIn)
  const outToken = findToken(tokenOut)

  if (!inToken) {
    return { success: false, action: "swap", userAddress, transactions: [], summary: "", error: `Token "${tokenIn}" not supported` }
  }
  if (!outToken) {
    return { success: false, action: "swap", userAddress, transactions: [], summary: "", error: `Token "${tokenOut}" not supported` }
  }

  const amountWei = parseUnits(amount, inToken.decimals)

  if (isMentoPair(inToken.address, outToken.address)) {
    // ── Mento V2 path ─────────────────────────────────────────────────────────
    const exchangeId = await getExchangeId(inToken.address, outToken.address)
    if (!exchangeId) {
      return { success: false, action: "swap", userAddress, transactions: [], summary: "", error: `No Mento V2 pool for ${inToken.sym}→${outToken.sym}` }
    }

    const quotedOut  = await quoteMentoAmountOut(exchangeId, inToken.address, outToken.address, amountWei)
    const amountOutMin = quotedOut !== null ? applySlippage(quotedOut) : 0n
    const slippageWarning = quotedOut === null
      ? " ⚠️ Live price quote unavailable — this swap has NO slippage protection (amountOutMin=0). Proceed with caution."
      : ""

    const approveTx: UnsignedTx = {
      to:          inToken.address,
      data:        encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [BROKER, amountWei] }),
      chainId:     42220,
      description: `Approve ${amount} ${inToken.sym} to Mento V2 Broker`,
    }
    const swapTx: UnsignedTx = {
      to:          BROKER,
      data:        encodeFunctionData({ abi: BROKER_ABI, functionName: "swapIn", args: [BI_POOL_MANAGER, exchangeId, inToken.address, outToken.address, amountWei, amountOutMin] }),
      chainId:     42220,
      description: `Swap ${amount} ${inToken.sym} → ${outToken.sym} via Mento V2 (min. ${formatUnits(amountOutMin, outToken.decimals)} ${outToken.sym}, ~1% slippage)`,
    }
    return {
      success:      true,
      action:       "swap",
      userAddress,
      transactions: [approveTx, swapTx],
      summary:      `Ready to swap ${amount} ${inToken.sym} → ${outToken.sym} via Mento V2. Sign 2 transactions: (1) Approve, (2) Swap.${slippageWarning}`,
    }
  }

  // ── Uniswap V3 path ─────────────────────────────────────────────────────────
  const quotedOutUni  = await quoteUniswapAmountOut(inToken.address, outToken.address, amountWei)
  const amountOutMinUni = quotedOutUni !== null ? applySlippage(quotedOutUni) : 0n
  const slippageWarningUni = quotedOutUni === null
    ? " ⚠️ Live price quote unavailable — this swap has NO slippage protection (amountOutMinimum=0). Proceed with caution."
    : ""

  const approveTx: UnsignedTx = {
    to:          inToken.address,
    data:        encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [UNISWAP_V3_ROUTER, amountWei] }),
    chainId:     42220,
    description: `Approve ${amount} ${inToken.sym} to Uniswap V3`,
  }
  const swapTx: UnsignedTx = {
    to:          UNISWAP_V3_ROUTER,
    data:        encodeFunctionData({
      abi:          UNISWAP_V3_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [{
        tokenIn:           inToken.address,
        tokenOut:          outToken.address,
        fee:               UNISWAP_V3_FEE,
        recipient:         userAddress as `0x${string}`,
        amountIn:          amountWei,
        amountOutMinimum:  amountOutMinUni,
        sqrtPriceLimitX96: 0n,
      }],
    }),
    chainId:     42220,
    description: `Swap ${amount} ${inToken.sym} → ${outToken.sym} via Uniswap V3 (0.3%, min. ${formatUnits(amountOutMinUni, outToken.decimals)} ${outToken.sym}, ~1% slippage)`,
  }
  return {
    success:      true,
    action:       "swap",
    userAddress,
    transactions: [approveTx, swapTx],
    summary:      `Ready to swap ${amount} ${inToken.sym} → ${outToken.sym} via Uniswap V3. Sign 2 transactions: (1) Approve, (2) Swap.${slippageWarningUni}`,
  }
}

export async function prepareSwap(...args: Parameters<typeof prepareSwapImpl>): Promise<PrepareResult> {
  return applyAttribution(await prepareSwapImpl(...args))
}

// ─── Prepare: Supply Aave ─────────────────────────────────────────────────────
async function prepareSupplyAaveImpl(
  userAddress: string,
  amount: string,
  asset = "cUSD"
): Promise<PrepareResult> {
  const token = findToken(asset)
  if (!token) {
    return { success: false, action: "supply_aave", userAddress, transactions: [], summary: "", error: `Asset "${asset}" not supported` }
  }

  const amountWei = parseUnits(amount, token.decimals)
  const user      = userAddress as `0x${string}`

  const approveTx: UnsignedTx = {
    to:          token.address,
    data:        encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [AAVE_POOL, amountWei] }),
    chainId:     42220,
    description: `Approve ${amount} ${token.sym} to Aave V3`,
  }
  const supplyTx: UnsignedTx = {
    to:          AAVE_POOL,
    data:        encodeFunctionData({ abi: AAVE_SUPPLY_ABI, functionName: "supply", args: [token.address, amountWei, user, 0] }),
    chainId:     42220,
    description: `Supply ${amount} ${token.sym} to Aave V3 (earn ~3-5% APY)`,
  }
  return {
    success:      true,
    action:       "supply_aave",
    userAddress,
    transactions: [approveTx, supplyTx],
    summary:      `Ready to supply ${amount} ${token.sym} to Aave V3. Sign 2 transactions: (1) Approve, (2) Supply.`,
  }
}

export async function prepareSupplyAave(...args: Parameters<typeof prepareSupplyAaveImpl>): Promise<PrepareResult> {
  return applyAttribution(await prepareSupplyAaveImpl(...args))
}

// ─── Prepare: Send CELO or any ERC20 token ────────────────────────────────────
// `token` defaults to "CELO" (native transfer) for backward compatibility. Any
// other registered symbol (cUSD, cEUR, USDC, ...) is sent via ERC20 transfer().
// Previously this only ever supported native CELO, even though the app's own
// advertised example ("envoie 5 cUSD à mon ami") implies stablecoin sends — a
// request for "5 cUSD" silently sent 5 CELO instead (wrong asset, wrong value).
const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const

async function prepareSendImpl(
  userAddress: string,
  to: string,
  amount: string,
  token: string = "CELO"
): Promise<PrepareResult> {
  const tok = findToken(token)
  if (!tok) {
    return { success: false, action: "send", userAddress, transactions: [], summary: "", error: `Token "${token}" not supported` }
  }

  if (tok.sym === "CELO") {
    return {
      success:      true,
      action:       "send",
      userAddress,
      transactions: [{
        to:          to as `0x${string}`,
        data:        "0x",
        value:       parseEther(amount).toString(),
        chainId:     42220,
        description: `Send ${amount} CELO to ${to.slice(0, 8)}...`,
      }],
      summary: `Ready to send ${amount} CELO to ${to}. Sign 1 transaction.`,
    }
  }

  const amountWei = parseUnits(amount, tok.decimals)
  return {
    success:      true,
    action:       "send",
    userAddress,
    transactions: [{
      to:          tok.address,
      data:        encodeFunctionData({ abi: ERC20_TRANSFER_ABI, functionName: "transfer", args: [to as `0x${string}`, amountWei] }),
      chainId:     42220,
      description: `Send ${amount} ${tok.sym} to ${to.slice(0, 8)}...`,
    }],
    summary: `Ready to send ${amount} ${tok.sym} to ${to}. Sign 1 transaction.`,
  }
}

export async function prepareSend(...args: Parameters<typeof prepareSendImpl>): Promise<PrepareResult> {
  return applyAttribution(await prepareSendImpl(...args))
}

// ─── Prepare: Stake CELO ──────────────────────────────────────────────────────
async function prepareStakeImpl(
  userAddress: string,
  amount: string
): Promise<PrepareResult> {
  return {
    success:      true,
    action:       "stake",
    userAddress,
    transactions: [{
      to:          STAKED_CELO_MANAGER,
      data:        encodeFunctionData({ abi: STAKED_CELO_ABI, functionName: "deposit", args: [] }),
      value:       parseEther(amount).toString(),
      chainId:     42220,
      description: `Stake ${amount} CELO → stCELO (~4% APY)`,
    }],
    summary: `Ready to stake ${amount} CELO. Sign 1 transaction to receive stCELO.`,
  }
}

export async function prepareStake(...args: Parameters<typeof prepareStakeImpl>): Promise<PrepareResult> {
  return applyAttribution(await prepareStakeImpl(...args))
}

// ─── Prepare: Unstake stCELO ──────────────────────────────────────────────────
const STAKED_CELO_WITHDRAW_ABI = [
  {
    name: "withdraw",
    type: "function",
    inputs: [{ name: "stakedCeloAmount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

async function prepareUnstakeImpl(
  userAddress: string,
  amount: string
): Promise<PrepareResult> {
  const amountWei = parseEther(amount)

  const approveTx: UnsignedTx = {
    to:          STAKED_CELO_TOKEN,
    data:        encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [STAKED_CELO_MANAGER, amountWei] }),
    chainId:     42220,
    description: `Approve ${amount} stCELO to Staked CELO Manager`,
  }
  const withdrawTx: UnsignedTx = {
    to:          STAKED_CELO_MANAGER,
    data:        encodeFunctionData({ abi: STAKED_CELO_WITHDRAW_ABI, functionName: "withdraw", args: [amountWei] }),
    chainId:     42220,
    description: `Schedule unstake of ${amount} stCELO (step 1 of 3)`,
  }
  return {
    success:      true,
    action:       "unstake",
    userAddress,
    transactions: [approveTx, withdrawTx],
    summary:      `Ready to unstake ${amount} stCELO — step 1 of 3. Sign 2 transactions now: (1) Approve, (2) Schedule. ` +
                  `This does NOT release your CELO yet — it only burns your stCELO and schedules the withdrawal. ` +
                  `After this confirms, run "continue unstake" to start the ~3-day unbonding countdown, then "claim unstake" once it's elapsed to actually receive your CELO.`,
  }
}

export async function prepareUnstake(...args: Parameters<typeof prepareUnstakeImpl>): Promise<PrepareResult> {
  return applyAttribution(await prepareUnstakeImpl(...args))
}

// ─── Prepare: Complete Unstake (step 2 of 3) ──────────────────────────────────
// The StakedCelo protocol requires 3 on-chain steps to fully unstake (see
// https://docs.stcelo.xyz/deposit-and-withdrawal-flows): (1) Manager.withdraw — burns stCELO,
// schedules a withdrawal (prepareUnstake, above); (2) Account.withdraw — unvotes CELO from the
// validator group(s) and starts the 3-day LockedGold unlock countdown (this function); (3)
// Account.finishPendingWithdrawal — after the 3 days, actually transfers the CELO (prepareClaimUnstake,
// below). All three remain fully user-signed; nothing here is done by the agent's own wallet.
//
// Account.withdraw() takes `lesser`/`greater` neighbor hints for Celo's on-chain sorted linked
// list of validator groups by vote count — an incorrect hint causes Election.sol to revert the
// call (safely — no funds move, no state is corrupted, the user just retries), so getting this
// wrong is a reliability issue, not a fund-safety one. See findLesserAndGreater() below.
const ELECTION_ABI = [
  { name: "getGroupsVotedForByAccount", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "address[]" }] },
  { name: "getTotalVotesForEligibleValidatorGroups", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "groups", type: "address[]" }, { name: "values", type: "uint256[]" }] },
  { name: "getTotalVotesForGroup", type: "function", stateMutability: "view",
    inputs: [{ name: "group", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getPendingVotesForGroupByAccount", type: "function", stateMutability: "view",
    inputs: [{ name: "group", type: "address" }, { name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getActiveVotesForGroupByAccount", type: "function", stateMutability: "view",
    inputs: [{ name: "group", type: "address" }, { name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const

const STAKED_CELO_ACCOUNT_ABI = [
  { name: "scheduledWithdrawalsForGroupAndBeneficiary", type: "function", stateMutability: "view",
    inputs: [{ name: "group", type: "address" }, { name: "beneficiary", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "beneficiary",               type: "address" },
      { name: "group",                     type: "address" },
      { name: "lesserAfterPendingRevoke",  type: "address" },
      { name: "greaterAfterPendingRevoke", type: "address" },
      { name: "lesserAfterActiveRevoke",   type: "address" },
      { name: "greaterAfterActiveRevoke",  type: "address" },
      { name: "index",                     type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "getPendingWithdrawals", type: "function", stateMutability: "view",
    inputs: [{ name: "beneficiary", type: "address" }], outputs: [{ name: "values", type: "uint256[]" }, { name: "timestamps", type: "uint256[]" }] },
  { name: "finishPendingWithdrawal", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "beneficiary",                    type: "address" },
      { name: "localPendingWithdrawalIndex",    type: "uint256" },
      { name: "lockedGoldPendingWithdrawalIndex", type: "uint256" },
    ],
    outputs: [{ name: "amount", type: "uint256" }] },
] as const

const LOCKED_GOLD_ABI = [
  { name: "getPendingWithdrawals", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256[]" }, { name: "", type: "uint256[]" }] },
] as const

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`

/**
 * Finds the correct `lesser`/`greater` neighbor addresses for inserting `group` at
 * `newVoteTotal` into Celo's global sorted-by-votes eligible validator group list.
 * Required by Election.sol's revokePending/revokeActive (called internally by
 * Account.withdraw). Wrong values cause a safe revert, not a fund-safety issue.
 */
async function findLesserAndGreater(
  group: `0x${string}`,
  newVoteTotal: bigint
): Promise<{ lesser: `0x${string}`; greater: `0x${string}` }> {
  const [groups, values] = await publicClient.readContract({
    address: CELO_ELECTION,
    abi: ELECTION_ABI,
    functionName: "getTotalVotesForEligibleValidatorGroups",
  }) as [readonly `0x${string}`[], readonly bigint[]]

  // List is sorted descending by vote count. Walk it (skipping `group` itself, still present
  // at its pre-revoke total) to find the two groups newVoteTotal would sit between.
  let lesser: `0x${string}` = ZERO_ADDRESS
  let greater: `0x${string}` = ZERO_ADDRESS
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].toLowerCase() === group.toLowerCase()) continue
    if (values[i] > newVoteTotal) {
      greater = groups[i]
    } else {
      lesser = groups[i]
      break
    }
  }
  return { lesser, greater }
}

async function prepareCompleteUnstakeImpl(userAddress: string): Promise<PrepareResult> {
  const beneficiary = userAddress as `0x${string}`

  const groups = await publicClient.readContract({
    address: CELO_ELECTION,
    abi: ELECTION_ABI,
    functionName: "getGroupsVotedForByAccount",
    args: [STAKED_CELO_ACCOUNT],
  }) as readonly `0x${string}`[]

  const transactions: UnsignedTx[] = []

  for (let index = 0; index < groups.length; index++) {
    const group = groups[index]
    const revokeAmount = await publicClient.readContract({
      address: STAKED_CELO_ACCOUNT,
      abi: STAKED_CELO_ACCOUNT_ABI,
      functionName: "scheduledWithdrawalsForGroupAndBeneficiary",
      args: [group, beneficiary],
    }) as bigint

    if (revokeAmount === 0n) continue

    const [pendingForGroup, groupGlobalTotal] = await Promise.all([
      publicClient.readContract({
        address: CELO_ELECTION, abi: ELECTION_ABI,
        functionName: "getPendingVotesForGroupByAccount", args: [group, STAKED_CELO_ACCOUNT],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: CELO_ELECTION, abi: ELECTION_ABI,
        functionName: "getTotalVotesForGroup", args: [group],
      }) as Promise<bigint>,
    ])

    const pendingRevoke = revokeAmount < pendingForGroup ? revokeAmount : pendingForGroup
    const activeRevoke  = revokeAmount - pendingRevoke

    const afterPending = await findLesserAndGreater(group, groupGlobalTotal - pendingRevoke)
    const afterActive  = activeRevoke > 0n
      ? await findLesserAndGreater(group, groupGlobalTotal - revokeAmount)
      : { lesser: ZERO_ADDRESS, greater: ZERO_ADDRESS }

    transactions.push({
      to:   STAKED_CELO_ACCOUNT,
      data: encodeFunctionData({
        abi: STAKED_CELO_ACCOUNT_ABI,
        functionName: "withdraw",
        args: [beneficiary, group, afterPending.lesser, afterPending.greater, afterActive.lesser, afterActive.greater, BigInt(index)],
      }),
      chainId:     42220,
      description: `Unvote ${formatUnits(revokeAmount, 18)} CELO from validator group ${group.slice(0, 8)}… — starts 3-day unlock`,
    })
  }

  if (transactions.length === 0) {
    return {
      success: false, action: "complete_unstake", userAddress, transactions: [],
      summary: "", error: "No scheduled withdrawal found. Run \"unstake\" first, wait for it to confirm, then retry.",
    }
  }

  return {
    success:      true,
    action:       "complete_unstake",
    userAddress,
    transactions,
    summary:      `Step 2 of 3: sign ${transactions.length} transaction(s) to start the 3-day unbonding countdown. ` +
                  `Once it elapses, run "claim unstake" to receive your CELO.`,
  }
}

export async function prepareCompleteUnstake(...args: Parameters<typeof prepareCompleteUnstakeImpl>): Promise<PrepareResult> {
  return applyAttribution(await prepareCompleteUnstakeImpl(...args))
}

// ─── Prepare: Claim Unstake (step 3 of 3) ─────────────────────────────────────
async function prepareClaimUnstakeImpl(userAddress: string): Promise<PrepareResult> {
  const beneficiary = userAddress as `0x${string}`
  const now = BigInt(Math.floor(Date.now() / 1000))

  const [localValues, localTimestamps] = await publicClient.readContract({
    address: STAKED_CELO_ACCOUNT, abi: STAKED_CELO_ACCOUNT_ABI,
    functionName: "getPendingWithdrawals", args: [beneficiary],
  }) as [readonly bigint[], readonly bigint[]]

  if (localValues.length === 0) {
    return {
      success: false, action: "claim_unstake", userAddress, transactions: [],
      summary: "", error: "No pending withdrawal found. Run \"unstake\" then \"continue unstake\" first.",
    }
  }

  const [lgValues, lgTimestamps] = await publicClient.readContract({
    address: CELO_LOCKED_GOLD, abi: LOCKED_GOLD_ABI,
    functionName: "getPendingWithdrawals", args: [STAKED_CELO_ACCOUNT],
  }) as [readonly bigint[], readonly bigint[]]

  const usedLgIndices = new Set<number>()
  const transactions: UnsignedTx[] = []
  let notReadyCount = 0
  let earliestReadyAt = 0n

  for (let i = 0; i < localValues.length; i++) {
    if (localTimestamps[i] > now) {
      notReadyCount++
      if (earliestReadyAt === 0n || localTimestamps[i] < earliestReadyAt) earliestReadyAt = localTimestamps[i]
      continue
    }
    const lgIndex = lgValues.findIndex((v, j) =>
      !usedLgIndices.has(j) && v === localValues[i] && lgTimestamps[j] === localTimestamps[i]
    )
    if (lgIndex === -1) continue // couldn't match — skip rather than guess
    usedLgIndices.add(lgIndex)

    transactions.push({
      to:   STAKED_CELO_ACCOUNT,
      data: encodeFunctionData({
        abi: STAKED_CELO_ACCOUNT_ABI,
        functionName: "finishPendingWithdrawal",
        args: [beneficiary, BigInt(i), BigInt(lgIndex)],
      }),
      chainId:     42220,
      description: `Claim ${formatUnits(localValues[i], 18)} CELO (unlocked)`,
    })
  }

  if (transactions.length === 0) {
    const waitMsg = notReadyCount > 0 && earliestReadyAt > 0n
      ? ` Still unlocking — ready at ${new Date(Number(earliestReadyAt) * 1000).toISOString()}.`
      : ""
    return {
      success: false, action: "claim_unstake", userAddress, transactions: [],
      summary: "", error: `Nothing ready to claim yet.${waitMsg}`,
    }
  }

  return {
    success:      true,
    action:       "claim_unstake",
    userAddress,
    transactions,
    summary:      `Step 3 of 3: sign ${transactions.length} transaction(s) to receive your unlocked CELO.` +
                  (notReadyCount > 0 ? ` (${notReadyCount} other withdrawal(s) still unlocking.)` : ""),
  }
}

export async function prepareClaimUnstake(...args: Parameters<typeof prepareClaimUnstakeImpl>): Promise<PrepareResult> {
  return applyAttribution(await prepareClaimUnstakeImpl(...args))
}
