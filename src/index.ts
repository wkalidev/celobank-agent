import { runAgent } from "./agent/agent.js"

async function main() {
  console.log("🤖 CeloBank Agent démarré\n")

  const tests = [
    "Quel est le prix du CELO en ce moment ?",
    "Vérifie le solde de l'adresse 0xDEAcDe6eC27Fd0cD972c1232C4f0d4171dda2357",
    "Envoie 0.001 CELO à l'adresse 0xDEAcDe6eC27Fd0cD972c1232C4f0d4171dda2357",
  ]

  for (const question of tests) {
    console.log(`👤 User: ${question}`)
    const response = await runAgent(question)
    console.log(`🤖 Agent: ${response}\n`)
  }
}

main().catch(console.error)