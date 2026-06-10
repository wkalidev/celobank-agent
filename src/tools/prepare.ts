import "dotenv/config"
import {
  createPublicClient,
  http,
  parseEther,
  parseUnits,
  encodeFunctionData,
} from "viem"
import { defineChain } from "viem"

// ─── Chain ────────────────────────────────────────────────────────────────────
const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC ?? "https://forno.celo.org"] } },
})

export const publicClient = createPublicClient({ chain: celo, transport: http() })

// ─── Contract Addresses ───────────────────────────────────────────────────────
const BROKER              = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as `0x${string}`
const BI_POOL_MANAGER     = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as `0x${string}`
const AAVE_POOL           = "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402" as `0x${string}`
const STAKED_CELO_MANAGER = "0x0239b96D10a434a56CC9E09383077A0490cF9398" as `0x${string}`
const UNISWAP_V3_ROUTER   = "0x5615CDAb10dc425a742d643d949a7F474C01abc4" as `0x${string}`
const UNISWAP_V3_FEE      = 3000 // 0.3%

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
          { name: "deadline",          type: "uint256" },
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

// ─── Prepare: Universal Swap ──────────────────────────────────────────────────
// Routes CELO ↔ Mento stablecoin through Mento V2; all other pairs through Uniswap V3.
export async function prepareSwap(
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

    const approveTx: UnsignedTx = {
      to:          inToken.address,
      data:        encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [BROKER, amountWei] }),
      chainId:     42220,
      description: `Approve ${amount} ${inToken.sym} to Mento V2 Broker`,
    }
    const swapTx: UnsignedTx = {
      to:          BROKER,
      data:        encodeFunctionData({ abi: BROKER_ABI, functionName: "swapIn", args: [BI_POOL_MANAGER, exchangeId, inToken.address, outToken.address, amountWei, 0n] }),
      chainId:     42220,
      description: `Swap ${amount} ${inToken.sym} → ${outToken.sym} via Mento V2`,
    }
    return {
      success:      true,
      action:       "swap",
      userAddress,
      transactions: [approveTx, swapTx],
      summary:      `Ready to swap ${amount} ${inToken.sym} → ${outToken.sym} via Mento V2. Sign 2 transactions: (1) Approve, (2) Swap.`,
    }
  }

  // ── Uniswap V3 path ─────────────────────────────────────────────────────────
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)

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
        deadline,
        amountIn:          amountWei,
        amountOutMinimum:  0n,
        sqrtPriceLimitX96: 0n,
      }],
    }),
    chainId:     42220,
    description: `Swap ${amount} ${inToken.sym} → ${outToken.sym} via Uniswap V3 (0.3%)`,
  }
  return {
    success:      true,
    action:       "swap",
    userAddress,
    transactions: [approveTx, swapTx],
    summary:      `Ready to swap ${amount} ${inToken.sym} → ${outToken.sym} via Uniswap V3. Sign 2 transactions: (1) Approve, (2) Swap.`,
  }
}

// ─── Prepare: Supply Aave ─────────────────────────────────────────────────────
export async function prepareSupplyAave(
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

// ─── Prepare: Send CELO ───────────────────────────────────────────────────────
export async function prepareSend(
  userAddress: string,
  to: string,
  amount: string
): Promise<PrepareResult> {
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

// ─── Prepare: Stake CELO ──────────────────────────────────────────────────────
export async function prepareStake(
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
