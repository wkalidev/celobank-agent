import { createPublicClient, createWalletClient, http, parseEther, formatEther, formatUnits, parseUnits, defineChain, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { TOKENS, MENTO_BROKER, MENTO_BI_POOL_MANAGER, MENTO_EXCHANGE_IDS, UNISWAP_V3_ROUTER, UNISWAP_V3_FEE, TOKEN_FACTORY, AAVE_POOL, CELO_RPC_DEFAULT, } from "./constants.js";
import { ERC20_ABI, BROKER_ABI, AAVE_POOL_ABI } from "./abis.js";
// ─── Uniswap V3 Router ABI ────────────────────────────────────────────────────
const UNISWAP_V3_ROUTER_ABI = [
    {
        name: "exactInputSingle",
        type: "function",
        inputs: [{ name: "params", type: "tuple", components: [
                    { name: "tokenIn", type: "address" },
                    { name: "tokenOut", type: "address" },
                    { name: "fee", type: "uint24" },
                    { name: "recipient", type: "address" },
                    { name: "deadline", type: "uint256" },
                    { name: "amountIn", type: "uint256" },
                    { name: "amountOutMinimum", type: "uint256" },
                    { name: "sqrtPriceLimitX96", type: "uint160" },
                ] }],
        outputs: [{ name: "amountOut", type: "uint256" }],
        stateMutability: "payable",
    },
];
// ─── Token Factory ABI ────────────────────────────────────────────────────────
const TOKEN_FACTORY_ABI = [
    {
        name: "createToken",
        type: "function",
        inputs: [
            { name: "name_", type: "string" },
            { name: "symbol_", type: "string" },
            { name: "totalSupply_", type: "uint256" },
        ],
        outputs: [{ name: "tokenAddress", type: "address" }],
        stateMutability: "nonpayable",
    },
];
// ─── Mento stablecoin addresses for routing ───────────────────────────────────
const MENTO_STABLECOIN_ADDRS = new Set([
    "0x765de816845861e75a25fca122bb6898b8b1282a", // cUSD / USDm
    "0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73", // cEUR / EURm
    "0xe8537a3d056da446677b9e9d6c5db704eaab4787", // cREAL / BRLm
    "0x456a3d042c0dbd3db53d5489e98dfb038553b0d0", // KESm
    "0xe2702bd97ee33c88c8f6f92da3b733608aa76f71", // NGNm
    "0xfaea5f3404bba20d3cc2f8c4b0a888f55a3c7313", // GHSm
    "0x73f93dcc49cb8a239e2032663e9475dd5ef29a08", // XOFm
    "0x4c35853a3b4e647fd266f4de678dcc8fec410bf6", // ZARm
    "0xccf663b1ff11028f0b19058d0f7b674004a40746", // GBPm
    "0x105d4a9306d2e55a71d2eb95b81553ae1dc20d7b", // PHPm
    "0x8a567e2ae79ca692bd748ab832081c45de4041ea", // COPm
    "0xff4ab19391af240c311c54200a492233052b6325", // CADm
    "0x7175504c455076f15c04a2f90a8e352281f492f9", // AUDm
    "0xb55a79f398e759e43c95b979163f30ec87ee131d", // CHFm
    "0xc45ecf20f3cd864b32d9794d6f76814ae8892e20", // JPYm
]);
function isMentoPair(tokenInAddr, tokenOutAddr) {
    const celoAddr = TOKENS.CELO.address.toLowerCase();
    const a = tokenInAddr.toLowerCase();
    const b = tokenOutAddr.toLowerCase();
    return (a === celoAddr && MENTO_STABLECOIN_ADDRS.has(b)) ||
        (b === celoAddr && MENTO_STABLECOIN_ADDRS.has(a));
}
function findToken(symbol) {
    const key = Object.keys(TOKENS).find(k => k.toLowerCase() === symbol.toLowerCase());
    return key ? { sym: key, ...TOKENS[key] } : null;
}
const celoMainnet = defineChain({
    id: 42220,
    name: "Celo Mainnet",
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    rpcUrls: { default: { http: [CELO_RPC_DEFAULT] } },
    blockExplorers: {
        default: { name: "CeloScan", url: "https://celoscan.io" },
    },
});
// ─── GoodDollar Constants ─────────────────────────────────────────────────────
const G_DOLLAR = "0x62B8B11039FcfE5aB0C56E502b1C372A3D2a9C7A";
const ENGAGEMENT_REWARDS = "0x25db74CF4E7BA120526fd87e159CF656d94bAE43";
const IDENTITY_V4 = "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42";
const IDENTITY_ABI = [
    { name: "isVerified", type: "function", inputs: [{ name: "_user", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
    { name: "getIdentityExpiry", type: "function", inputs: [{ name: "_user", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
];
const ENGAGEMENT_STATS_ABI = [
    {
        name: "appsStats",
        type: "function",
        inputs: [{ name: "", type: "address" }],
        outputs: [
            { name: "numberOfRewards", type: "uint96" },
            { name: "totalAppRewards", type: "uint96" },
            { name: "totalUserRewards", type: "uint96" },
            { name: "totalInviterRewards", type: "uint96" },
        ],
        stateMutability: "view",
    },
    {
        name: "rewardAmount",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "uint96" }],
        stateMutability: "view",
    },
];
// ─── DailyDrop Constants ──────────────────────────────────────────────────────
const DAILYDROP_CELO = "0x63596cf6601ec2240A295ff2840C8d6653252AE6";
const DAILYDROP_FEE_RECEIVER = "0xDEAcDe6eC27Fd0cD972c1232C4f0d4171dda2357";
const DAILYDROP_CHECK_IN_FEE = parseEther("0.001");
const DAILYDROP_ABI = [
    { name: "checkIn", type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
    { name: "claimReward", type: "function", inputs: [], outputs: [], stateMutability: "nonpayable" },
    {
        name: "getUserData", type: "function",
        inputs: [{ internalType: "address", name: "_user", type: "address" }],
        outputs: [
            { internalType: "uint256", name: "streak", type: "uint256" },
            { internalType: "uint256", name: "lastCheckIn", type: "uint256" },
            { internalType: "uint256", name: "totalCheckIns", type: "uint256" },
            { internalType: "bool", name: "canCheckIn", type: "bool" },
            { internalType: "bool", name: "canClaim", type: "bool" },
            { internalType: "uint256", name: "nextCheckIn", type: "uint256" },
        ],
        stateMutability: "view",
    },
];
/**
 * CeloBankSDK — Infrastructure pour construire des agents DeFi autonomes sur Celo
 *
 * @example
 * ```typescript
 * import { CeloBankSDK } from "@celobank/agent-sdk"
 *
 * const sdk = new CeloBankSDK({ privateKey: process.env.PRIVATE_KEY! })
 *
 * const portfolio = await sdk.getPortfolio()
 * const swap      = await sdk.swap({ amount: "10", tokenOut: "cUSD" })
 * const supply    = await sdk.supplyAave({ amount: "50" })
 * const streak    = await sdk.getStreak()
 * const checkIn   = await sdk.checkIn()
 * ```
 */
export class CeloBankSDK {
    account;
    publicClient;
    walletClient;
    address;
    constructor(config) {
        const rawKey = config.privateKey.trim();
        const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`);
        this.account = privateKeyToAccount(privateKey);
        this.address = this.account.address;
        const rpcUrl = config.rpcUrl ?? CELO_RPC_DEFAULT;
        this.publicClient = createPublicClient({ chain: celoMainnet, transport: http(rpcUrl) });
        this.walletClient = createWalletClient({ account: this.account, chain: celoMainnet, transport: http(rpcUrl) });
    }
    /**
     * Retourne le portefeuille complet : CELO natif + tous les tokens ERC20
     */
    async getPortfolio(params = {}) {
        const addr = (params.address ?? this.address);
        const nativeBalance = await this.publicClient.getBalance({ address: addr });
        const tokenBalances = await Promise.all(Object.entries(TOKENS).map(async ([symbol, token]) => {
            try {
                const balance = await this.publicClient.readContract({
                    address: token.address,
                    abi: ERC20_ABI,
                    functionName: "balanceOf",
                    args: [addr],
                });
                return [symbol, parseFloat(formatUnits(balance, token.decimals)).toFixed(4)];
            }
            catch {
                return [symbol, "0.0000"];
            }
        }));
        return {
            address: addr,
            native: parseFloat(formatEther(nativeBalance)).toFixed(4),
            tokens: Object.fromEntries(tokenBalances),
        };
    }
    /**
     * Prix en temps réel + variation 24h via CoinGecko
     */
    async getPrices(params = {}) {
        const requested = params.tokens
            ? params.tokens.map(t => t.toUpperCase()).filter(t => TOKENS[t])
            : Object.keys(TOKENS);
        const ids = requested.map(t => TOKENS[t].coingeckoId).join(",");
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
        const data = await res.json();
        return requested.map(symbol => ({
            symbol,
            priceUsd: data[TOKENS[symbol].coingeckoId]?.usd ?? 0,
            change24h: data[TOKENS[symbol].coingeckoId]?.usd_24h_change ?? 0,
        }));
    }
    /**
     * Envoyer du CELO natif
     */
    async send(params) {
        const txHash = await this.walletClient.sendTransaction({
            account: this.account,
            chain: celoMainnet,
            to: params.to,
            value: parseEther(params.amount),
        });
        return {
            success: true,
            to: params.to,
            amount: params.amount,
            txHash,
            explorerUrl: `https://celoscan.io/tx/${txHash}`,
        };
    }
    /**
     * Swapper CELO → stablecoin via Mento V2
     */
    async swap(params) {
        const symbol = Object.keys(TOKENS).find(k => k.toLowerCase() === params.tokenOut.toLowerCase());
        if (!symbol)
            throw new Error(`Token "${params.tokenOut}" non supporté`);
        const token = TOKENS[symbol];
        const parsed = parseEther(params.amount);
        const exchangeId = MENTO_EXCHANGE_IDS[symbol] ?? await this._getExchangeId(token.address);
        if (!exchangeId)
            throw new Error(`Pas de pool Mento V2 pour CELO→${symbol}`);
        const approveHash = await this.walletClient.writeContract({
            account: this.account, chain: celoMainnet,
            address: TOKENS.CELO.address, abi: ERC20_ABI,
            functionName: "approve", args: [MENTO_BROKER, parsed],
        });
        await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
        const txHash = await this.walletClient.writeContract({
            account: this.account, chain: celoMainnet,
            address: MENTO_BROKER, abi: BROKER_ABI,
            functionName: "swapIn",
            args: [MENTO_BI_POOL_MANAGER, exchangeId, TOKENS.CELO.address, token.address, parsed, 0n],
        });
        return {
            success: true, amountIn: params.amount, tokenOut: symbol,
            txHash, explorerUrl: `https://celoscan.io/tx/${txHash}`,
        };
    }
    /**
     * Lire la position Aave V3
     */
    async getAavePosition(params = {}) {
        const addr = (params.address ?? this.address);
        const data = await this.publicClient.readContract({
            address: AAVE_POOL, abi: AAVE_POOL_ABI,
            functionName: "getUserAccountData", args: [addr],
        });
        const [collateral, debt, available, , , healthFactor] = data;
        return {
            address: addr,
            totalCollateralUsd: formatUnits(collateral, 8),
            totalDebtUsd: formatUnits(debt, 8),
            availableBorrowsUsd: formatUnits(available, 8),
            healthFactor: formatUnits(healthFactor, 18),
        };
    }
    /**
     * Déposer sur Aave V3 pour générer des intérêts
     */
    async supplyAave(params) {
        const assetSymbol = (params.asset ?? "cUSD").toUpperCase();
        const token = TOKENS[assetSymbol];
        if (!token)
            throw new Error(`Asset "${assetSymbol}" non supporté pour Aave`);
        const parsed = parseUnits(params.amount, token.decimals);
        await this.walletClient.writeContract({
            account: this.account, chain: celoMainnet,
            address: token.address, abi: ERC20_ABI,
            functionName: "approve", args: [AAVE_POOL, parsed],
        });
        const txHash = await this.walletClient.writeContract({
            account: this.account, chain: celoMainnet,
            address: AAVE_POOL, abi: AAVE_POOL_ABI,
            functionName: "supply",
            args: [token.address, parsed, this.address, 0],
        });
        return {
            success: true, asset: assetSymbol, amount: params.amount,
            txHash, explorerUrl: `https://celoscan.io/tx/${txHash}`,
        };
    }
    /**
     * Universal swap: routes CELO↔stablecoin via Mento V2, all other pairs via Uniswap V3
     */
    async swapTokens(params) {
        const inToken = findToken(params.tokenIn ?? "CELO");
        const outToken = findToken(params.tokenOut);
        if (!inToken)
            throw new Error(`Token "${params.tokenIn ?? "CELO"}" not supported`);
        if (!outToken)
            throw new Error(`Token "${params.tokenOut}" not supported`);
        const amountWei = parseUnits(params.amount, inToken.decimals);
        const useMento = isMentoPair(inToken.address, outToken.address);
        const spender = useMento ? MENTO_BROKER : UNISWAP_V3_ROUTER;
        const approveHash = await this.walletClient.writeContract({
            account: this.account, chain: celoMainnet,
            address: inToken.address, abi: ERC20_ABI,
            functionName: "approve", args: [spender, amountWei],
        });
        await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
        if (useMento) {
            const stableToken = inToken.sym === "CELO" ? outToken : inToken;
            const exchangeId = await this._getExchangeId(stableToken.address);
            if (!exchangeId)
                throw new Error(`No Mento V2 pool for ${inToken.sym}→${outToken.sym}`);
            const txHash = await this.walletClient.writeContract({
                account: this.account, chain: celoMainnet,
                address: MENTO_BROKER, abi: BROKER_ABI,
                functionName: "swapIn",
                args: [MENTO_BI_POOL_MANAGER, exchangeId, inToken.address, outToken.address, amountWei, 0n],
            });
            return { success: true, amountIn: params.amount, tokenOut: outToken.sym, txHash, explorerUrl: `https://celoscan.io/tx/${txHash}` };
        }
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
        const txHash = await this.walletClient.writeContract({
            account: this.account, chain: celoMainnet,
            address: UNISWAP_V3_ROUTER, abi: UNISWAP_V3_ROUTER_ABI,
            functionName: "exactInputSingle",
            args: [{
                    tokenIn: inToken.address, tokenOut: outToken.address,
                    fee: UNISWAP_V3_FEE, recipient: this.address, deadline,
                    amountIn: amountWei, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n,
                }],
        });
        return { success: true, amountIn: params.amount, tokenOut: outToken.sym, txHash, explorerUrl: `https://celoscan.io/tx/${txHash}` };
    }
    /**
     * Deploy a new ERC20 token on Celo via TokenFactory
     */
    async launchToken(params) {
        const totalSupplyWei = parseUnits(params.totalSupply, 18);
        const txHash = await this.walletClient.writeContract({
            account: this.account, chain: celoMainnet,
            address: TOKEN_FACTORY, abi: TOKEN_FACTORY_ABI,
            functionName: "createToken",
            args: [params.name, params.symbol, totalSupplyWei],
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
        const tokenAddress = (receipt.logs?.[0]?.address ?? "");
        return {
            success: true, name: params.name, symbol: params.symbol,
            totalSupply: params.totalSupply, tokenAddress, txHash,
            explorerUrl: `https://celoscan.io/tx/${txHash}`,
        };
    }
    // ─── DailyDrop Methods ──────────────────────────────────────────────────────
    /**
     * Lire le streak DailyDrop d'une adresse
     * @example
     * const streak = await sdk.getStreak()
     * console.log(`Streak: ${streak.streak} days`)
     */
    async getStreak(params = {}) {
        const addr = (params.address ?? this.address);
        const data = await this.publicClient.readContract({
            address: DAILYDROP_CELO,
            abi: DAILYDROP_ABI,
            functionName: "getUserData",
            args: [addr],
        });
        const nextCheckInTs = Number(data[5]);
        return {
            address: addr,
            streak: Number(data[0]),
            totalCheckIns: Number(data[2]),
            canCheckIn: Boolean(data[3]),
            canClaim: Boolean(data[4]),
            nextCheckIn: nextCheckInTs,
            nextCheckInDate: nextCheckInTs > 0
                ? new Date(nextCheckInTs * 1000).toISOString()
                : "now",
        };
    }
    /**
     * Daily check-in sur DailyDrop
     * - Envoie 0.001 CELO de fee
     * - Appelle checkIn() sur le contrat
     * - Après 7 jours → claimDrop() pour recevoir 10 DROP
     * @example
     * const result = await sdk.checkIn()
     * console.log(result.message) // "6 days until reward"
     */
    async checkIn() {
        const streakData = await this.getStreak();
        if (!streakData.canCheckIn) {
            throw new Error(`Already checked in today. Next: ${streakData.nextCheckInDate}`);
        }
        // TX 1: Fee → zcodebase.eth
        const feeTxHash = await this.walletClient.sendTransaction({
            account: this.account, chain: celoMainnet,
            to: DAILYDROP_FEE_RECEIVER,
            value: DAILYDROP_CHECK_IN_FEE,
        });
        await this.publicClient.waitForTransactionReceipt({ hash: feeTxHash });
        // TX 2: Check-in on-chain
        const checkInTxHash = await this.walletClient.writeContract({
            account: this.account, chain: celoMainnet,
            address: DAILYDROP_CELO,
            abi: DAILYDROP_ABI,
            functionName: "checkIn",
        });
        await this.publicClient.waitForTransactionReceipt({ hash: checkInTxHash });
        const newStreak = streakData.streak + 1;
        const daysLeft = 7 - (newStreak % 7) || 7;
        const message = newStreak % 7 === 0
            ? `🎉 7-day streak! Call claimDrop() to receive 10 DROP tokens`
            : `${daysLeft} day${daysLeft > 1 ? "s" : ""} until reward`;
        return {
            success: true, streak: newStreak,
            feeTxHash, checkInTxHash,
            explorerUrl: `https://celoscan.io/tx/${checkInTxHash}`,
            message,
        };
    }
    /**
     * Claim 10 DROP tokens après 7 jours de streak
     * @example
     * const result = await sdk.claimDrop()
     */
    async claimDrop() {
        const streakData = await this.getStreak();
        if (!streakData.canClaim) {
            throw new Error(`Cannot claim yet. Need ${7 - streakData.streak} more days.`);
        }
        const txHash = await this.walletClient.writeContract({
            account: this.account, chain: celoMainnet,
            address: DAILYDROP_CELO,
            abi: DAILYDROP_ABI,
            functionName: "claimReward",
        });
        return {
            success: true, txHash, amount: "10 DROP",
            explorerUrl: `https://celoscan.io/tx/${txHash}`,
        };
    }
    // ─── GoodDollar Methods ─────────────────────────────────────────────────────
    /**
     * Read G$ balance and GoodDollar human verification status for an address.
     * Verification is required to earn UBI on Ethereum/Fuse; verified status is
     * also checked by the EngagementRewards contract on Celo.
     * @example
     * const status = await sdk.checkGoodDollar()
     * console.log(`G$ balance: ${status.gBalance}`)
     * console.log(`Verified: ${status.isVerified}`)
     */
    async checkGoodDollar(params = {}) {
        const addr = (params.address ?? this.address);
        const [balResult, verifiedResult, expiryResult] = await Promise.allSettled([
            this.publicClient.readContract({ address: G_DOLLAR, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }),
            this.publicClient.readContract({ address: IDENTITY_V4, abi: IDENTITY_ABI, functionName: "isVerified", args: [addr] }),
            this.publicClient.readContract({ address: IDENTITY_V4, abi: IDENTITY_ABI, functionName: "getIdentityExpiry", args: [addr] }),
        ]);
        const gBalance = balResult.status === "fulfilled"
            ? parseFloat(formatUnits(balResult.value, 18)).toFixed(4) : "0.0000";
        const isVerified = verifiedResult.status === "fulfilled" ? Boolean(verifiedResult.value) : false;
        const expiryTs = expiryResult.status === "fulfilled" ? Number(expiryResult.value) : 0;
        const identityExpiry = expiryTs > 0 ? new Date(expiryTs * 1000).toISOString() : "N/A";
        return { address: addr, gBalance, isVerified, identityExpiry };
    }
    /**
     * Read CeloBank's GoodDollar engagement reward stats from the EngagementRewards
     * contract on Celo — users onboarded and G$ distributed via referrals.
     * @example
     * const rewards = await sdk.getEngagementRewards()
     * console.log(`Users onboarded: ${rewards.numberOfRewards}`)
     * console.log(`Total G$ distributed: ${rewards.totalAppRewards}`)
     */
    async getEngagementRewards(params = {}) {
        const appAddr = (params.appAddress ?? this.address);
        const [stats, rewardAmt] = await Promise.all([
            this.publicClient.readContract({
                address: ENGAGEMENT_REWARDS, abi: ENGAGEMENT_STATS_ABI, functionName: "appsStats", args: [appAddr],
            }),
            this.publicClient.readContract({
                address: ENGAGEMENT_REWARDS, abi: ENGAGEMENT_STATS_ABI, functionName: "rewardAmount",
            }),
        ]);
        const [numberOfRewards, totalApp, totalUser, totalInviter] = stats;
        return {
            appAddress: appAddr,
            numberOfRewards: Number(numberOfRewards),
            totalAppRewards: parseFloat(formatUnits(totalApp, 18)).toFixed(4),
            totalUserRewards: parseFloat(formatUnits(totalUser, 18)).toFixed(4),
            totalInviterRewards: parseFloat(formatUnits(totalInviter, 18)).toFixed(4),
            rewardPerUser: parseFloat(formatUnits(rewardAmt, 18)).toFixed(4),
        };
    }
    // ─── Private helpers ────────────────────────────────────────────────────────
    async _getExchangeId(tokenAddress) {
        const BI_POOL_ABI = [{
                name: "getExchanges", type: "function", inputs: [],
                outputs: [{ name: "", type: "tuple[]", components: [
                            { name: "exchangeId", type: "bytes32" },
                            { name: "assets", type: "address[]" },
                        ] }],
                stateMutability: "view",
            }];
        try {
            const exchanges = await this.publicClient.readContract({
                address: MENTO_BI_POOL_MANAGER, abi: BI_POOL_ABI, functionName: "getExchanges",
            });
            const celoAddr = TOKENS.CELO.address.toLowerCase();
            const tokenAddr = tokenAddress.toLowerCase();
            for (const ex of exchanges) {
                const assets = ex.assets.map((a) => a.toLowerCase());
                if (assets.includes(celoAddr) && assets.includes(tokenAddr)) {
                    return ex.exchangeId;
                }
            }
        }
        catch { }
        return null;
    }
}
//# sourceMappingURL=CeloBankSDK.js.map