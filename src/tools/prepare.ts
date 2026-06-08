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

// ─── Addresses ────────────────────────────────────────────────────────────────
const BROKER          = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as `0x${string}`
const BI_POOL_MANAGER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as `0x${string}`
const AAVE_POOL       = "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402" as `0x${string}`
const STAKED_CELO_MANAGER = "0x0239b96D10a434a56CC9E09383077A0490cF9398" as `0x${string}`

export const TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  CELO:  { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18 },
  cUSD:  { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 },
  cEUR:  { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", decimals: 18 },
  cREAL: { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", decimals: 18 },
  USDC:  { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6  },
  USDT:  { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6  },
  KESm:  { address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", decimals: 18 },
  NGNm:  { address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", decimals: 18 },
  GHSm:  { address: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313", decimals: 18 },
  XOFm:  { address: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08", decimals: 18 },
  ZARm:  { address: "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6", decimals: 18 },
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

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UnsignedTx {
  to:       `0x${string}`
  data:     `0x${string}`
  value?:   string  // in wei as string
  chainId:  number
  description: string
}

export interface PrepareResult {
  success:     boolean
  action:      string
  userAddress: string
  transactions: UnsignedTx[]
  summary:     string
  error?:      string
}

// ─── Exchange ID Cache ────────────────────────────────────────────────────────
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

// ─── Prepare: Swap ────────────────────────────────────────────────────────────
export async function prepareSwap(
  userAddress: string,
  amount: string,
  tokenOut: string
): Promise<PrepareResult> {
  const symbol = Object.keys(TOKENS).find(k => k.toLowerCase() === tokenOut.toLowerCase())
  if (!symbol) {
    return { success: false, action: "swap", userAddress, transactions: [], summary: "", error: `Token "${tokenOut}" not supported` }
  }

  const token      = TOKENS[symbol]
  const amountWei  = parseEther(amount)
  const exchangeId = await getExchangeId(TOKENS.CELO.address, token.address)

  if (!exchangeId) {
    return { success: false, action: "swap", userAddress, transactions: [], summary: "", error: `No Mento V2 pool for CELO→${symbol}` }
  }

  // TX 1: Approve CELO to Broker
  const approveTx: UnsignedTx = {
    to:          TOKENS.CELO.address,
    data:        encodeFunctionData({
      abi:          ERC20_APPROVE_ABI,
      functionName: "approve",
      args:         [BROKER, amountWei],
    }),
    chainId:     42220,
    description: `Approve ${amount} CELO to Mento V2 Broker`,
  }

  // TX 2: Swap via Broker
  const swapTx: UnsignedTx = {
    to:          BROKER,
    data:        encodeFunctionData({
      abi:          BROKER_ABI,
      functionName: "swapIn",
      args:         [BI_POOL_MANAGER, exchangeId, TOKENS.CELO.address, token.address, amountWei, 0n],
    }),
    chainId:     42220,
    description: `Swap ${amount} CELO → ${symbol} via Mento V2`,
  }

  return {
    success:      true,
    action:       "swap",
    userAddress,
    transactions: [approveTx, swapTx],
    summary:      `Ready to swap ${amount} CELO → ${symbol}. Sign 2 transactions: (1) Approve, (2) Swap.`,
  }
}

// ─── Prepare: Supply Aave ─────────────────────────────────────────────────────
export async function prepareSupplyAave(
  userAddress: string,
  amount: string,
  asset = "cUSD"
): Promise<PrepareResult> {
  const token = TOKENS[asset.toUpperCase()]
  if (!token) {
    return { success: false, action: "supply_aave", userAddress, transactions: [], summary: "", error: `Asset "${asset}" not supported` }
  }

  const amountWei = parseUnits(amount, token.decimals)
  const user      = userAddress as `0x${string}`

  // TX 1: Approve asset to Aave
  const approveTx: UnsignedTx = {
    to:          token.address,
    data:        encodeFunctionData({
      abi:          ERC20_APPROVE_ABI,
      functionName: "approve",
      args:         [AAVE_POOL, amountWei],
    }),
    chainId:     42220,
    description: `Approve ${amount} ${asset} to Aave V3`,
  }

  // TX 2: Supply to Aave
  const supplyTx: UnsignedTx = {
    to:          AAVE_POOL,
    data:        encodeFunctionData({
      abi:          AAVE_SUPPLY_ABI,
      functionName: "supply",
      args:         [token.address, amountWei, user, 0],
    }),
    chainId:     42220,
    description: `Supply ${amount} ${asset} to Aave V3 (earn ~3-5% APY)`,
  }

  return {
    success:      true,
    action:       "supply_aave",
    userAddress,
    transactions: [approveTx, supplyTx],
    summary:      `Ready to supply ${amount} ${asset} to Aave V3. Sign 2 transactions: (1) Approve, (2) Supply.`,
  }
}

// ─── Prepare: Send CELO ───────────────────────────────────────────────────────
export async function prepareSend(
  userAddress: string,
  to: string,
  amount: string
): Promise<PrepareResult> {
  const sendTx: UnsignedTx = {
    to:          to as `0x${string}`,
    data:        "0x",
    value:       parseEther(amount).toString(),
    chainId:     42220,
    description: `Send ${amount} CELO to ${to.slice(0, 8)}...`,
  }

  return {
    success:      true,
    action:       "send",
    userAddress,
    transactions: [sendTx],
    summary:      `Ready to send ${amount} CELO to ${to}. Sign 1 transaction.`,
  }
}

// ─── Prepare: Stake CELO ──────────────────────────────────────────────────────
export async function prepareStake(
  userAddress: string,
  amount: string
): Promise<PrepareResult> {
  const stakeTx: UnsignedTx = {
    to:          STAKED_CELO_MANAGER,
    data:        encodeFunctionData({
      abi:          STAKED_CELO_ABI,
      functionName: "deposit",
      args:         [],
    }),
    value:       parseEther(amount).toString(),
    chainId:     42220,
    description: `Stake ${amount} CELO → stCELO (~4% APY)`,
  }

  return {
    success:      true,
    action:       "stake",
    userAddress,
    transactions: [stakeTx],
    summary:      `Ready to stake ${amount} CELO. Sign 1 transaction to receive stCELO.`,
  }
}