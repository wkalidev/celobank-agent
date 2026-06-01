/**
 * Exemple 3 : Agent de remittance internationale
 *
 * Remplace Western Union pour les envois d'argent diaspora → famille.
 * Fatou à Paris envoie à sa mère au Sénégal :
 *   - Fatou achète CELO avec ses euros
 *   - Le SDK envoie les CELO directement au wallet de la mère
 *   - La mère peut swap CELO → cUSD pour stabiliser
 *
 * Coût: ~$0.001 de frais vs 10-15% Western Union
 *
 * N'importe quelle app de remittance peut importer ce SDK
 * et avoir accès à l'infrastructure Celo sans repartir de zéro.
 */

import { CeloBankSDK } from "@celobank/agent-sdk"

interface RemittanceRequest {
  senderKey: string
  recipientAddress: `0x${string}`
  amountCELO: string
  autoConvertToStable?: boolean  // convertir en cUSD à l'arrivée ?
}

async function sendRemittance(request: RemittanceRequest) {
  const senderSDK    = new CeloBankSDK({ privateKey: request.senderKey })
  const recipientSDK = new CeloBankSDK({ privateKey: request.senderKey }) // lecture seule côté destinataire

  // 1. Vérifier les soldes
  const [prices, senderPortfolio] = await Promise.all([
    senderSDK.getPrices({ tokens: ["CELO"] }),
    senderSDK.getPortfolio(),
  ])

  const celoPrice  = prices[0].priceUsd
  const senderCelo = parseFloat(senderPortfolio.native)
  const amountNum  = parseFloat(request.amountCELO)

  console.log(`📤 Envoi: ${request.amountCELO} CELO (~$${(amountNum * celoPrice).toFixed(2)} USD)`)
  console.log(`📍 De: ${senderSDK.address}`)
  console.log(`📍 À:  ${request.recipientAddress}`)

  if (senderCelo < amountNum) {
    throw new Error(`Solde insuffisant: ${senderCelo} CELO disponible, ${amountNum} CELO requis`)
  }

  // 2. Envoyer les CELO
  const sendResult = await senderSDK.send({
    to: request.recipientAddress,
    amount: request.amountCELO,
  })

  console.log(`✅ Envoi confirmé ! TX: ${sendResult.explorerUrl}`)
  console.log(`⚡ Temps de confirmation: ~5 secondes | Frais: ~$0.001`)
  console.log(`💸 Économies vs Western Union: ~$${(amountNum * celoPrice * 0.12).toFixed(2)}`)

  return {
    success: true,
    txHash: sendResult.txHash,
    explorerUrl: sendResult.explorerUrl,
    feeSaved: `~$${(amountNum * celoPrice * 0.12).toFixed(2)}`,
  }
}

// Simulation
sendRemittance({
  senderKey: process.env.SENDER_PRIVATE_KEY!,
  recipientAddress: "0xMereAuSenegal000000000000000000000000000" as `0x${string}`,
  amountCELO: "50",
  autoConvertToStable: true,
}).catch(console.error)