import { createPublicClient, http, formatUnits } from "viem"
import { celo } from "viem/chains"

const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") })

const G_DOLLAR = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as `0x${string}`
const USER     = "0x995aC10d5B6778B90eF060b7ab585D854C1Ed914" as `0x${string}`

const ERC20_ABI = [
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "decimals",  type: "function", inputs: [], outputs: [{ name: "", type: "uint8"  }], stateMutability: "view" },
  { name: "symbol",    type: "function", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
] as const

async function main() {
  const [raw, decimals, symbol] = await Promise.all([
    client.readContract({ address: G_DOLLAR, abi: ERC20_ABI, functionName: "balanceOf", args: [USER] }),
    client.readContract({ address: G_DOLLAR, abi: ERC20_ABI, functionName: "decimals" }),
    client.readContract({ address: G_DOLLAR, abi: ERC20_ABI, functionName: "symbol" }),
  ])

  console.log(`Token:          ${symbol} @ ${G_DOLLAR}`)
  console.log(`User:           ${USER}`)
  console.log(`Raw balance:    ${raw.toString()}`)
  console.log(`Decimals:       ${decimals}`)
  console.log(`Formatted (actual decimals): ${formatUnits(raw, decimals)} ${symbol}`)
  console.log(`Formatted (18): ${formatUnits(raw, 18)} ${symbol}  ← what the tool currently uses`)
}

main().catch(console.error)
