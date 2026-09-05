"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newId, sql } from "@/lib/db";
import { clearSession, currentPlayer, hashPin, setSession, verifyPin } from "@/lib/session";

const MAX_RULE_LENGTH = 240;

export type FormState = { error?: string; ok?: number };

function nameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function requireViewer() {
  const viewer = await currentPlayer();
  if (!viewer) redirect("/");
  return viewer;
}

/** Nobody may add to, edit, or read their own list — that is the whole game. */
async function requireOtherTarget(targetId: string) {
  const viewer = await requireViewer();
  if (viewer.id === targetId) {
    throw new Error("You can't touch your own list.");
  }
  return viewer;
}

export async function joinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  const passcode = String(formData.get("passcode") ?? "").trim();

  if (name.length < 2 || name.length > 40) {
    return { error: "Pick a name between 2 and 40 characters." };
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return { error: "Your PIN must be 4–8 digits." };
  }
  const required = process.env.GROUP_PASSCODE;
  if (required && passcode !== required) {
    return { error: "That group passcode isn't right." };
  }

  const key = nameKey(name);
  const existing = await sql<{ id: string }>(
    "select id from players where name_key = $1",
    [key],
  );
  if (existing.length) {
    return { error: "Someone already claimed that name — log in with it instead." };
  }

  const id = newId();
  try {
    await sql(
      "insert into players (id, name, name_key, pin_hash) values ($1, $2, $3, $4)",
      [id, name, key, hashPin(pin)],
    );
  } catch {
    return { error: "Someone already claimed that name — log in with it instead." };
  }
  await setSession(id);
  redirect("/board");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const playerId = String(formData.get("playerId") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();

  const rows = await sql<{ id: string; pin_hash: string }>(
    "select id, pin_hash from players where id = $1",
    [playerId],
  );
  const player = rows[0];
  if (!player || !verifyPin(pin, player.pin_hash)) {
    return { error: "Wrong PIN. Try again." };
  }
  await setSession(player.id);
  redirect("/board");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function addRuleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const targetId = String(formData.get("targetId") ?? "");
  const body = String(formData.get("body") ?? "").trim().replace(/\s+/g, " ");
  const viewer = await requireOtherTarget(targetId);

  if (body.length < 3) return { error: "Give the rule a few more words." };
  if (body.length > MAX_RULE_LENGTH) {
    return { error: `Keep it under ${MAX_RULE_LENGTH} characters.` };
  }

  await sql(
    "insert into rules (id, target_id, author_id, body) values ($1, $2, $3, $4)",
    [newId(), targetId, viewer.id, body],
  );
  revalidatePath(`/p/${targetId}`);
  revalidatePath("/board");
  return { ok: Date.now() };
}

export async function editRuleAction(formData: FormData) {
  const ruleId = String(formData.get("ruleId") ?? "");
  const body = String(formData.get("body") ?? "").trim().replace(/\s+/g, " ");
  const viewer = await requireViewer();
  if (body.length < 3 || body.length > MAX_RULE_LENGTH) return;

  const rows = await sql<{ target_id: string }>(
    "select target_id from rules where id = $1",
    [ruleId],
  );
  const rule = rows[0];
  if (!rule || rule.target_id === viewer.id) return;

  await sql("update rules set body = $1 where id = $2", [body, ruleId]);
  revalidatePath(`/p/${rule.target_id}`);
}

export async function deleteRuleAction(formData: FormData) {
  const ruleId = String(formData.get("ruleId") ?? "");
  const viewer = await requireViewer();

  const rows = await sql<{ target_id: string; author_id: string }>(
    "select target_id, author_id from rules where id = $1",
    [ruleId],
  );
  const rule = rows[0];
  if (!rule || rule.target_id === viewer.id) return;
  if (rule.author_id !== viewer.id) return; // only the author can withdraw a rule

  // Anything folded into this rule is promoted back out rather than lost.
  await sql("update rules set merged_into = null where merged_into = $1", [ruleId]);
  await sql("delete from rules where id = $1", [ruleId]);
  revalidatePath(`/p/${rule.target_id}`);
  revalidatePath("/board");
}

/** Folds every selected rule into the first one and stores the combined wording. */
export async function mergeRulesAction(formData: FormData) {
  const targetId = String(formData.get("targetId") ?? "");
  const keepId = String(formData.get("keepId") ?? "");
  const mergeIds = String(formData.get("mergeIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((id) => id !== keepId);
  const combined = String(formData.get("combined") ?? "").trim().replace(/\s+/g, " ");

  await requireOtherTarget(targetId);
  if (!keepId || !mergeIds.length) return;

  const rows = await sql<{ id: string }>(
    "select id from rules where target_id = $1 and id = any($2::text[])",
    [targetId, [keepId, ...mergeIds]],
  );
  if (rows.length !== mergeIds.length + 1) return; // ids must all belong to this list

  if (combined && combined.length <= MAX_RULE_LENGTH) {
    await sql("update rules set body = $1 where id = $2", [combined, keepId]);
  }
  // Re-point anything already folded into a rule we are about to fold.
  await sql(
    "update rules set merged_into = $1 where target_id = $2 and merged_into = any($3::text[])",
    [keepId, targetId, mergeIds],
  );
  await sql(
    "update rules set merged_into = $1 where target_id = $2 and id = any($3::text[])",
    [keepId, targetId, mergeIds],
  );
  await sql("update rules set merged_into = null where id = $1", [keepId]);
  revalidatePath(`/p/${targetId}`);
}

export async function unmergeRuleAction(formData: FormData) {
  const ruleId = String(formData.get("ruleId") ?? "");
  const viewer = await requireViewer();

  const rows = await sql<{ target_id: string }>(
    "select target_id from rules where id = $1",
    [ruleId],
  );
  const rule = rows[0];
  if (!rule || rule.target_id === viewer.id) return;

  await sql("update rules set merged_into = null where id = $1", [ruleId]);
  revalidatePath(`/p/${rule.target_id}`);
}

export async function setRevealAction(formData: FormData) {
  const reveal = String(formData.get("reveal") ?? "") === "1";
  const viewer = await requireViewer();
  await sql("update players set revealed_at = $1 where id = $2", [
    reveal ? new Date().toISOString() : null,
    viewer.id,
  ]);
  revalidatePath("/me");
  revalidatePath("/board");
}
