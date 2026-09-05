import { Pool } from "pg";

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

declare global {
  // eslint-disable-next-line no-var
  var __ldgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __ldgSchema: Promise<void> | undefined;
}

export function hasDatabase() {
  return connectionString.length > 0;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", ""]);

/**
 * `pg` lets an `sslmode` in the connection string override the `ssl` option
 * passed alongside it, so a hosted URL ending in `?sslmode=verify-full` turns
 * on certificate verification no matter what we ask for — and managed Postgres
 * (Vercel, Neon, Supabase) presents a chain Node won't verify, failing with
 * SELF_SIGNED_CERT_IN_CHAIN. Strip the parameter and state the TLS policy
 * ourselves: encrypted, but not verified against a CA.
 */
function connectionConfig(): { url: string; ssl: false | { rejectUnauthorized: boolean } } {
  let url = connectionString;
  let disabled = false;
  let local = connectionString.includes("localhost");

  try {
    const parsed = new URL(connectionString);
    local = LOCAL_HOSTS.has(parsed.hostname);
    disabled = parsed.searchParams.get("sslmode") === "disable";
    if (parsed.searchParams.has("sslmode") || parsed.searchParams.has("ssl")) {
      parsed.searchParams.delete("sslmode");
      parsed.searchParams.delete("ssl");
      url = parsed.toString();
    }
  } catch {
    // Not a URL we can parse (a key/value DSN, say) — hand it over untouched.
  }

  return { url, ssl: disabled || local ? false : { rejectUnauthorized: false } };
}

export function getPool(): Pool {
  if (!connectionString) {
    throw new Error(
      "No database connection string. Set POSTGRES_URL (or DATABASE_URL) in your environment.",
    );
  }
  if (!global.__ldgPool) {
    const { url, ssl } = connectionConfig();
    global.__ldgPool = new Pool({
      connectionString: url,
      ssl,
      max: 3,
      idleTimeoutMillis: 10_000,
      // Fail fast with a readable error instead of hanging until the
      // serverless function times out.
      connectionTimeoutMillis: 8_000,
    });
    // A dropped backend must not take the whole function down.
    global.__ldgPool.on("error", (err) => console.error("postgres pool error", err));
  }
  return global.__ldgPool;
}

/** Executed one statement at a time: poolers in transaction mode (Neon,
 *  Supabase) can reject a multi-statement simple query. */
const SCHEMA: string[] = [
  `create table if not exists players (
     id          text primary key,
     name        text not null,
     name_key    text not null unique,
     pin_hash    text not null,
     created_at  timestamptz not null default now(),
     revealed_at timestamptz
   )`,
  `create table if not exists rules (
     id          text primary key,
     target_id   text not null references players(id) on delete cascade,
     author_id   text not null references players(id) on delete cascade,
     body        text not null,
     created_at  timestamptz not null default now(),
     merged_into text references rules(id) on delete set null
   )`,
  `create index if not exists rules_target_idx on rules (target_id)`,
  `create index if not exists rules_merged_idx on rules (merged_into)`,
];

/** Postgres raises these when two cold starts run `if not exists` at the same
 *  moment — the object exists either way, so they are not failures. */
const RACE_CODES = new Set(["23505", "42P07", "42710"]);

async function createSchema(): Promise<void> {
  const pool = getPool();
  for (const statement of SCHEMA) {
    try {
      await pool.query(statement);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (!code || !RACE_CODES.has(code)) throw err;
    }
  }
}

export function ensureSchema(): Promise<void> {
  if (!global.__ldgSchema) {
    global.__ldgSchema = createSchema().catch((err) => {
      // Let the next request retry rather than caching the failure forever.
      global.__ldgSchema = undefined;
      throw err;
    });
  }
  return global.__ldgSchema;
}

export async function sql<T = any>(text: string, params: any[] = []): Promise<T[]> {
  await ensureSchema();
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

/** A one-line, credential-free description of why a database call failed. */
export function describeDbError(err: unknown): string {
  const e = err as { message?: string; code?: string };
  const message = (e?.message || String(err)).replace(
    /postgres(?:ql)?:\/\/[^\s]*/gi,
    "<connection string>",
  );
  const hints: Record<string, string> = {
    ENOTFOUND: "The database host in the connection string doesn't resolve.",
    ECONNREFUSED: "Nothing is listening at that host and port.",
    ETIMEDOUT: "The database didn't answer in time.",
    "28P01": "The database rejected the username or password.",
    "3D000": "That database name doesn't exist on the server.",
    "42501": "The database user isn't allowed to create tables.",
  };
  const hint = e?.code ? hints[e.code] : undefined;
  return [message, hint, e?.code ? `(code ${e.code})` : ""].filter(Boolean).join("\n\n");
}
