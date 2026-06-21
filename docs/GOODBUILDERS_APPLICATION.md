# GoodBuilders Season 4 Application — CeloBank Agent

**Project**: CeloBank Agent
**Applicant**: wkalidev (Farcaster: @willywarrior)
**Date**: June 2026

---

## 1. PROJECT SUMMARY

CeloBank Agent is a live, non-custodial AI banking assistant on Celo Mainnet that lets anyone send, swap, stake, and earn in 19 languages — no bank account, no seed-phrase tutorial, no English required. It is fully integrated with GoodDollar's EngagementRewards contract, earning G$ rewards for every verified human onboarded through the platform. The agent runs 21 on-chain tools, is registered on-chain as ERC-8004 agent #9225, and is deployed as a Farcaster Mini App reaching users wherever they already are.

---

## 2. PROBLEM — Who Are the Unbanked on Celo?

1.4 billion adults globally lack a bank account (World Bank Global Findex 2021). The populations most concentrated in this group — Sub-Saharan Africa, South Asia, Latin America, Southeast Asia — overlap precisely with Celo's intended user base and GoodDollar's UBI recipients.

These users are not unbanked because DeFi infrastructure doesn't exist. Celo already provides sub-cent gas, emerging-market stablecoins (KESm, NGNm, GHSm, XOFm, cUSD), and mobile-first wallet access via MiniPay's 15 million+ users. **The barrier is the interface layer**: wallets require understanding of seed phrases, token approvals, slippage, health factors, and protocol-specific UX in English — a cognitive burden that puts DeFi out of reach for the people who would benefit most.

A first-time user in Nairobi, Lagos, or Dhaka with a smartphone and an Opera Mini wallet cannot navigate current DeFi UIs. They also cannot claim GoodDollar UBI without understanding what a "verified human" means on-chain, or how to bridge G$ from Ethereum to Celo. CeloBank Agent solves this interface problem directly.

---

## 3. SOLUTION — What CeloBank Agent Does

CeloBank Agent is a conversational DeFi agent that takes a natural-language message like *"envoie 5 cUSD à mon ami"* or *"كم لدي من G$؟"* and turns it into a prepared, unsigned transaction the user signs in their own wallet. The agent never holds funds.

**How it works** (from `src/agent/agent.ts`):

1. The user's message hits `POST /api/v1/chat`. The server's `detectLanguage()` function (`src/server.ts:91`) identifies the language from 19 supported options and prepends a language instruction.
2. The enriched message is passed to Anthropic Claude Sonnet 4.6 with a detailed system prompt (`src/agent/agent.ts:73`) that covers every protocol: Mento V2 slippage, Aave health factors, stCELO unbonding, G$ verification flow.
3. Claude selects from 21 registered tools and calls them. Tools that return unsigned transactions (`DIRECT_RETURN_TOOLS`, line 63) bypass the model re-paraphrase step and return directly.
4. DeFi write actions arrive at `POST /api/v1/prepare` (`src/server.ts:353`), which builds unsigned transaction calldata. The user's wallet (MiniPay, MetaMask, Coinbase Wallet) signs and broadcasts.

**G$ integration specifically** — `src/tools/gooddollar.ts`:

- `check_gooddollar`: Calls `balanceOf` on G$ token `0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A`, `isVerified` and `getIdentityExpiry` on IdentityV4 `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`. Returns G$ balance, human verification status, and identity expiry.
- `get_engagement_rewards`: Calls `appsStats()` on EngagementRewards contract `0x25db74CF4E7BA120526fd87e159CF656d94bAE43` to return total G$ distributed, users onboarded, and per-referral reward amount in real time.

The system prompt (`src/agent/agent.ts:98–102`) teaches the agent GoodDollar mechanics: "CeloBank is registered with GoodDollar EngagementRewards: earn $0.50 G$ per new verified user onboarded." When a user asks about G$, the agent explains UBI, verification, and the referral incentive in the user's own language.

---

## 4. LIVE G$ INTEGRATION — Every Touchpoint, With Evidence

