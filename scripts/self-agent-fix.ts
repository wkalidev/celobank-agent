/**
 * Self Agent ID — Option A fix.
 *
 * 1. Calls selfDeregister(103) and selfDeregister(170) directly on-chain
 *    using PRIVATE_KEY (the NFT owner for those two agents).
 * 2. Verifies the on-chain count dropped below 10.
 * 3. Starts a fresh registration session and shows the Self app deep link.
 * 4. Polls the registry on-chain (not the Self API) for completion.
 *
 * Run: npx tsx scripts/self-agent-fix.ts
 */

import "dotenv/config"
import { ethers } from "ethers"
import { requestRegistration } from "@selfxyz/agent-sdk"
import { privateKeyToAccount } from "viem/accounts"
import { createWalletClient, createPublicClient, http, parseAbi } from "viem"
import { celo } from "viem/chains"

// ── config ────────────────────────────────────────────────────────────────────

const NETWORK = (process.env.SELF_AGENT_NETWORK ?? "mainnet") as "mainnet" | "testnet"
const RPC = NETWORK === "mainnet" ? "https://forno.celo.org" : "https://forno.celo-sepolia.celo-testnet.org"
const REGISTRY = (NETWORK === "mainnet"
  ? "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944"
  : "0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379") as `0x${string}`

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`
if (!PRIVATE_KEY) { console.error("PRIVATE_KEY not set"); process.exit(1) }

const ownerAddress: string =
  process.env.SELF_AGENT_OWNER_ADDRESS ||
  privateKeyToAccount(PRIVATE_KEY).address

// ABI slices needed
const REGISTRY_ABI = parseAbi([
  "function selfDeregister(uint256 agentId) nonpayable",
  "function getAgentCountForHuman(uint256 nullifier) view returns (uint256)",
  "function isVerifiedAgent(bytes32 agentPubKey) view returns (bool)",
  "function getAgentId(bytes32 agentPubKey) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
])

// The nullifier from the TooManyAgentsForHuman revert error
const NULLIFIER = 11873231818017508628164674585423510599014415015256915122792943500935920922194n

const sep = () => console.log("─".repeat(64))

// ── helpers ───────────────────────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\nSelf Agent ID — Option A: selfDeregister + re-register")
  sep()
  console.log(`Network  : ${NETWORK}`)
  console.log(`Registry : ${REGISTRY}`)
  console.log(`Owner    : ${ownerAddress}`)
  sep()

  const account = privateKeyToAccount(PRIVATE_KEY)
  if (account.address.toLowerCase() !== ownerAddress.toLowerCase()) {
    console.error(
      `PRIVATE_KEY derives to ${account.address} but owner is ${ownerAddress}.\n` +
      "selfDeregister requires msg.sender == ownerOf(agentId). " +
      "Set PRIVATE_KEY to the owner wallet's private key."
    )
    process.exit(1)
  }

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(RPC),
  })
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(RPC),
  })

  // ── Step 1: confirm starting count ──────────────────────────────────────────
  const countBefore = await publicClient.readContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getAgentCountForHuman",
    args: [NULLIFIER],
  })
  console.log(`\nOn-chain agent count before: ${countBefore}`)

  // ── Step 2: selfDeregister(103) ──────────────────────────────────────────────
  for (const agentId of [103n, 170n]) {
    console.log(`\nCalling selfDeregister(${agentId})...`)
    const nftOwner = await publicClient.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "ownerOf",
      args: [agentId],
    })
    if (nftOwner.toLowerCase() !== account.address.toLowerCase()) {
      console.warn(`  ownerOf(${agentId}) = ${nftOwner} — not the signer. Skipping.`)
      continue
    }

    const txHash = await walletClient.writeContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "selfDeregister",
      args: [agentId],
    })
    console.log(`  TX submitted: ${txHash}`)
    console.log("  Waiting for receipt...")

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    if (receipt.status === "success") {
      console.log(`  Agent #${agentId} deregistered. Block: ${receipt.blockNumber}`)
    } else {
      console.error(`  Transaction reverted for agent #${agentId}. Hash: ${txHash}`)
    }
  }

  // ── Step 3: verify count dropped ─────────────────────────────────────────────
  const countAfter = await publicClient.readContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getAgentCountForHuman",
    args: [NULLIFIER],
  })
  console.log(`\nOn-chain agent count after: ${countAfter}`)
  if (countAfter >= 10n) {
    console.error("Count is still at the cap — selfDeregister did not work as expected.")
    process.exit(1)
  }

  // ── Step 4: start registration session ───────────────────────────────────────
  sep()
  console.log("\nStarting fresh registration for CeloBank Agent...")
  let regSession: Awaited<ReturnType<typeof requestRegistration>>
  try {
    regSession = await requestRegistration({
      mode: "linked",
      network: NETWORK,
      humanAddress: ownerAddress,
      agentName: "CeloBank Agent",
      agentDescription:
        "Non-custodial AI DeFi agent on Celo Mainnet — ERC-8004 registered, 21 tools, 19 languages",
    })
  } catch (e) {
    console.error("Registration session failed:", e instanceof Error ? e.message : String(e))
    process.exit(1)
  }

  const agentAddress = regSession.agentAddress
  console.log(`\n  New agent address : ${agentAddress}`)
  console.log(`  Session expires   : ${regSession.expiresAt ?? "unknown"}`)
  console.log("\n  Open this link in the Self app to complete registration:")
  console.log(`\n    ${regSession.deepLink}\n`)

  // ── Step 5: poll on-chain for registration (bypass broken Self API polling) ──
  sep()
  console.log("\nPolling registry on-chain for confirmation (up to 30 min)...")
  console.log("Scan the QR code above in the Self app to trigger the on-chain proof.\n")

  if (!agentAddress) {
    console.warn("No agent address in session — cannot poll. Check /api/self-agent-status manually after scanning.")
    return
  }

  const agentKey = ethers.zeroPadValue(agentAddress, 32) as `0x${string}`
  const deadline = Date.now() + 30 * 60 * 1000
  let dots = 0

  while (Date.now() < deadline) {
    await sleep(10_000)
    process.stdout.write(`\r  Checking${".".repeat((dots++ % 3) + 1)}   `)

    const isVerified = await publicClient.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "isVerifiedAgent",
      args: [agentKey as `0x${string}`],
    }).catch(() => false)

    if (isVerified) {
      const agentId = await publicClient.readContract({
        address: REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "getAgentId",
        args: [agentKey as `0x${string}`],
      }).catch(() => 0n)

      console.log(`\n`)
      sep()
      console.log("\nCeloBank Agent registered and verified on-chain!")
      console.log(`  Agent ID      : ${agentId}`)
      console.log(`  Agent address : ${agentAddress}`)
      console.log(`  Agent key     : ${agentKey}`)
      console.log()
      return
    }
  }

  console.log("\n\nTimed out after 30 minutes.")
  console.log("If you scanned the QR code, check /api/self-agent-status in a few minutes.")
  console.log(`Agent address to monitor: ${agentAddress}`)
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
