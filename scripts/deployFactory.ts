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

const account      = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`)
const walletClient = createWalletClient({ account, chain: celo, transport: http() })
const publicClient = createPublicClient({ chain: celo, transport: http() })

const artifact = JSON.parse(
  readFileSync("artifacts/contracts/TokenFactory.sol/TokenFactory.json", "utf-8")
)

async function main() {
  console.log("🚀 Deploying TokenFactory on Celo Mainnet...")
  console.log(`💳 Wallet: ${account.address}`)

  const balance = await publicClient.getBalance({ address: account.address })
  console.log(`💰 Balance: ${Number(balance) / 1e18} CELO`)

  const hash = await walletClient.deployContract({
    abi:      artifact.abi,
    bytecode: artifact.bytecode,
    args:     [],
  })

  console.log(`📤 TX Hash: ${hash}`)
  console.log("⏳ Waiting for confirmation...")

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`✅ TokenFactory deployed!`)
  console.log(`📍 Address: ${receipt.contractAddress}`)
  console.log(`🔍 CeloScan: https://celoscan.io/address/${receipt.contractAddress}`)
  console.log(`\nAdd to your .env:\nTOKEN_FACTORY_ADDRESS=${receipt.contractAddress}`)
}

main().catch(console.error)
