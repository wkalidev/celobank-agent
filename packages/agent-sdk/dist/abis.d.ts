export declare const ERC20_ABI: readonly [{
    readonly name: "approve";
    readonly type: "function";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly name: "decimals";
    readonly type: "function";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
    }];
    readonly stateMutability: "view";
}];
export declare const BROKER_ABI: readonly [{
    readonly name: "swapIn";
    readonly type: "function";
    readonly inputs: readonly [{
        readonly name: "exchangeProvider";
        readonly type: "address";
    }, {
        readonly name: "exchangeId";
        readonly type: "bytes32";
    }, {
        readonly name: "tokenIn";
        readonly type: "address";
    }, {
        readonly name: "tokenOut";
        readonly type: "address";
    }, {
        readonly name: "amountIn";
        readonly type: "uint256";
    }, {
        readonly name: "amountOutMin";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "amountOut";
        readonly type: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}];
export declare const AAVE_POOL_ABI: readonly [{
    readonly name: "supply";
    readonly type: "function";
    readonly inputs: readonly [{
        readonly name: "asset";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly name: "onBehalfOf";
        readonly type: "address";
    }, {
        readonly name: "referralCode";
        readonly type: "uint16";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly name: "withdraw";
    readonly type: "function";
    readonly inputs: readonly [{
        readonly name: "asset";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }, {
        readonly name: "to";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "amountWithdrawn";
        readonly type: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly name: "getUserAccountData";
    readonly type: "function";
    readonly inputs: readonly [{
        readonly name: "user";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "totalCollateralBase";
        readonly type: "uint256";
    }, {
        readonly name: "totalDebtBase";
        readonly type: "uint256";
    }, {
        readonly name: "availableBorrowsBase";
        readonly type: "uint256";
    }, {
        readonly name: "currentLiquidationThreshold";
        readonly type: "uint256";
    }, {
        readonly name: "ltv";
        readonly type: "uint256";
    }, {
        readonly name: "healthFactor";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}];
//# sourceMappingURL=abis.d.ts.map