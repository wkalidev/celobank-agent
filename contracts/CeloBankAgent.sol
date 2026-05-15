// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CeloBankAgent
 * @dev ERC-8004 Identity Registry for CeloBank Agent
 * Autonomous AI bank for the unbanked — Celo Mainnet
 */
contract CeloBankAgent is ERC721, Ownable {
    
    struct AgentIdentity {
        string name;
        string description;
        string endpoint;
        string[] capabilities;
        uint256 registeredAt;
        bool active;
    }

    uint256 public tokenIdCounter;
    mapping(uint256 => AgentIdentity) public agents;
    mapping(address => uint256) public agentByAddress;

    event AgentRegistered(uint256 indexed tokenId, address indexed agent, string name);
    event AgentUpdated(uint256 indexed tokenId, string endpoint);
    event AgentDeactivated(uint256 indexed tokenId);

    constructor() ERC721("CeloBank Agent Identity", "CBAI") Ownable(msg.sender) {}

    function registerAgent(
        string memory name,
        string memory description,
        string memory endpoint,
        string[] memory capabilities
    ) external returns (uint256) {
        tokenIdCounter++;
        uint256 tokenId = tokenIdCounter;

        _safeMint(msg.sender, tokenId);

        agents[tokenId] = AgentIdentity({
            name: name,
            description: description,
            endpoint: endpoint,
            capabilities: capabilities,
            registeredAt: block.timestamp,
            active: true
        });

        agentByAddress[msg.sender] = tokenId;

        emit AgentRegistered(tokenId, msg.sender, name);
        return tokenId;
    }

    function updateEndpoint(uint256 tokenId, string memory newEndpoint) external {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        agents[tokenId].endpoint = newEndpoint;
        emit AgentUpdated(tokenId, newEndpoint);
    }

    function deactivateAgent(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        agents[tokenId].active = false;
        emit AgentDeactivated(tokenId);
    }

    function getAgent(uint256 tokenId) external view returns (AgentIdentity memory) {
        return agents[tokenId];
    }

    function getCapabilities(uint256 tokenId) external view returns (string[] memory) {
        return agents[tokenId].capabilities;
    }
}