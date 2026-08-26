import "dotenv/config"
import pg from "pg"

const { Pool } = pg

// Railway's Postgres plugin injects DATABASE_URL automatically once provisioned.
// Left unset, the pool still constructs (lazy connection) — callers that never touch
// the activity store (the other 24 tools) keep working with no DB configured at all.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : undefined,
})

let migrated = false

// Idempotent, hand-rolled — the schema is small enough that a migration framework
// would be pure overhead. Safe to call on every boot.
export async function runMigrations(): Promise<void> {
  if (migrated) return
  if (!process.env.DATABASE_URL) {
    console.warn("[db] DATABASE_URL not set — engagement-reward activity tracking is disabled.")
    return
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS confirmed_actions (
      id           SERIAL PRIMARY KEY,
      address      TEXT NOT NULL,
      action       TEXT NOT NULL,
      cycle_key    TEXT NOT NULL,
      tx_hash      TEXT NOT NULL UNIQUE,
      confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS confirmed_actions_address_idx ON confirmed_actions (address);

    CREATE TABLE IF NOT EXISTS unstake_cycles (
      cycle_key TEXT PRIMARY KEY,
      address   TEXT NOT NULL,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS unstake_cycles_open_idx ON unstake_cycles (address) WHERE closed_at IS NULL;

    CREATE TABLE IF NOT EXISTS engagement_claims (
      address    TEXT PRIMARY KEY,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      tx_hash    TEXT NOT NULL
    );
  `)

  migrated = true
  console.log("[db] Migrations applied.")
}
