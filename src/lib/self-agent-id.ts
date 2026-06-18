import { ethers } from "ethers"
import { SelfAgent, requestRegistration, NETWORKS, REGISTRY_ABI } from "@selfxyz/agent-sdk"

export interface SelfAgentStatus {
  registered: boolean
  agentId?: string
  agentAddress?: string
  network: string
  isVerified?: boolean
  proofExpiresAt?: string
}

export async function getSelfAgentStatus(): Promise<SelfAgentStatus> {
  const privateKey = process.env.PRIVATE_KEY
  const linkedAgentAddress = process.env.SELF_AGENT_ADDRESS  // set after linked-mode registration
  const network = (process.env.SELF_AGENT_NETWORK ?? "mainnet") as "mainnet" | "testnet"

  // Primary path: server's own key is the registered agent
  if (privateKey) {
    try {
      const agent = new SelfAgent({ privateKey, network })
      const isReg = await agent.isRegistered()
      if (isReg) {
        const info = await agent.getInfo()
        return {
          registered: true,
          agentId: info.agentId.toString(),
          agentAddress: info.address,
          network,
          isVerified: info.isVerified,
          proofExpiresAt:
            info.proofExpiresAt > 0n
              ? new Date(Number(info.proofExpiresAt) * 1000).toISOString()
              : undefined,
        }
      }
    } catch {}
  }

  // Fallback: linked-mode registration produced a separate agent key.
  // SELF_AGENT_ADDRESS holds that key's Ethereum address; check it directly
  // via the registry without needing its private key.
  if (linkedAgentAddress) {
    try {
      const net = NETWORKS[network]
      const provider = new ethers.JsonRpcProvider(net.rpcUrl)
      const registry = new ethers.Contract(net.registryAddress, REGISTRY_ABI, provider)
      const agentKey = ethers.zeroPadValue(linkedAgentAddress, 32)
      const isVerified: boolean = await registry.isVerifiedAgent(agentKey)
      if (!isVerified) return { registered: false, network }

      const agentId: bigint = await registry.getAgentId(agentKey)
      const proofExpiresAt: bigint = await registry.proofExpiresAt(agentId)
      return {
        registered: true,
        agentId: agentId.toString(),
        agentAddress: linkedAgentAddress,
        network,
        isVerified: true,
        proofExpiresAt:
          proofExpiresAt > 0n
            ? new Date(Number(proofExpiresAt) * 1000).toISOString()
            : undefined,
      }
    } catch {}
  }

  return { registered: false, network }
}

export async function initiateRegistration(humanAddress: string) {
  const network = (process.env.SELF_AGENT_NETWORK ?? "mainnet") as "mainnet" | "testnet"
  return requestRegistration({
    mode: "linked",
    network,
    humanAddress,
    agentName: "CeloBank Agent",
    agentDescription:
      "Non-custodial AI DeFi agent on Celo Mainnet — ERC-8004 registered, 21 tools, 19 languages",
  })
}
