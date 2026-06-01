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
export class CeloBankSDK {
  private account: PrivateKeyAccount
  private publicClient: PublicClient
  private walletClient: WalletClient
  readonly address: `0x${string}`

  constructor(config: CeloBankConfig) {
    const rawKey = config.privateKey.trim()
    const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`

    const rpcUrl = config.rpcUrl ?? CELO_RPC_DEFAULT
    const chain = config.rpcUrl
      ? defineChain({ ...celoMainnet, rpcUrls: { default: { http: [rpcUrl] } } })
      : celoMainnet

    this.account = privateKeyToAccount(privateKey)
    this.address = this.account.address

    this.publicClient = createPublicClient({ chain, transport: http(rpcUrl) }) as PublicClient
    this.walletClient = createWalletClient({ account: this.account, chain, transport: http(rpcUrl) })
  }

  // ─── Portfolio ─────────────────────────────────────────────────────────────

  /**
   * Récupère les soldes CELO natif + tous les tokens ERC20 d'une adresse
   * @param params.address — adresse cible (défaut: wallet de l'agent)
   */
  async getPortfolio(params: GetPortfolioParams = {}): Promise<BalanceResult> {
    const addr = params.address ?? this.address

    const nativeBalance = await this.publicClient.getBalance({ address: addr })

    const tokenEntries = await Promise.all(
      Object.entries(TOKENS).map(async ([symbol, token]) => {
        try {
          const balance = await this.publicClient.readContract({
            address: token.address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [addr],
          })
          return [symbol, parseFloat(formatUnits(balance, token.decimals)).toFixed(6)]
        } catch {
          return [symbol, "0"]
        }
      })
    )

    return {
      address: addr,
      native: parseFloat(formatEther(nativeBalance)).toFixed(6),
      tokens: Object.fromEntries(tokenEntries),
    }
  }

  // ─── Prix ──────────────────────────────────────────────────────────────────

  /**
   * Récupère les prix en USD depuis CoinGecko avec variation 24h
   * @param params.tokens — liste de symboles (défaut: tous)
   */
  async getPrices(params: GetPricesParams = {}): Promise<PriceResult[]> {
    const requested = params.tokens
      ? params.tokens.map(t => t.toUpperCase()).filter(t => t in TOKENS)
      : Object.keys(TOKENS)

    const ids = requested
      .map(t => TOKENS[t as TokenSymbol].coingeckoId)
      .join(",")

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
    )

    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`)
    const data = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>

    return requested.map(symbol => {
      const id = TOKENS[symbol as TokenSymbol].coingeckoId
      return {
        symbol,
        priceUsd: data[id]?.usd ?? 0,
        change24h: data[id]?.usd_24h_change ?? null,
      }
    })
  }

  // ─── Send ──────────────────────────────────────────────────────────────────

  /**
   * Envoie des CELO natifs à une adresse
   * @param params.to — adresse destinataire
   * @param params.amount — montant en CELO (ex: "1.5")
   */
  async send(params: SendParams): Promise<SendResult> {
    const txHash = await this.walletClient.sendTransaction({
      account: this.account,
      chain: celoMainnet,
      to: params.to,
      value: parseEther(params.amount),
    })

    return {
      success: true,
      to: params.to,
      amount: params.amount,
      txHash,
      explorerUrl: `https://celoscan.io/tx/${txHash}`,
    }
  }

  // ─── Swap Mento V2 ─────────────────────────────────────────────────────────

  /**
   * Swap CELO → stablecoin via Mento V2
   * @param params.amount — montant CELO à échanger
   * @param params.tokenOut — token de sortie: "cUSD" | "cEUR" | "cREAL" | "USDC" | "USDT"
   */
  async swap(params: SwapParams): Promise<SwapResult> {
    const symbol = Object.keys(TOKENS).find(
      k => k.toLowerCase() === params.tokenOut.toLowerCase()
    ) as TokenSymbol | undefined

    if (!symbol) {
      throw new Error(`Token "${params.tokenOut}" non supporté. Disponibles: ${Object.keys(TOKENS).join(", ")}`)
    }

    const exchangeKey = `CELO-${symbol}`
    const exchangeId = MENTO_EXCHANGE_IDS[exchangeKey]
    if (!exchangeId) {
      throw new Error(`Swap CELO→${symbol} non disponible via Mento V2`)
    }

    const parsed = parseEther(params.amount)
    const tokenOut = TOKENS[symbol]

    // 1. Approve
    await this.walletClient.writeContract({
      account: this.account,
      chain: celoMainnet,
      address: TOKENS.CELO.address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [MENTO_BROKER, parsed],
    })

    // 2. Swap
    const txHash = await this.walletClient.writeContract({
      account: this.account,
      chain: celoMainnet,
      address: MENTO_BROKER,
      abi: BROKER_ABI,
      functionName: "swapIn",
      args: [MENTO_BI_POOL_MANAGER, exchangeId, TOKENS.CELO.address, tokenOut.address, parsed, 0n],
    })

    return {
      success: true,
      amountIn: params.amount,
      tokenOut: symbol,
      txHash,
      explorerUrl: `https://celoscan.io/tx/${txHash}`,
    }
  }

  // ─── Aave ──────────────────────────────────────────────────────────────────

  /**
   * Retourne la position DeFi complète d'une adresse sur Aave V3
   * @param params.address — adresse cible (défaut: wallet de l'agent)
   */
  async getAavePosition(params: GetAavePositionParams = {}): Promise<AavePosition> {
    const addr = params.address ?? this.address

    const data = await this.publicClient.readContract({
      address: AAVE_POOL,
      abi: AAVE_POOL_ABI,
      functionName: "getUserAccountData",
      args: [addr],
    }) as [bigint, bigint, bigint, bigint, bigint, bigint]

    const [collateral, debt, available, , , healthFactor] = data

    return {
      address: addr,
      totalCollateralUsd: formatUnits(collateral, 8),
      totalDebtUsd: formatUnits(debt, 8),
      availableBorrowsUsd: formatUnits(available, 8),
      healthFactor: formatUnits(healthFactor, 18),
    }
  }

  /**
   * Dépose un asset sur Aave V3 pour générer des intérêts automatiquement
   * @param params.amount — montant à déposer
   * @param params.asset — token à déposer (défaut: "cUSD")
   */
  async supplyAave(params: SupplyAaveParams): Promise<AaveSupplyResult> {
    const assetSymbol = (params.asset ?? "cUSD").toUpperCase() as TokenSymbol
    const token = TOKENS[assetSymbol]

    if (!token) {
      throw new Error(`Asset "${assetSymbol}" non supporté pour Aave`)
    }

    const parsed = parseUnits(params.amount, token.decimals)

    // 1. Approve
    await this.walletClient.writeContract({
      account: this.account,
      chain: celoMainnet,
      address: token.address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [AAVE_POOL, parsed],
    })

    // 2. Supply
    const txHash = await this.walletClient.writeContract({
      account: this.account,
      chain: celoMainnet,
      address: AAVE_POOL,
      abi: AAVE_POOL_ABI,
      functionName: "supply",
      args: [token.address, parsed, this.address, 0],
    })

    return {
      success: true,
      asset: assetSymbol,
      amount: params.amount,
      txHash,
      explorerUrl: `https://celoscan.io/tx/${txHash}`,
    }
  }
}