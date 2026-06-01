/**
 * Exemple 1 : Bot d'épargne automatique
 *
 * Ce bot vérifie le solde cUSD d'un wallet toutes les heures.
 * Si le solde dépasse un seuil, il dépose automatiquement le surplus sur Aave.
 *
 * Cas d'usage réel : un commerçant à Lagos qui veut que ses revenus
 * génèrent des intérêts dès qu'il dépasse 50 cUSD.
 */

import { CeloBankSDK } from "@celobank/agent-sdk"

const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })

const THRESHOLD   = 50   // cUSD minimum avant de sauvegarder
const KEEP_BUFFER = 10   // cUSD à garder liquides

async function autoSavingsBot() {
  console.log("🤖 Auto-Savings Bot démarré sur Celo Mainnet")
  console.log(`📍 Wallet: ${sdk.address}`)

  const portfolio = await sdk.getPortfolio()
  const cUSDBalance = parseFloat(portfolio.tokens["cUSD"] ?? "0")

  console.log(`💵 Solde cUSD: ${cUSDBalance}`)

  if (cUSDBalance > THRESHOLD) {
    const toSave = cUSDBalance - KEEP_BUFFER
    console.log(`💰 Dépôt de ${toSave.toFixed(2)} cUSD sur Aave...`)

    const result = await sdk.supplyAave({ amount: toSave.toFixed(2) })
    console.log(`✅ Dépôt réussi ! TX: ${result.explorerUrl}`)

    const position = await sdk.getAavePosition()
    console.log(`📊 Nouveau collateral Aave: $${position.totalCollateralUsd}`)
  } else {
    console.log(`⏳ Solde insuffisant (${cUSDBalance} cUSD < ${THRESHOLD} cUSD). Pas d'action.`)
  }
}

autoSavingsBot().catch(console.error)