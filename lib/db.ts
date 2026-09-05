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

export function getPool(): Pool {
  if (!connectionString) {
    throw new Error(
      "No database connection string. Set POSTGRES_URL (or DATABASE_URL) in your environment.",
    );
  }
  if (!global.__ldgPool) {
    global.__ldgPool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return global.__ldgPool;
}

const SCHEMA = `
create table if not exists players (
  id          text primary key,
  name        text not null,
  name_key    text not null unique,
  pin_hash    text not null,
  created_at  timestamptz not null default now(),
  revealed_at timestamptz
);

create table if not exists rules (
  id          text primary key,
  target_id   text not null references players(id) on delete cascade,
  author_id   text not null references players(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  merged_into text references rules(id) on delete set null
);

create index if not exists rules_target_idx on rules (target_id);
create index if not exists rules_merged_idx on rules (merged_into);
`;

export function ensureSchema(): Promise<void> {
  if (!global.__ldgSchema) {
    global.__ldgSchema = getPool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((err) => {
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