| Touchpoint | What It Does | Code Location | Contract |
|---|---|---|---|
| **G$ balance check** | Reads `balanceOf(address)` from SuperGoodDollar on Celo | `src/tools/gooddollar.ts:65` | `0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A` |
| **Human verification status** | Calls `isVerified(address)` on IdentityV4 | `src/tools/gooddollar.ts:66` | `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42` |
| **Identity expiry** | Calls `getIdentityExpiry(address)` on IdentityV4 | `src/tools/gooddollar.ts:67` | `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42` |
| **Engagement stats** | Calls `appsStats(appAddress)` — reads `numberOfRewards`, `totalAppRewards`, `totalUserRewards`, `totalInviterRewards` | `src/tools/gooddollar.ts:103–114` | `0x25db74CF4E7BA120526fd87e159CF656d94bAE43` |
| **Reward per user** | Calls `rewardAmount()` on EngagementRewards | `src/tools/gooddollar.ts:110` | `0x25db74CF4E7BA120526fd87e159CF656d94bAE43` |
| **G$ in portfolio** | G$ listed as `0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9c7A` in the token registry | `src/tools/celo.ts:39` | Token displayed alongside CELO, cUSD, USDC in every portfolio read |
| **AI G$ education** | System prompt explicitly teaches the agent GoodDollar UBI mechanics, verification, and referral rewards | `src/agent/agent.ts:98–102` | N/A — prompt-level |
| **EngagementRewards registration** | CeloBank registered as an app with GoodDollar EngagementRewards on-chain | [Registration TX](https://celoscan.io/tx/0x4f9c91083e103d663a39469fe173ec51096be941b22a18a69c4237df37fe110f) | `0x25db74CF4E7BA120526fd87e159CF656d94bAE43` |
| **Referral incentive displayed** | After every G$ check: *"Invite friends to CeloBank to earn $0.50 G$ per new user you onboard."* | `src/tools/gooddollar.ts:90` | On-chain referral flow |
| **Unverified onboarding** | If `isVerified = false`, agent responds with verification link and UBI explanation in user's language | `src/tools/gooddollar.ts:91` | `wallet.gooddollar.org` |

G$ is a first-class token in CeloBank — not bolted on. It appears in every portfolio view, has two dedicated tools, drives the onboarding incentive structure, and its verification status informs AI-powered guidance in the user's native language.

---

## 5. TRACTION — Real Numbers From the Codebase and Deployment

| Metric | Value | Source |
|---|---|---|
| **Tools** | 21 live on-chain tools | `src/server.ts:574` (`tools: 21`) |
| **Languages supported** | 19 | `src/server.ts:118–138` (19 `langInstructions` entries) |
| **SDK downloads** | ~1,118 weekly (`@celobank/agent-sdk`) | npm / WHITEPAPER.md |
| **ERC-8004 score** | 100/100 on 8004scan | WHITEPAPER.md §9.1 |
| **ERC-8004 agent #** | #9225 | [Celoscan NFT](https://celoscan.io/nft/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/9225) |
| **Self Protocol status** | SDK integrated (`@selfxyz/agent-sdk` v0.2.1), linked-mode registration endpoint live at `POST /api/self-agent-register` | `src/lib/self-agent-id.ts` |
| **Farcaster Mini App** | Live at `celobank-agent.vercel.app`, Neynar webhook active, `@celobank` bot replies on-mention with full agent context + user's verified wallet | `src/bot/farcaster-bot.ts`, `src/ui/public/.well-known/farcaster.json` |
| **MiniPay** | Auto-detects and auto-connects MiniPay wallet (no manual step) | `src/ui/main.tsx` + whitepaper §5.1 |
| **x402 catalog** | Machine-readable `GET /catalog` (x402-catalog/1.0 schema) with 21 tools, pricing, and payment schema | `src/server.ts:659–786` |
| **MCP endpoint** | `POST /mcp` (protocol `2024-11-05`) | `src/server.ts:656` |
| **A2A AgentCard** | `GET /.well-known/agent-card.json` (v0.3.0, 8 skills) | `src/server.ts:789` |
| **On-chain identity** | Agent contract `0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1`, Token Factory `0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e` | WHITEPAPER.md §9.2 |

---

## 6. IMPACT PLAN — How CeloBank Will Grow G$ Usage in 12 Weeks

The plan is not to add G$ — it's already there. The plan is to drive adoption and make the existing integration measurably visible.

### Week 1–2: G$ Onboarding Flow UX
Build a dedicated onboarding screen that detects `isVerified = false` and walks users through the GoodDollar verification flow step by step. Currently the agent explains verbally; the UI will add a button-driven checklist. Target: first 50 verified G$ users through CeloBank.

### Week 3–4: Farcaster G$ Casts
Automate weekly Farcaster casts from `@celobank` showing live EngagementRewards stats pulled from `appsStats()` — total users onboarded, total G$ distributed, current reward amount. Social proof drives referrals; referrals drive G$ flow.

### Week 5–6: Referral Link System
Build a `?ref=0xADDRESS` URL parameter that attributes new verified users to a referrer on-chain via the EngagementRewards contract. Currently the referral happens but is not surfaced in the UI as a personal metric. Give users a shareable link and a live dashboard showing their referral earnings in G$.

### Week 7–8: G$ UBI Education in 19 Languages
Expand the system prompt with richer G$ UBI education tailored per region: Swahili for East Africa (KESm/G$ parity), Yoruba/Hausa for West Africa, Hindi for South Asia. Build a static `/learn/gooddollar` page explaining UBI, G$ on Celo vs Ethereum, and how to claim.

### Week 9–10: G$ ↔ cUSD Swap Guidance
Add explicit agent guidance for G$ → cUSD liquidity paths (Uniswap V3, bridge back to Fuse/Ethereum). Currently the agent notes G$ has no V3 liquidity on Celo; this feature adds bridge routing instructions specific to G$ so verified UBI recipients know what to do with their G$.

### Week 11–12: GoodDollar EngagementRewards Dashboard
Build a public dashboard page at `celobank-agent.vercel.app/gooddollar` showing real-time stats from `appsStats()`: users onboarded this week/month, total G$ distributed, top referrers (anonymous), and a live G$ price widget. Submit this dashboard for coverage in GoodDollar community channels.

---

## 7. KPIs — 3 Measurable Goals for the 12-Week Cycle

**KPI 1 — 200 G$-verified users onboarded through CeloBank**
Measured via `appsStats().numberOfRewards` on EngagementRewards contract `0x25db74CF4E7BA120526fd87e159CF656d94bAE43`. Baseline: current on-chain value. Target: +200 by end of week 12. Verifiable by anyone on Celoscan.

**KPI 2 — 500 `check_gooddollar` tool invocations**
Measured via server logs on Railway (`🤖 Agent response sent` lines tagged with `check_gooddollar`). This metric confirms active G$ engagement — not just registration, but recurring balance/verification checks by real users. Baseline: current log count. Target: +500 in 12 weeks.

**KPI 3 — 1,000 weekly active users on the Farcaster Mini App**
Measured via Neynar webhook analytics (cast mentions triggering bot replies) + Vercel Analytics on `celobank-agent.vercel.app`. Farcaster is the primary growth channel — scaling here directly drives G$ onboarding at the top of the funnel.

---

## 8. TEAM

**wkalidev** — Solo full-stack Web3 developer, Celo ecosystem builder.

- Farcaster: @willywarrior
- Built and shipped CeloBank Agent end-to-end: TypeScript/React frontend, Express.js API, 21 DeFi tools across Mento V2, Aave V3, stCELO, Uniswap V3, Token Factory, GoodDollar EngagementRewards
- Integrated ERC-8004 on-chain identity (agent #9225, 100/100 on 8004scan), Self Protocol agent SDK, MCP, A2A AgentCard, x402 machine-readable catalog
- Deployed on Vercel + Railway, live on Celo Mainnet
- Published `@celobank/agent-sdk` v1.0.9 on npm
- Active Celo community contributor; building for real users in Africa and LatAm from day one

---

## 9. LINKS

| Resource | URL |
|---|---|
| **Live App** | https://celobank-agent.vercel.app |
| **GitHub** | https://github.com/wkalidev/celobank-agent |
| **API (Railway)** | https://celobank-agent-production.up.railway.app |
| **npm SDK** | https://www.npmjs.com/package/@celobank/agent-sdk |
| **ERC-8004 Agent #9225** | https://celoscan.io/nft/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/9225 |
| **8004scan** | https://8004scan.io |
| **GoodDollar Registration TX** | https://celoscan.io/tx/0x4f9c91083e103d663a39469fe173ec51096be941b22a18a69c4237df37fe110f |
| **G$ Token on Celo** | https://celoscan.io/address/0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A |
| **EngagementRewards Contract** | https://celoscan.io/address/0x25db74CF4E7BA120526fd87e159CF656d94bAE43 |
| **Farcaster** | https://warpcast.com/willywarrior |
| **Twitter/X** | https://x.com/wkalidev |

---

*All facts in this application are grounded in the live codebase at `github.com/wkalidev/celobank-agent` and on-chain state verifiable on Celoscan.*
