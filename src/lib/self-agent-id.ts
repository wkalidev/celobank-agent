import { SelfAgent, requestRegistration } from "@selfxyz/agent-sdk"

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
  const network = (process.env.SELF_AGENT_NETWORK ?? "mainnet") as "mainnet" | "testnet"

  if (!privateKey) {
    return { registered: false, network }
  }

  try {
    const agent = new SelfAgent({ privateKey, network })
    const isReg = await agent.isRegistered()
    if (!isReg) return { registered: false, network }

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
  } catch {
    return { registered: false, network }
  }
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
