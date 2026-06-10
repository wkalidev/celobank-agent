// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev Minimal ERC20 deployed by the factory; all supply minted to creator at construction.
contract FactoryToken is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address creator_
    ) ERC20(name_, symbol_) {
        _mint(creator_, totalSupply_);
    }
}

/// @title TokenFactory
/// @notice Permissionless ERC20 launcher on Celo. Anyone can deploy a token; full supply goes to caller.
contract TokenFactory is ReentrancyGuard {
    event TokenCreated(
        address indexed tokenAddress,
        string  name,
        string  symbol,
        uint256 supply,
        address indexed creator
    );

    address[] private _allTokens;
    mapping(address => address[]) private _tokensByCreator;

    /// @notice Deploy a new ERC20 token. All supply is sent to msg.sender.
    /// @param name_        Token name (e.g. "My Token")
    /// @param symbol_      Token symbol (e.g. "MTK")
    /// @param totalSupply_ Total supply in smallest unit (18-decimal wei)
    function createToken(
        string  calldata name_,
        string  calldata symbol_,
        uint256          totalSupply_
    ) external nonReentrant returns (address tokenAddress) {
        require(bytes(name_).length   > 0,  "TokenFactory: name required");
        require(bytes(symbol_).length > 0,  "TokenFactory: symbol required");
        require(bytes(symbol_).length <= 11, "TokenFactory: symbol too long");
        require(totalSupply_          > 0,  "TokenFactory: supply must be > 0");

        FactoryToken token = new FactoryToken(name_, symbol_, totalSupply_, msg.sender);
        tokenAddress = address(token);

        _allTokens.push(tokenAddress);
        _tokensByCreator[msg.sender].push(tokenAddress);

        emit TokenCreated(tokenAddress, name_, symbol_, totalSupply_, msg.sender);
    }

    /// @notice Returns all token addresses ever created via this factory.
    function getAllTokens() external view returns (address[] memory) {
        return _allTokens;
    }

    /// @notice Returns all token addresses created by a specific wallet.
    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return _tokensByCreator[creator];
    }

    /// @notice Total number of tokens launched.
    function totalTokens() external view returns (uint256) {
        return _allTokens.length;
    }
}
