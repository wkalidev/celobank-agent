import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  formatUnits,
  parseUnits,
  type PublicClient,
  type WalletClient,
  defineChain,
} from "viem"
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts"
import {
  TOKENS,
  MENTO_BROKER,
  MENTO_BI_POOL_MANAGER,
  MENTO_EXCHANGE_IDS,
  AAVE_POOL,
  CELO_RPC_DEFAULT,
  type TokenSymbol,
} from "./constants.js"
import { ERC20_ABI, BROKER_ABI, AAVE_POOL_ABI } from "./abis.js"
import type {
  CeloBankConfig,
  BalanceResult,
  PriceResult,
  SwapResult,
  SendResult,
  AavePosition,
  AaveSupplyResult,
  SendParams,
  SwapParams,
  SupplyAaveParams,
  GetPortfolioParams,
  GetPricesParams,
  GetAavePositionParams,
} from "./types.js"

const celoMainnet = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [CELO_RPC_DEFAULT] } },
  blockExplorers: {
    default: { name: "CeloScan", url: "https://celoscan.io" },
  },
})

// ─── DailyDrop Constants ──────────────────────────────────────────────────────
const DAILYDROP_CELO         = "0x63596cf6601ec2240A295ff2840C8d6653252AE6" as `0x${string}`
const DAILYDROP_FEE_RECEIVER = "0xDEAcDe6eC27Fd0cD972c1232C4f0d4171dda2357" as `0x${string}`
const DAILYDROP_CHECK_IN_FEE = parseEther("0.001")

