import Link from "next/link";
import { redirect } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import Initial from "@/components/Initial";
import { logoutAction } from "@/app/actions";
import { hasDatabase } from "@/lib/db";
import { listPlayers, submissionCounts } from "@/lib/rules";
import { currentPlayer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  if (!hasDatabase()) redirect("/");
  const viewer = await currentPlayer();
  if (!viewer) redirect("/");

  const [players, counts] = await Promise.all([listPlayers(), submissionCounts(viewer.id)]);
  const others = players.filter((p) => p.id !== viewer.id);
  const mine = counts.get(viewer.id)?.total ?? 0;

  return (
    <>
      <AutoRefresh />
      <div className="topbar">
        <div className="who">
          Signed in as <b>{viewer.name}</b>
        </div>
        <form action={logoutAction}>
          <button className="btn ghost small">Switch</button>
        </form>
      </div>

      <h1>Who&rsquo;s presenting?</h1>
      <p className="sub">
        Tap a friend to add rules for their update. Everything you write is hidden
        from them.
      </p>

      <ul className="roster">
        <li>
          <Link href="/me" className="person self">
            <Initial name={viewer.name} />
            <div className="body">
              <div className="name">{viewer.name} (you)</div>
              <div className="meta">
                {viewer.revealed_at
                  ? "Revealed — tap to read your rules"
                  : mine === 0
                    ? "Nothing written for you yet"
                    : `${mine} rule${mine === 1 ? "" : "s"} waiting, hidden`}
              </div>
            </div>
            <span className="chev">{viewer.revealed_at ? "→" : "🔒"}</span>
          </Link>
        </li>

        {others.map((p) => {
          const c = counts.get(p.id) ?? { total: 0, mine: 0 };
          return (
            <li key={p.id}>
              <Link href={`/p/${p.id}`} className="person">
                <Initial name={p.name} />
                <div className="body">
                  <div className="name">{p.name}</div>
                  <div className="meta">
                    {c.total === 0
                      ? "No rules yet — start it off"
                      : `${c.total} rule${c.total === 1 ? "" : "s"} · ${c.mine} from you`}
                  </div>
                </div>
                {p.revealed_at ? <span className="pill good">Live</span> : null}
                <span className="chev">›</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {others.length === 0 ? (
        <p className="empty" style={{ marginTop: 12 }}>
          You&rsquo;re the only one here so far. Send everyone else this link so they
          can add themselves.
        </p>
      ) : null}

      <p className="footnote">
        Anyone can fold near-identical rules together on a friend&rsquo;s page, so the
        final list reads cleanly when it&rsquo;s their turn.
      </p>
    </>
  );
}
