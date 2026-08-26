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
      id         SERIAL PRIMARY KEY,
      address    TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      tx_hash    TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS engagement_claims_address_idx ON engagement_claims (address, claimed_at DESC);
  `)

  // Pre-existing deployments created engagement_claims with `address` as the sole
  // primary key (one row per address, ever) — that made the reward a one-time-forever
  // claim instead of the ~180-day-cooldown re-claim the GoodDollar contract and the
  // rest of this app assume. CREATE TABLE IF NOT EXISTS above is a no-op against an
  // existing table, so migrate it in place: drop the address-only PK and give it a
  // proper serial id, so a new row can be inserted per claim cycle.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'engagement_claims' AND constraint_type = 'PRIMARY KEY'
          AND constraint_name = 'engagement_claims_pkey'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'engagement_claims' AND column_name = 'id'
      ) THEN
        ALTER TABLE engagement_claims DROP CONSTRAINT engagement_claims_pkey;
        ALTER TABLE engagement_claims ADD COLUMN id SERIAL PRIMARY KEY;
        ALTER TABLE engagement_claims ADD CONSTRAINT engagement_claims_tx_hash_key UNIQUE (tx_hash);
        CREATE INDEX IF NOT EXISTS engagement_claims_address_idx ON engagement_claims (address, claimed_at DESC);
      END IF;
    END $$;
  `)

  migrated = true
  console.log("[db] Migrations applied.")
}
