import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { defineChain } from "viem"
import { tool } from "@langchain/core/tools"
import { z } from "zod"
import "dotenv/config"

const celoSepolia = defineChain({
  id: 44787,
  name: "Celo Sepolia Testnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.CELO_RPC!] } },
})

const account = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`)

const publicClient = createPublicClient({ chain: celoSepolia, transport: http() })
const walletClient = createWalletClient({ account, chain: celoSepolia, transport: http() })

export const getBalanceTool = tool(
  async ({ address }) => {
    const balance = await publicClient.getBalance({ address: address as `0x${string}` })
    return `Solde : ${formatEther(balance)} CELO`
  },
  {
    name: "get_balance",
    description: "Vérifie le solde CELO d'une adresse wallet",
    schema: z.object({ address: z.string().describe("Adresse wallet 0x...") }),
  }
)

export const sendCeloTool = tool(
  async ({ to, amount }) => {
    const hash = await walletClient.sendTransaction({
      to: to as `0x${string}`,
      value: parseEther(amount),
    })
    return `✅ Envoi réussi ! TX hash : ${hash}`
  },
  {
    name: "send_celo",
    description: "Envoie des CELO à une adresse.",
    schema: z.object({
      to: z.string().describe("Adresse destinataire"),
      amount: z.string().describe("Montant en CELO ex: 0.5"),
    }),
  }
)

export const getCeloPriceTool = tool(
  async () => {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd")
    const data = await res.json()
    return `Prix CELO : $${data.celo.usd} USD`
  },
  {
    name: "get_celo_price",
    description: "Retourne le prix actuel du CELO en dollars USD",
    schema: z.object({}),
  }
)