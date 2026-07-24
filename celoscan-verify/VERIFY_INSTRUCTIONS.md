# Celoscan manual verification — corrected settings

**Use `celobankagent-standard-json-input.json` for CeloBankAgent — not the old
`standard-json-input.json`.** The first attempt used the wrong compiler settings
(current `hardhat.config.ts`'s solc 0.8.28), which is not what was actually deployed.
See "What went wrong" below. TokenFactory's original file was correct all along and has
been renamed to `tokenfactory-standard-json-input.json` (same content, new name only).

## CeloBankAgent — identity registry (`0x4ebef67f7a20485ccc9e66ee58fcc99f23e93de1`)

1. Contract → Verify and Publish
2. **Compiler Type:** `Solidity (Standard-JSON-Input)`
3. **Compiler Version:** `v0.8.25+commit.b61c2a91`  *(not 0.8.28 — see below)*
4. **License Type:** MIT
5. Upload `celobankagent-standard-json-input.json`
6. **Contract Name:** `contracts/CeloBankAgent.sol:CeloBankAgent`
7. No constructor arguments (zero-argument constructor).

This was verified locally before handing it to you: I fetched the actual on-chain
deployed bytecode from Celo's Blockscout instance (`celo.blockscout.com`, no API key
needed — Celoscan's own API required a key that wasn't accepted for this project's key)
and compiled the exact same source with solc 0.8.25, no optimizer, against the currently
installed `@openzeppelin/contracts@5.6.1`. Spot-checked eight ~60-character windows
spread evenly across the full 13,381-byte deployed bytecode (offsets 0, 500, 1000, 2000,
4000, 6000, 8000, 10000, 12000) — every one matched the live on-chain bytecode exactly.
Only the trailing ~53-byte Solidity metadata hash differs, which is expected (it encodes
a CBOR hash tied to exact file paths/settings as the original compiler run saw them) and
is a known, tolerated non-functional mismatch in Etherscan-family verifiers — it doesn't
indicate different code, and Celoscan's own verification pipeline is built to handle it.

## TokenFactory (`0x597f121c014b99a15c7c4e08928f0fe1ec3adc2e`)

1. Contract → Verify and Publish
2. **Compiler Type:** `Solidity (Standard-JSON-Input)`
3. **Compiler Version:** `v0.8.28+commit.7893614a`  *(this one WAS right — no change)*
4. **License Type:** MIT
5. Upload `tokenfactory-standard-json-input.json`
6. **Contract Name:** `contracts/TokenFactory.sol:TokenFactory`
7. No constructor arguments (no constructor at all).

Also independently confirmed against live on-chain bytecode: solc 0.8.28's version
marker (`...4300081c0033`, where `08 1c` = 8.28) is embedded directly in the on-chain
metadata, and the first ~2,900 bytes (the entirety of `TokenFactory`'s own dispatcher
logic, before the embedded `FactoryToken` init-code blob) matched my local solc 0.8.28
recompile byte-for-byte. TokenFactory was added in the same commit that bumped
`hardhat.config.ts` to solc 0.8.28 (`eaa0abc`, June 10 2026) — so unlike CeloBankAgent,
its settings genuinely do match the current config. This file was never actually wrong;
it's included here again just so both contracts' correct files live in one place.

## What went wrong the first time (CeloBankAgent only)

`artifacts/build-info/` is gitignored — it's never committed, and gets silently
overwritten by whatever `hardhat.config.ts` says at the moment someone last ran
`npx hardhat compile`, with zero record of history. CeloBankAgent's contract was added in
commit `fb64178` (May 15 2026) when `hardhat.config.ts` set `solidity: "0.8.25"`. That
config line was not touched again until commit `eaa0abc` (June 10 2026) — the same commit
that added TokenFactory and bumped the version to `0.8.28`. So any compile of
CeloBankAgent from June 10 onward (including the one I generated the first
`standard-json-input.json` from) silently used solc 0.8.28 against a contract that was
actually deployed under 0.8.25 — same source, different compiler, different bytecode.
The byte substitution you saw (`0x5f80fd5b` vs `0x5f5ffd5b`) is exactly the kind of
subtle codegen difference two solc versions produce for the same `revert()` pattern —
not a sign of wrong source or a viaIR/evmVersion mismatch. Neither historical nor current
`hardhat.config.ts` sets an optimizer or evmVersion explicitly either time, so those were
never the issue — it was purely the solc version.
