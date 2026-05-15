import "dotenv/config"
import { createPublicClient, createWalletClient, http, parseEther, formatUnits, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { defineChain } from "viem"
import { tool } from "@langchain/core/tools"
import { z } from "zod"

const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC!] } },
})

const account = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`)
const publicClient = createPublicClient({ chain: celo, transport: http() })
const walletClient = createWalletClient({ account, chain: celo, transport: http() })

const ERC20_ABI = [
  { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "decimals", type: "function", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
] as const

const AAVE_POOL_ABI = [
  { name: "supply", type: "function", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }, { name: "onBehalfOf", type: "address" }, { name: "referralCode", type: "uint16" }], outputs: [], stateMutability: "nonpayable" },
  { name: "borrow", type: "function", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }, { name: "interestRateMode", type: "uint256" }, { name: "referralCode", type: "uint16" }, { name: "onBehalfOf", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { name: "getUserAccountData", type: "function", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "totalCollateralBase", type: "uint256" }, { name: "totalDebtBase", type: "uint256" }, { name: "availableBorrowsBase", type: "uint256" }, { name: "currentLiquidationThreshold", type: "uint256" }, { name: "ltv", type: "uint256" }, { name: "healthFactor", type: "uint256" }], stateMutability: "view" },
] as const

// Adresses Aave V3 sur Celo Mainnet
const AAVE_POOL = "0x3E59A31363E2a8B85aA1603a85FCe16E4A7B78c6" as `0x${string}`
const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`
const UNISWAP_ROUTER = "0x5615CDAb10dc425a742d643d949a7F474C01abc4" as `0x${string}`
const WCELO = "0x471EcE3750Da237f93B8E339c536989b8978a438" as `0x${string}`

export const getAavePositionTool = tool(
  async ({ address }) => {
    try {
      const data = await publicClient.readContract({
        address: AAVE_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "getUserAccountData",
        args: [address as `0x${string}`],
      })
      const [collateral, debt, available, , , healthFactor] = data
      return `Position Aave sur Celo Mainnet:
- Collateral: $${formatUnits(collateral, 8)} USD
- Dette: $${formatUnits(debt, 8)} USD
- Disponible à emprunter: $${formatUnits(available, 8)} USD
- Health Factor: ${formatUnits(healthFactor, 18)}`
    } catch (e) {
      return `Erreur lecture position Aave: ${e}`
    }
  },
  {
    name: "get_aave_position",
    description: "Vérifie la position DeFi d'un utilisateur sur Aave Celo Mainnet (collateral, dette, health factor)",
    schema: z.object({ address: z.string().describe("Adresse wallet 0x...") }),
  }
)

export const saveCUSDTool = tool(
  async ({ amount }) => {
    try {
      const approveHash = await walletClient.writeContract({
        address: CUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [AAVE_POOL, parseUnits(amount, 18)],
      })
      console.log(`  ✅ Approve TX: ${approveHash}`)

      const supplyHash = await walletClient.writeContract({
        address: AAVE_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "supply",
        args: [CUSD_ADDRESS, parseUnits(amount, 18), account.address, 0],
      })
      return `✅ ${amount} cUSD déposés sur Aave Mainnet !
TX: ${supplyHash}
Vous gagnez maintenant des intérêts automatiquement. 💰`
    } catch (e) {
      return `Erreur dépôt Aave: ${e}`
    }
  },
  {
    name: "save_cusd",
    description: "Dépose des cUSD sur Aave Celo Mainnet pour générer des intérêts automatiquement",
    schema: z.object({ amount: z.string().describe("Montant en cUSD à déposer ex: 10") }),
  }
)

export const swapCeloToCUSDTool = tool(
  async ({ amount }) => {
    const SWAP_ABI = [
      { 
        name: "exactInputSingle", 
        type: "function", 
        inputs: [{ 
          name: "params", 
          type: "tuple",
          components: [
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "recipient", type: "address" },
            { name: "amountIn", type: "uint256" },
            { name: "amountOutMinimum", type: "uint256" },
            { name: "sqrtPriceLimitX96", type: "uint160" },
          ]
        }], 
        outputs: [{ name: "amountOut", type: "uint256" }], 
        stateMutability: "payable" 
      },
    ] as const

    try {
      const hash = await walletClient.writeContract({
        address: UNISWAP_ROUTER,
        abi: SWAP_ABI,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: WCELO,
          tokenOut: CUSD_ADDRESS,
          fee: 3000,
          recipient: account.address,
          amountIn: parseEther(amount),
          amountOutMinimum: 0n,
          sqrtPriceLimitX96: 0n,
        }] as const,
        value: parseEther(amount),
      })
      return `✅ Swap réussi ! ${amount} CELO → cUSD sur Mainnet\nTX: https://celoscan.io/tx/${hash}`
    } catch (e) {
      return `Erreur swap: ${e}`
    }
  },
  {
    name: "swap_celo_to_cusd",
    description: "Échange des CELO contre des cUSD stablecoins via Uniswap V3 sur Celo Mainnet",
    schema: z.object({ amount: z.string().describe("Montant CELO à échanger ex: 1") }),
  }
)