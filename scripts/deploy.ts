import { createWalletClient, createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { defineChain } from "viem"
import { readFileSync } from "fs"
import "dotenv/config"

const celo = defineChain({
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
})

const account = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`)
const walletClient = createWalletClient({ account, chain: celo, transport: http() })
const publicClient = createPublicClient({ chain: celo, transport: http() })

// ABI + Bytecode du contrat compilé
const artifact = JSON.parse(readFileSync("artifacts/contracts/CeloBankAgent.sol/CeloBankAgent.json", "utf-8"))

async function main() {
  console.log("🚀 Déploiement CeloBankAgent sur Celo Mainnet...")
  console.log(`💳 Wallet: ${account.address}`)

  const balance = await publicClient.getBalance({ address: account.address })
  console.log(`💰 Balance: ${Number(balance) / 1e18} CELO`)

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [],
  })

  console.log(`📤 TX Hash: ${hash}`)
  console.log("⏳ Attente confirmation...")

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`✅ Contrat déployé !`)
  console.log(`📍 Adresse: ${receipt.contractAddress}`)
  console.log(`🔍 Voir sur CeloScan: https://celoscan.io/address/${receipt.contractAddress}`)
}

main().catch(console.error)
