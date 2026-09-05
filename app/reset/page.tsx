import Link from "next/link";
import ResetForm from "@/components/ResetForm";
import { describeDbError, hasDatabase, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ResetPage() {
  const enabled = Boolean(process.env.RESET_PASSCODE);

  let counts: { players: number; rules: number } | null = null;
  let error: string | null = null;
  if (hasDatabase()) {
    try {
      const rows = await sql<{ players: string; rules: string }>(
        `select (select count(*) from players)::text as players,
                (select count(*) from rules)::text as rules`,
      );
      counts = { players: Number(rows[0].players), rules: Number(rows[0].rules) };
    } catch (err) {
      error = describeDbError(err);
    }
  }

  return (
    <>
      <Link href="/" className="back">
        ‹ Back
      </Link>
      <p className="eyebrow">Danger zone</p>
      <h1>Reset the game</h1>
      <p className="sub">
        {counts
          ? `${counts.players} ${counts.players === 1 ? "person" : "people"}, ${counts.rules} ${
              counts.rules === 1 ? "rule" : "rules"
            } right now.`
          : "Wipe a test run so the real round starts clean."}
      </p>

      {error ? <div className="error">{error}</div> : null}

      {!enabled ? (
        <div className="notice" style={{ marginBottom: 14 }}>
          Resetting is switched off. Add a <code>RESET_PASSCODE</code> environment
          variable in your host&rsquo;s project settings and redeploy to enable it.
        </div>
      ) : null}

      <ResetForm enabled={enabled} />
    </>
  );
}
