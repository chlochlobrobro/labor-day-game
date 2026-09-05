import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql } from "./db";

const COOKIE = "ldg_player";
const MAX_AGE = 60 * 60 * 24 * 365;

function secret(): string {
  return (
    process.env.APP_SECRET ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    "labor-day-game-fallback-secret"
  );
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** `scrypt$<salt hex>$<key hex>` — PINs are never stored in the clear. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pin.trim(), salt, 32);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = scryptSync(pin.trim(), Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

export async function setSession(playerId: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${playerId}.${sign(playerId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export type Player = {
  id: string;
  name: string;
  name_key: string;
  revealed_at: string | null;
};

export async function currentPlayer(): Promise<Player | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  if (idx < 1) return null;
  const id = raw.slice(0, idx);
  const mac = raw.slice(idx + 1);
  const expected = sign(id);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const rows = await sql<Player>(
    "select id, name, name_key, revealed_at from players where id = $1",
    [id],
  );
  return rows[0] ?? null;
}
