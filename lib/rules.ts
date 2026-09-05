import { sql } from "./db";

export type PlayerRow = {
  id: string;
  name: string;
  revealed_at: string | null;
};

export type RuleRow = {
  id: string;
  target_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  merged_into: string | null;
};

export type Contributor = { id: string; name: string };

export type RuleGroup = {
  id: string;
  body: string;
  createdAt: string;
  /** Rules folded into this one, oldest first. */
  merged: { id: string; body: string; author: Contributor }[];
  contributors: Contributor[];
  author: Contributor;
};

export async function listPlayers(): Promise<PlayerRow[]> {
  return sql<PlayerRow>(
    "select id, name, revealed_at from players order by lower(name)",
  );
}

export async function getPlayer(id: string): Promise<PlayerRow | null> {
  const rows = await sql<PlayerRow>(
    "select id, name, revealed_at from players where id = $1",
    [id],
  );
  return rows[0] ?? null;
}

export async function rawRulesFor(targetId: string): Promise<RuleRow[]> {
  return sql<RuleRow>(
    `select r.id, r.target_id, r.author_id, r.body, r.created_at, r.merged_into,
            p.name as author_name
       from rules r
       join players p on p.id = r.author_id
      where r.target_id = $1
      order by r.created_at asc`,
    [targetId],
  );
}

/** Folds merged rules into their canonical parent. */
export function groupRules(rows: RuleRow[]): RuleGroup[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groups = new Map<string, RuleGroup>();

  for (const row of rows) {
    if (row.merged_into) continue;
    groups.set(row.id, {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      merged: [],
      contributors: [{ id: row.author_id, name: row.author_name }],
      author: { id: row.author_id, name: row.author_name },
    });
  }

  for (const row of rows) {
    if (!row.merged_into) continue;
    // Follow the chain to the canonical rule, guarding against cycles.
    let parentId: string | null = row.merged_into;
    const seen = new Set<string>([row.id]);
    while (parentId && !groups.has(parentId) && !seen.has(parentId)) {
      seen.add(parentId);
      parentId = byId.get(parentId)?.merged_into ?? null;
    }
    const group = parentId ? groups.get(parentId) : undefined;
    if (!group) continue;
    const author = { id: row.author_id, name: row.author_name };
    group.merged.push({ id: row.id, body: row.body, author });
    if (!group.contributors.some((c) => c.id === author.id)) {
      group.contributors.push(author);
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (b.contributors.length !== a.contributors.length) {
      return b.contributors.length - a.contributors.length;
    }
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

export async function rulesFor(targetId: string): Promise<RuleGroup[]> {
  return groupRules(await rawRulesFor(targetId));
}

/** How many rules each player has waiting, and how many the viewer wrote. */
export async function submissionCounts(
  viewerId: string,
): Promise<Map<string, { total: number; mine: number }>> {
  const rows = await sql<{ target_id: string; total: string; mine: string }>(
    `select target_id,
            count(*)::text as total,
            count(*) filter (where author_id = $1)::text as mine
       from rules
      group by target_id`,
    [viewerId],
  );
  return new Map(
    rows.map((r) => [r.target_id, { total: Number(r.total), mine: Number(r.mine) }]),
  );
}
