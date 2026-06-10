import "dotenv/config"
import { encodeFunctionData, parseEther, formatEther } from "viem"
import { publicClient } from "./prepare.js"
import type { PrepareResult, UnsignedTx } from "./prepare.js"

const FACTORY_ADDRESS = (process.env.TOKEN_FACTORY_ADDRESS ?? "0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e") as `0x${string}`

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const FACTORY_WRITE_ABI = [
  {
    name: "createToken",
    type: "function",
    inputs: [
      { name: "name_",        type: "string"  },
      { name: "symbol_",      type: "string"  },
      { name: "totalSupply_", type: "uint256" },
    ],
    outputs: [{ name: "tokenAddress", type: "address" }],
    stateMutability: "nonpayable",
  },
] as const

const FACTORY_READ_ABI = [
  {
    name: "getAllTokens",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
] as const

const ERC20_META_ABI = [
  { name: "name",        type: "function", inputs: [], outputs: [{ type: "string"  }], stateMutability: "view" },
  { name: "symbol",      type: "function", inputs: [], outputs: [{ type: "string"  }], stateMutability: "view" },
  { name: "totalSupply", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchTokenMeta(address: `0x${string}`) {
  try {
    const [name, symbol, supply] = await Promise.all([
      publicClient.readContract({ address, abi: ERC20_META_ABI, functionName: "name" }),
      publicClient.readContract({ address, abi: ERC20_META_ABI, functionName: "symbol" }),
      publicClient.readContract({ address, abi: ERC20_META_ABI, functionName: "totalSupply" }),
    ])
    return {
      address,
      name:        name as string,
      symbol:      symbol as string,
      totalSupply: formatEther(supply as bigint),
    }
  } catch {
    return { address, name: "Unknown", symbol: "???", totalSupply: "0" }
  }
}

// ─── prepareLaunchToken ───────────────────────────────────────────────────────
export async function prepareLaunchToken(
  userAddress: string,
  name: string,
  symbol: string,
  totalSupply: string
): Promise<PrepareResult> {
  if (!name?.trim())       return { success: false, action: "launch_token", userAddress, transactions: [], summary: "", error: "Token name is required" }
  if (!symbol?.trim())     return { success: false, action: "launch_token", userAddress, transactions: [], summary: "", error: "Token symbol is required" }
  if (symbol.length > 11)  return { success: false, action: "launch_token", userAddress, transactions: [], summary: "", error: "Symbol must be 11 characters or fewer" }
  if (!totalSupply || Number(totalSupply) <= 0) return { success: false, action: "launch_token", userAddress, transactions: [], summary: "", error: "Total supply must be greater than 0" }

  const supplyWei = parseEther(totalSupply)

  const launchTx: UnsignedTx = {
    to:   FACTORY_ADDRESS,
    data: encodeFunctionData({
      abi:          FACTORY_WRITE_ABI,
      functionName: "createToken",
      args:         [name.trim(), symbol.trim().toUpperCase(), supplyWei],
    }),
    chainId:     42220,
    description: `Launch ${name} (${symbol.toUpperCase()}) — ${totalSupply} total supply`,
  }

  return {
    success:      true,
    action:       "launch_token",
    userAddress,
    transactions: [launchTx],
    summary:      `Ready to launch ${name} (${symbol.toUpperCase()}) with ${Number(totalSupply).toLocaleString()} tokens. Sign 1 transaction.`,
  }
}

// ─── getTokens ────────────────────────────────────────────────────────────────
export async function getTokens(): Promise<string> {
  try {
    const addresses = await publicClient.readContract({
      address:      FACTORY_ADDRESS,
      abi:          FACTORY_READ_ABI,
      functionName: "getAllTokens",
    }) as `0x${string}`[]

    if (addresses.length === 0) return "No tokens launched via CeloBank Factory yet."

    const tokens = await Promise.all(addresses.map(fetchTokenMeta))

    const lines = tokens.map((t, i) =>
      `${i + 1}. **${t.name}** (${t.symbol}) — ${Number(t.totalSupply).toLocaleString()} supply\n   📍 ${t.address}`
    )

    return `🏭 **CeloBank Token Factory** — ${tokens.length} token(s) launched:\n\n${lines.join("\n\n")}`
  } catch (e: any) {
    return `❌ Failed to fetch tokens: ${e.message}`
  }
}

// ─── getTrendingTokens ────────────────────────────────────────────────────────
export async function getTrendingTokens(): Promise<string> {
  try {
    const addresses = await publicClient.readContract({
      address:      FACTORY_ADDRESS,
      abi:          FACTORY_READ_ABI,
      functionName: "getAllTokens",
    }) as `0x${string}`[]

    if (addresses.length === 0) return "No tokens launched via CeloBank Factory yet."

    // Most recent 5
    const recent = [...addresses].reverse().slice(0, 5)
    const tokens = await Promise.all(recent.map(fetchTokenMeta))

    const lines = tokens.map((t, i) =>
      `${i + 1}. **${t.name}** (${t.symbol}) — ${Number(t.totalSupply).toLocaleString()} supply\n   📍 ${t.address}`
    )

    return `🔥 **Trending on CeloBank** — 5 most recent launches:\n\n${lines.join("\n\n")}`
  } catch (e: any) {
    return `❌ Failed to fetch trending tokens: ${e.message}`
  }
}

// ─── LangChain-style tool wrappers ────────────────────────────────────────────
export const launchTokenTool = {
  invoke: async (args: { userAddress?: string; name: string; symbol: string; totalSupply: string }) => {
    const result = await prepareLaunchToken(args.userAddress ?? "", args.name, args.symbol, args.totalSupply)
    return JSON.stringify(result)
  },
}

export const getTokensTool = {
  invoke: async (_args: unknown) => getTokens(),
}

export const getTrendingTokensTool = {
  invoke: async (_args: unknown) => getTrendingTokens(),
}
