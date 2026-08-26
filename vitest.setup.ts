// Several modules (server.ts, tools/prepare.ts, tools/engagement.ts) derive the
// agent's account from PRIVATE_KEY at module-eval time. Tests never touch a real
// chain, but the import still needs *a* validly-shaped key present.
process.env.PRIVATE_KEY ??= `0x${"11".repeat(32)}`
process.env.CELO_RPC    ??= "https://forno.celo.org"
