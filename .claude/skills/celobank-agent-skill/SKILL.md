---
name: celobank-agent-skill
description: Agent IA bancaire autonome et non-custodial pour les non-bancarisés, opérant sur Celo Mainnet avec une identité vérifiable on-chain via ERC-8004 (portefeuille, prix, envoi, swap, épargne Aave en langage naturel).
homepage: https://github.com/wkalidev/celobank-agent
license: MIT
metadata:
  author: wkalidev
  version: 1.0.0
---

# CeloBank Agent

CeloBank Agent est un agent bancaire IA qui permet à quiconque de gérer des actifs
crypto sur **Celo Mainnet** (chain ID `42220`) en langage naturel, sans jamais confier
ses fonds ni sa clé privée à l'agent. Il cible en particulier les **1,4 milliard de
personnes non-bancarisées**, avec un chat disponible en **19 langues** (anglais,
français par défaut, espagnol, portugais, swahili, arabe, italien, chinois, hindi,
bengali, yoruba, haoussa, amharique, indonésien, allemand, russe, turc, vietnamien,
tagalog).

## Identité vérifiable on-chain (ERC-8004)

L'agent a une identité enregistrée et vérifiable sur Celo Mainnet via un contrat
**ERC-8004** :

```
0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1
```

Ce contrat est vérifié "Exact Match" sur Celoscan. N'importe qui peut consulter
cette identité directement sur [Celoscan](https://celoscan.io/address/0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1#code)
pour confirmer que l'agent avec lequel il/elle interagit est bien l'instance
officielle de CeloBank Agent.

## Capabilities (src/tools/)

### `src/tools/celo.ts`

| Tool | Nom exposé | Description |
|------|-----------|--------------|
| `getCeloPriceTool` | `get_celo_price` | Prix temps réel des tokens Celo (alias de `getMultiPriceTool`, via CoinGecko) |
| `getMultiPriceTool` | `get_multi_price` | Prix USD + variation 24h pour plusieurs tokens en une requête |
| `getBalanceTool` | `get_balance` | Solde CELO natif d'une adresse (lecture seule, valeur unique) |
| `getPortfolioTool` | `get_portfolio` | Portefeuille complet : CELO + tous les tokens ERC20 enregistrés (cUSD, cEUR, cREAL, USDC, USDT, stCELO, G$) |
| `sendCeloTool` | `send_celo` | Prépare une transaction **non signée** pour envoyer CELO ou tout token enregistré — c'est le wallet de l'utilisateur connecté qui signe |

### `src/tools/defi.ts`

| Tool | Nom exposé | Description |
|------|-----------|--------------|
| `getAavePositionTool` | `get_aave_position` | Lit la position Aave V3 d'une adresse : collatéral, dette, facteur de santé |
| `saveCUSDTool` | `save_cusd` | Prépare une transaction non signée pour déposer cUSD ou USDC sur Aave V3 (yield) |
| `swapCeloTool` | `swap_celo` | Prépare un swap CELO → cUSD/cEUR/cREAL via Mento V2 (transaction non signée) |
| `swapTokensTool` | `swap_tokens` | Swap universel entre n'importe quelle paire de tokens Celo (Mento V2 pour CELO↔stablecoins, Uniswap V3 sinon) |

`defi.ts` ré-exporte aussi `getPortfolioTool` et `getMultiPriceTool` depuis
`celo.ts` (implémentation canonique, pas de duplication).

## Setup

```bash
git clone https://github.com/wkalidev/celobank-agent.git
cd celobank-agent
npm install
cp .env.example .env
# Éditer .env avec vos propres clés
npm run dev
# UI sur http://localhost:5173, API sur le port du serveur Express
```

### Variables d'environnement (`.env`)

| Variable | Rôle |
|----------|------|
| `PRIVATE_KEY` | Wallet de l'agent — **lecture seule** en v2 (fallback pour les lectures, jamais utilisé pour signer une transaction utilisateur) |
| `CELO_RPC` | Endpoint RPC Celo Mainnet (défaut : `https://forno.celo.org`) |
| `ANTHROPIC_API_KEY` | Clé Claude (LLM principal de l'agent) |
| `GROQ_API_KEY` | Clé Groq (fallback LLM si `ANTHROPIC_API_KEY` absent) |
| `CONTRACT_ADDRESS` | Adresse du contrat d'identité ERC-8004 (`0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1`) |
| `TOKEN_FACTORY_ADDRESS` | Contrat TokenFactory pour le déploiement de tokens ERC20 |

## Research Workflow

| Besoin | Tool à utiliser |
|--------|------------------|
| Connaître le prix d'un ou plusieurs tokens | `get_celo_price` / `get_multi_price` |
| Vérifier le solde CELO natif d'une adresse | `get_balance` |
| Voir le portefeuille complet (tous les tokens) | `get_portfolio` |
| Envoyer des fonds à quelqu'un | `send_celo` |
| Vérifier une position de prêt/emprunt Aave | `get_aave_position` |
| Faire fructifier des cUSD/USDC (épargne) | `save_cusd` |
| Échanger CELO contre une stablecoin | `swap_celo` |
| Échanger n'importe quelle paire de tokens Celo | `swap_tokens` |

## Important Rules

- **Non-custodial** : l'agent ne détient jamais les fonds de l'utilisateur. Toute
  action d'écriture (`send_celo`, `save_cusd`, `swap_celo`, `swap_tokens`, etc.)
  retourne une transaction **non signée** que le wallet de l'utilisateur connecté
  (MiniPay, RainbowKit, MetaMask...) doit signer lui-même. Le wallet de l'agent
  (`PRIVATE_KEY`) n'est utilisé que pour des appels RPC en lecture seule.
- **Identité vérifiable** : chaque interaction peut être rattachée à l'identité
  ERC-8004 de l'agent sur Celo Mainnet — vérifiable indépendamment sur Celoscan,
  sans faire confiance à une déclaration de l'agent.
- **Frais sub-cent** : les frais de gas sur Celo sont généralement inférieurs à
  0,001 $, ce qui rend l'agent adapté aux micro-transactions pour des utilisateurs
  à faibles revenus.
- **Détection de langue** : l'agent détecte la langue du premier message de
  l'utilisateur et y répond dans la même langue pendant toute la conversation,
  sauf demande explicite de changement.
- **Avant toute transaction préparée**, l'agent doit expliquer en langage clair ce
  que fait la transaction, le résultat attendu (montants, APY...) et les risques
  pertinents (slippage, frais, risque de smart contract, liquidation) avant de la
  soumettre à la signature de l'utilisateur.
