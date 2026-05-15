import "dotenv/config"
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatUnits,
  parseUnits,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { defineChain } from "viem"
import { tool } from "@langchain/core/tools"
import { z } from "zod"

// ─── Chain ────────────────────────────────────────────────────────────────────
const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC ?? "https://forno.celo.org"] } },
})

const account      = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`)
const publicClient = createPublicClient({ chain: celo, transport: http() })
const walletClient = createWalletClient({ account, chain: celo, transport: http() })

// ─── Addresses (toutes déclarées ici, une seule fois) ─────────────────────────
const AAVE_POOL      = "0x3E59A31363E2a8B85aA1603a85FCe16E4A7B78c6" as `0x${string}`
const CUSD_ADDRESS   = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`
const MENTO_EXCHANGE = "0x67316300f17f063085Ca8bCa4bd3f7a5a3C66275" as `0x${string}`
const CELO_TOKEN     = "0x471EcE3750Da237f93B8E339c536989b8978a438" as `0x${string}`

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const

const AAVE_POOL_ABI = [
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
  {
    name: "getUserAccountData",
    type: "function",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase",         type: "uint256" },
      { name: "totalDebtBase",               type: "uint256" },
      { name: "availableBorrowsBase",        type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv",                         type: "uint256" },
      { name: "healthFactor",                type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const

const MENTO_ABI = [
  {
    name: "sell",
    type: "function",
    inputs: [
      { name: "sellAmount",   type: "uint256" },
      { name: "minBuyAmount", type: "uint256" },
      { name: "sellCelo",     type: "bool"    },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const

// ─── Tool 1 : Position Aave ───────────────────────────────────────────────────
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
      return [
        "📊 Position Aave sur Celo Mainnet :",
        `• Collateral    : $${formatUnits(collateral, 8)} USD`,
        `• Dette         : $${formatUnits(debt, 8)} USD`,
        `• Disponible    : $${formatUnits(available, 8)} USD`,
        `• Health Factor : ${formatUnits(healthFactor, 18)}`,
      ].join("\n")
    } catch (e) {
      return `Erreur lecture position Aave : ${e}`
    }
  },
  {
    name: "get_aave_position",
    description:
      "Vérifie la position DeFi d'un utilisateur sur Aave Celo Mainnet (collateral, dette, health factor)",
    schema: z.object({
      address: z.string().describe("Adresse wallet 0x..."),
    }),
  }
)

// ─── Tool 2 : Épargne cUSD sur Aave ──────────────────────────────────────────
export const saveCUSDTool = tool(
  async ({ amount }) => {
    try {
      const parsed = parseUnits(amount, 18)

      const approveHash = await walletClient.writeContract({
        address: CUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [AAVE_POOL, parsed],
      })
      console.log(`  ✅ Approve TX : ${approveHash}`)

      const supplyHash = await walletClient.writeContract({
        address: AAVE_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "supply",
        args: [CUSD_ADDRESS, parsed, account.address, 0],
      })

      return [
        `✅ ${amount} cUSD déposés sur Aave Mainnet !`,
        `TX : https://celoscan.io/tx/${supplyHash}`,
        "Vous gagnez maintenant des intérêts automatiquement. 💰",
      ].join("\n")
    } catch (e) {
      return `Erreur dépôt Aave : ${e}`
    }
  },
  {
    name: "save_cusd",
    description:
      "Dépose des cUSD sur Aave Celo Mainnet pour générer des intérêts automatiquement",
    schema: z.object({
      amount: z.string().describe("Montant en cUSD à déposer, ex : 10"),
    }),
  }
)

export const swapCeloToCUSDTool = tool(
  async ({ amount }) => {
    // Mento V2 — Broker officiel Celo Mainnet
    const BROKER         = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as `0x${string}`
    const BI_POOL_MANAGER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as `0x${string}`
    // Exchange ID CELO/cUSD (fixe sur Mainnet)
    const EXCHANGE_ID    = "0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c" as `0x${string}`

    const BROKER_ABI = [{
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
    }] as const

    try {
      const parsed = parseEther(amount)

      // 1. Approve Broker pour dépenser les CELO
      const approveHash = await walletClient.writeContract({
        address: CELO_TOKEN,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BROKER, parsed],
      })
      console.log(`  ✅ Approve TX : ${approveHash}`)

      // 2. Swap CELO → cUSD via Mento V2 Broker
      const hash = await walletClient.writeContract({
        address: BROKER,
        abi: BROKER_ABI,
        functionName: "swapIn",
        args: [BI_POOL_MANAGER, EXCHANGE_ID, CELO_TOKEN, CUSD_ADDRESS, parsed, 0n],
      })

      return [
        `✅ Swap réussi ! ${amount} CELO → cUSD via Mento V2`,
        `TX : https://celoscan.io/tx/${hash}`,
      ].join("\n")
    } catch (e) {
      return `Erreur swap Mento V2 : ${e}`
    }
  },
  {
    name: "swap_celo_to_cusd",
    description: "Échange des CELO contre des cUSD via Mento V2 Broker (protocole officiel Celo Mainnet)",
    schema: z.object({
      amount: z.string().describe("Montant CELO à échanger, ex : 1"),
    }),
  }
)