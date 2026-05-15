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

const CONTRACT_ADDRESS = "0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1" as `0x${string}`
const artifact = JSON.parse(readFileSync("artifacts/contracts/CeloBankAgent.sol/CeloBankAgent.json", "utf-8"))

async function main() {
  console.log("🤖 Enregistrement de CeloBank Agent...")

  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "registerAgent",
    args: [
      "CeloBank Agent",
      "Autonomous AI bank for the 1.4 billion unbanked. Send money, check balances, earn DeFi yield on Celo.",
      "https://celobank-agent.railway.app",
      ["get_balance", "send_celo", "get_celo_price", "save_cusd", "swap_celo_to_cusd", "get_aave_position"],
    ],
  })

  console.log(`📤 TX Hash: ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`✅ Agent enregistré ! Block: ${receipt.blockNumber}`)
  console.log(`🔍 https://celoscan.io/tx/${hash}`)
}

main().catch(console.error)
