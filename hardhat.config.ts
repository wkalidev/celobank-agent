import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "dotenv/config";

// NOTE (July 2026): registering hardhat-toolbox-viem as a real plugin (so
// `npx hardhat verify` would exist) was tried and reverted — it pulls in
// @nomicfoundation/hardhat-verify, whose bundled Zod v3 collides with this
// project's own Zod v4 dependency during Hardhat's plugin config-validation
// step, throwing "TypeError: keyValidator._parse is not a function" on
// EVERY Hardhat command (compile included), not just verify. This is a
// known Zod dual-instance / plugin-boundary compatibility issue, not
// something fixable via version pinning from this project's side. See
// CHANGELOG.md. Contract verification is done manually via Celoscan's
// "Verify and Publish" web UI instead — see the standard-json-input files
// under artifacts/build-info/.
const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    celo: {
      type: "http",
      url: "https://forno.celo.org",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 42220,
    },
    celoSepolia: {
      type: "http",
      url: "https://forno.celo-sepolia.celo-testnet.org",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 44787,
    },
  },
};

export default config;