const DAILYDROP_ABI = [
  { name: "checkIn",     type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { name: "claimReward", type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
  {
    name: "getUserData", type: "function",
    inputs: [{ internalType: "address", name: "_user", type: "address" }],
    outputs: [
      { internalType: "uint256", name: "streak",        type: "uint256" },
      { internalType: "uint256", name: "lastCheckIn",   type: "uint256" },
      { internalType: "uint256", name: "totalCheckIns", type: "uint256" },
      { internalType: "bool",    name: "canCheckIn",    type: "bool"    },
      { internalType: "bool",    name: "canClaim",      type: "bool"    },
      { internalType: "uint256", name: "nextCheckIn",   type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────
export interface StreakResult {
  address:         string
  streak:          number
  totalCheckIns:   number
  canCheckIn:      boolean
  canClaim:        boolean
  nextCheckIn:     number
  nextCheckInDate: string
}

export interface CheckInResult {
  success:        boolean
  streak:         number
  feeTxHash:      string
  checkInTxHash:  string
  explorerUrl:    string
  message:        string
}

export interface ClaimRewardResult {
  success:     boolean
  txHash:      string
  explorerUrl: string
  amount:      string
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
export class CeloBankSDK {
  private account: PrivateKeyAccount
  private publicClient: PublicClient
  private walletClient: WalletClient
  readonly address: `0x${string}`

  constructor(config: CeloBankConfig) {
    const rawKey = config.privateKey.trim()
    const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`
    this.account = privateKeyToAccount(privateKey)
    this.address = this.account.address
    const rpcUrl = config.rpcUrl ?? CELO_RPC_DEFAULT
    this.publicClient = createPublicClient({ chain: celoMainnet, transport: http(rpcUrl) }) as PublicClient
    this.walletClient = createWalletClient({ account: this.account, chain: celoMainnet, transport: http(rpcUrl) })
  }

  /**
   * Retourne le portefeuille complet : CELO natif + tous les tokens ERC20
   */
  async getPortfolio(params: GetPortfolioParams = {}): Promise<BalanceResult> {
    const addr = (params.address ?? this.address) as `0x${string}`
    const nativeBalance = await this.publicClient.getBalance({ address: addr })
    const tokenBalances = await Promise.all(
      Object.entries(TOKENS).map(async ([symbol, token]) => {
        try {
          const balance = await this.publicClient.readContract({
            address: token.address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [addr],
          })
          return [symbol, parseFloat(formatUnits(balance as bigint, token.decimals)).toFixed(4)] as [string, string]
        } catch {
          return [symbol, "0.0000"] as [string, string]
        }
      })
    )
    return {
      address: addr,
      native:  parseFloat(formatEther(nativeBalance)).toFixed(4),
      tokens:  Object.fromEntries(tokenBalances),
    }
  }

  /**
   * Prix en temps réel + variation 24h via CoinGecko
   */
  async getPrices(params: GetPricesParams = {}): Promise<PriceResult[]> {
    const requested = params.tokens
      ? params.tokens.map(t => t.toUpperCase()).filter(t => TOKENS[t as TokenSymbol])
      : (Object.keys(TOKENS) as TokenSymbol[])
    const ids = requested.map(t => TOKENS[t as TokenSymbol].coingeckoId).join(",")
    const res  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`)
    const data = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>
    return requested.map(symbol => ({
      symbol,
      priceUsd:  data[TOKENS[symbol as TokenSymbol].coingeckoId]?.usd ?? 0,
      change24h: data[TOKENS[symbol as TokenSymbol].coingeckoId]?.usd_24h_change ?? 0,
    }))
  }

  /**
   * Envoyer du CELO natif
   */
  async send(params: SendParams): Promise<SendResult> {
    const txHash = await this.walletClient.sendTransaction({
      account: this.account,
      chain:   celoMainnet,
      to:      params.to as `0x${string}`,
      value:   parseEther(params.amount),
    })
    return {
      success:     true,
      to:          params.to,
      amount:      params.amount,
      txHash,
      explorerUrl: `https://celoscan.io/tx/${txHash}`,
    }
  }

  /**
   * Swapper CELO → stablecoin via Mento V2
   */
  async swap(params: SwapParams): Promise<SwapResult> {
    const symbol = Object.keys(TOKENS).find(k => k.toLowerCase() === params.tokenOut.toLowerCase()) as TokenSymbol
    if (!symbol) throw new Error(`Token "${params.tokenOut}" non supporté`)
    const token      = TOKENS[symbol]
    const parsed     = parseEther(params.amount)
    const exchangeId = MENTO_EXCHANGE_IDS[symbol] ?? await this._getExchangeId(token.address)
    if (!exchangeId) throw new Error(`Pas de pool Mento V2 pour CELO→${symbol}`)
    const approveHash = await this.walletClient.writeContract({
      account: this.account, chain: celoMainnet,
      address: TOKENS.CELO.address, abi: ERC20_ABI,
      functionName: "approve", args: [MENTO_BROKER, parsed],
    })
    await this.publicClient.waitForTransactionReceipt({ hash: approveHash })
    const txHash = await this.walletClient.writeContract({
      account: this.account, chain: celoMainnet,
      address: MENTO_BROKER, abi: BROKER_ABI,
      functionName: "swapIn",
      args: [MENTO_BI_POOL_MANAGER, exchangeId, TOKENS.CELO.address, token.address, parsed, 0n],
    })
    return {
      success: true, amountIn: params.amount, tokenOut: symbol,
      txHash,  explorerUrl: `https://celoscan.io/tx/${txHash}`,
    }
  }

  /**
   * Lire la position Aave V3
   */
  async getAavePosition(params: GetAavePositionParams = {}): Promise<AavePosition> {
    const addr = (params.address ?? this.address) as `0x${string}`
    const data = await this.publicClient.readContract({
      address: AAVE_POOL, abi: AAVE_POOL_ABI,
      functionName: "getUserAccountData", args: [addr],
    }) as [bigint, bigint, bigint, bigint, bigint, bigint]
    const [collateral, debt, available, , , healthFactor] = data
    return {
      address:             addr,
      totalCollateralUsd:  formatUnits(collateral, 8),
      totalDebtUsd:        formatUnits(debt, 8),
      availableBorrowsUsd: formatUnits(available, 8),
      healthFactor:        formatUnits(healthFactor, 18),
    }
  }

  /**
   * Déposer sur Aave V3 pour générer des intérêts
   */
  async supplyAave(params: SupplyAaveParams): Promise<AaveSupplyResult> {
    const assetSymbol = (params.asset ?? "cUSD").toUpperCase() as TokenSymbol
    const token = TOKENS[assetSymbol]
    if (!token) throw new Error(`Asset "${assetSymbol}" non supporté pour Aave`)
    const parsed = parseUnits(params.amount, token.decimals)
    await this.walletClient.writeContract({
      account: this.account, chain: celoMainnet,
      address: token.address, abi: ERC20_ABI,
      functionName: "approve", args: [AAVE_POOL, parsed],
    })
    const txHash = await this.walletClient.writeContract({
      account: this.account, chain: celoMainnet,
      address: AAVE_POOL, abi: AAVE_POOL_ABI,
      functionName: "supply",
      args: [token.address, parsed, this.address, 0],
    })
    return {
      success: true, asset: assetSymbol, amount: params.amount,
      txHash,  explorerUrl: `https://celoscan.io/tx/${txHash}`,
    }
  }

  // ─── DailyDrop Methods ──────────────────────────────────────────────────────

  /**
   * Lire le streak DailyDrop d'une adresse
   * @example
   * const streak = await sdk.getStreak()
   * console.log(`Streak: ${streak.streak} days`)
   */
  async getStreak(params: { address?: string } = {}): Promise<StreakResult> {
    const addr = (params.address ?? this.address) as `0x${string}`
    const data = await this.publicClient.readContract({
      address: DAILYDROP_CELO,
      abi:     DAILYDROP_ABI,
      functionName: "getUserData",
      args:    [addr],
    })
    const nextCheckInTs = Number(data[5])
    return {
      address:         addr,
      streak:          Number(data[0]),
      totalCheckIns:   Number(data[2]),
      canCheckIn:      Boolean(data[3]),
      canClaim:        Boolean(data[4]),
      nextCheckIn:     nextCheckInTs,
      nextCheckInDate: nextCheckInTs > 0
        ? new Date(nextCheckInTs * 1000).toISOString()
        : "now",
    }
  }

  /**
   * Daily check-in sur DailyDrop
   * - Envoie 0.001 CELO de fee
   * - Appelle checkIn() sur le contrat
   * - Après 7 jours → claimDrop() pour recevoir 10 DROP
   * @example
   * const result = await sdk.checkIn()
   * console.log(result.message) // "6 days until reward"
   */
  async checkIn(): Promise<CheckInResult> {
    const streakData = await this.getStreak()
    if (!streakData.canCheckIn) {
      throw new Error(`Already checked in today. Next: ${streakData.nextCheckInDate}`)
    }

    // TX 1: Fee → zcodebase.eth
    const feeTxHash = await this.walletClient.sendTransaction({
      account: this.account, chain: celoMainnet,
      to:    DAILYDROP_FEE_RECEIVER,
      value: DAILYDROP_CHECK_IN_FEE,
    })
    await this.publicClient.waitForTransactionReceipt({ hash: feeTxHash })

    // TX 2: Check-in on-chain
    const checkInTxHash = await this.walletClient.writeContract({
      account: this.account, chain: celoMainnet,
      address: DAILYDROP_CELO,
      abi:     DAILYDROP_ABI,
      functionName: "checkIn",
    })
    await this.publicClient.waitForTransactionReceipt({ hash: checkInTxHash })

    const newStreak  = streakData.streak + 1
    const daysLeft   = 7 - (newStreak % 7) || 7
    const message    = newStreak % 7 === 0
      ? `🎉 7-day streak! Call claimDrop() to receive 10 DROP tokens`
      : `${daysLeft} day${daysLeft > 1 ? "s" : ""} until reward`

    return {
      success: true, streak: newStreak,
      feeTxHash, checkInTxHash,
      explorerUrl: `https://celoscan.io/tx/${checkInTxHash}`,
      message,
    }
  }

  /**
   * Claim 10 DROP tokens après 7 jours de streak
   * @example
   * const result = await sdk.claimDrop()
   */
  async claimDrop(): Promise<ClaimRewardResult> {
    const streakData = await this.getStreak()
    if (!streakData.canClaim) {
      throw new Error(`Cannot claim yet. Need ${7 - streakData.streak} more days.`)
    }
    const txHash = await this.walletClient.writeContract({
      account: this.account, chain: celoMainnet,
      address: DAILYDROP_CELO,
      abi:     DAILYDROP_ABI,
      functionName: "claimReward",
    })
    return {
      success: true, txHash, amount: "10 DROP",
      explorerUrl: `https://celoscan.io/tx/${txHash}`,
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async _getExchangeId(tokenAddress: `0x${string}`): Promise<`0x${string}` | null> {
    const BI_POOL_ABI = [{
      name: "getExchanges", type: "function", inputs: [],
      outputs: [{ name: "", type: "tuple[]", components: [
        { name: "exchangeId", type: "bytes32" },
        { name: "assets", type: "address[]" },
      ]}],
      stateMutability: "view",
    }] as const
    try {
      const exchanges = await this.publicClient.readContract({
        address: MENTO_BI_POOL_MANAGER, abi: BI_POOL_ABI, functionName: "getExchanges",
      })
      const celoAddr = TOKENS.CELO.address.toLowerCase()
      const tokenAddr = tokenAddress.toLowerCase()
      for (const ex of exchanges) {
        const assets = ex.assets.map((a: string) => a.toLowerCase())
        if (assets.includes(celoAddr) && assets.includes(tokenAddr)) {
          return ex.exchangeId as `0x${string}`
        }
      }
    } catch {}
    return null
  }
}