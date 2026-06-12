/**
 * Full audit of all ERC-8004 tokens owned by the agent wallet.
 * Prints tokenId, active status, getAgent fields, capabilities, and raw tokenURI.
 * Run: npx tsx scripts/audit-8004.ts
 */
import "dotenv/config"
import { createPublicClient, http } from "viem"
import { celo } from "viem/chains"
import { readFileSync } from "fs"

const CONTRACT = "0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1" as `0x${string}`
const AGENT    = "0xDEAcDe6eC27Fd0cD972c1232C4f0d4171dda2357" as `0x${string}`
const artifact = JSON.parse(readFileSync("artifacts/contracts/CeloBankAgent.sol/CeloBankAgent.json", "utf-8"))

const client = createPublicClient({ chain: celo, transport: http() })

async function main() {
  // ── How many tokens exist? ─────────────────────────────────────────────────
  const counter = await client.readContract({
    address: CONTRACT, abi: artifact.abi, functionName: "tokenIdCounter",
  }) as bigint
  console.log(`\n⬡ ERC-8004 Contract: ${CONTRACT}`)
  console.log(`⬡ Agent wallet:      ${AGENT}`)
  console.log(`⬡ Total tokens minted: ${counter}\n`)

  // ── agentByAddress: which tokenId is "active" for our wallet? ─────────────
  const activeId = await client.readContract({
    address: CONTRACT, abi: artifact.abi, functionName: "agentByAddress", args: [AGENT],
  }) as bigint
  console.log(`agentByAddress(${AGENT}) = tokenId ${activeId}\n`)
  console.log("─".repeat(70))

  // ── Scan ALL tokens ────────────────────────────────────────────────────────
  for (let id = 1n; id <= counter; id++) {
    // Who owns this token?
    let owner: string
    try {
      owner = await client.readContract({
        address: CONTRACT, abi: artifact.abi, functionName: "ownerOf", args: [id],
      }) as string
    } catch {
      console.log(`\nToken #${id}: burned / non-existent`)
      continue
    }

    if (owner.toLowerCase() !== AGENT.toLowerCase()) {
      console.log(`\nToken #${id}: owned by ${owner} (not our wallet, skipping)`)
      continue
    }

    // Read agent metadata
    const agent = await client.readContract({
      address: CONTRACT, abi: artifact.abi, functionName: "getAgent", args: [id],
    }) as { name: string; description: string; endpoint: string; registeredAt: bigint; active: boolean }

    const caps = await client.readContract({
      address: CONTRACT, abi: artifact.abi, functionName: "getCapabilities", args: [id],
    }) as string[]

    // Read raw tokenURI
    let tokenURI = "(error reading tokenURI)"
    try {
      tokenURI = await client.readContract({
        address: CONTRACT, abi: artifact.abi, functionName: "tokenURI", args: [id],
      }) as string
    } catch (e: any) {
      tokenURI = `ERROR: ${e.message?.slice(0, 120)}`
    }

    // Decode base64 tokenURI if applicable
    let decodedMeta = ""
    if (tokenURI.startsWith("data:application/json;base64,")) {
      try {
        decodedMeta = Buffer.from(tokenURI.slice("data:application/json;base64,".length), "base64").toString("utf-8")
      } catch {}
    } else if (tokenURI.startsWith("data:application/json,")) {
      decodedMeta = decodeURIComponent(tokenURI.slice("data:application/json,".length))
    }

    console.log(`\n╔══ Token #${id} ${id === activeId ? "← agentByAddress (ACTIVE POINTER)" : ""} ══`)
    console.log(`║  Owner:       ${owner}`)
    console.log(`║  Active:      ${agent.active}`)
    console.log(`║  Name:        ${agent.name}`)
    console.log(`║  Description: ${agent.description.slice(0, 100)}`)
    console.log(`║  Endpoint:    ${agent.endpoint}`)
    console.log(`║  Registered:  ${new Date(Number(agent.registeredAt) * 1000).toISOString()}`)
    console.log(`║  Tools (${caps.length}):  ${caps.join(", ")}`)
    console.log(`║  tokenURI:    ${tokenURI.slice(0, 120)}${tokenURI.length > 120 ? "..." : ""}`)
    if (decodedMeta) {
      try {
        const parsed = JSON.parse(decodedMeta)
        console.log(`║  Decoded JSON (pretty):`)
        console.log(JSON.stringify(parsed, null, 2).split("\n").map(l => `║    ${l}`).join("\n"))
      } catch {
        console.log(`║  Decoded (raw): ${decodedMeta.slice(0, 300)}`)
      }
    }
    console.log("╚" + "═".repeat(60))
  }

  // ── MCP endpoint health check ──────────────────────────────────────────────
  console.log("\n── MCP endpoint check ─────────────────────────────────────────")
  try {
    const res = await fetch("https://celobank-agent-production.up.railway.app/mcp")
    const ct  = res.headers.get("content-type") ?? ""
    const body = await res.text()
    console.log(`GET /mcp → ${res.status} ${res.statusText}`)
    console.log(`Content-Type: ${ct}`)
    console.log(`Body (first 400 chars): ${body.slice(0, 400)}`)
    if (ct.includes("json")) {
      console.log("✅ Returns JSON")
    } else {
      console.log("⚠️  Does NOT return JSON — returns HTML or other content type")
    }
  } catch (e: any) {
    console.log(`❌ Fetch failed: ${e.message}`)
  }
}

main().catch(e => { console.error("❌ Audit failed:", e); process.exit(1) })
