/**
 * Exemple 2 : Agent de paiement pour une app e-commerce
 *
 * Intègre CeloBankSDK dans une API Express pour traiter des paiements CELO.
 * Un marchand peut recevoir des paiements et automatiquement
 * les convertir en cUSD stable via Mento V2.
 *
 * Cas d'usage : marché en ligne en Afrique de l'Ouest qui accepte CELO
 * et veut se protéger de la volatilité en convertissant instantanément.
 */

import { CeloBankSDK } from "@celobank/agent-sdk"

const sdk = new CeloBankSDK({ privateKey: process.env.MERCHANT_PRIVATE_KEY! })

interface Order {
  id: string
  amountCELO: string
  buyerAddress: `0x${string}`
}

/**
 * Traite un paiement entrant et swap automatiquement en cUSD
 */
async function processPayment(order: Order) {
  console.log(`🛒 Traitement commande #${order.id}`)

  // 1. Vérifier les prix actuels
  const prices = await sdk.getPrices({ tokens: ["CELO", "cUSD"] })
  const celoPrice = prices.find(p => p.symbol === "CELO")?.priceUsd ?? 0
  const usdValue = parseFloat(order.amountCELO) * celoPrice

  console.log(`💱 ${order.amountCELO} CELO = $${usdValue.toFixed(2)} USD`)

  // 2. Swap CELO → cUSD pour stabiliser
  if (parseFloat(order.amountCELO) > 0) {
    const swap = await sdk.swap({
      amount: order.amountCELO,
      tokenOut: "cUSD",
    })
    console.log(`✅ Swap réussi: ${swap.explorerUrl}`)
  }

  // 3. Vérifier le portefeuille mis à jour
  const portfolio = await sdk.getPortfolio()
  console.log(`💼 Nouveau solde cUSD: ${portfolio.tokens["cUSD"]}`)

  return { orderId: order.id, status: "paid", usdValue }
}

// Simulation d'un paiement entrant
const mockOrder: Order = {
  id: "CMD-001",
  amountCELO: "2.5",
  buyerAddress: "0xDEAc8D2b8F875a9E3cFC13E9d4d9e5e3e3e3e3e3",
}

processPayment(mockOrder).catch(console.error)