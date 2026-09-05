import Link from "next/link";
import { redirect } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import { setRevealAction } from "@/app/actions";
import { hasDatabase } from "@/lib/db";
import { rulesFor } from "@/lib/rules";
import { currentPlayer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  if (!hasDatabase()) redirect("/");
  const viewer = await currentPlayer();
  if (!viewer) redirect("/");

  const groups = await rulesFor(viewer.id);
  const total = groups.reduce((n, g) => n + 1 + g.merged.length, 0);
  const revealed = Boolean(viewer.revealed_at);

  return (
    <>
      <AutoRefresh seconds={20} />
      <Link href="/board" className="back">
        ‹ Everyone
      </Link>

      {!revealed ? (
        <>
          <h1>Your update</h1>
          <p className="sub">
            Everyone else has been writing rules for you. Don&rsquo;t peek early.
          </p>
          <div className="lock card">
            <div className="big">🔒</div>
            <div className="count">{total}</div>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {total === 1 ? "rule is" : "rules are"} waiting for your update
            </p>
          </div>
          <div className="notice" style={{ marginTop: 14 }}>
            Only open this when you&rsquo;re actually up. Once revealed, everyone else
            sees that you&rsquo;ve looked.
          </div>
          <form action={setRevealAction} style={{ marginTop: 14 }}>
            <input type="hidden" name="reveal" value="1" />
            <button className="btn" disabled={total === 0}>
              I&rsquo;m presenting — show me my rules
            </button>
          </form>
          {total === 0 ? (
            <p className="footnote">Nothing has been written for you yet.</p>
          ) : null}
        </>
      ) : (
        <>
          <h1>Your rules</h1>
          <p className="sub">
            {groups.length} rule{groups.length === 1 ? "" : "s"} from {total} submission
            {total === 1 ? "" : "s"}. Good luck.
          </p>
          <ul className="rules">
            {groups.map((g) => (
              <li key={g.id} className="rule">
                <div className="rule-top">
                  <div className="rule-body">
                    {g.body}
                    <div className="rule-meta">
                      {g.contributors.length > 1 ? (
                        <span className="pill" style={{ marginRight: 8 }}>
                          ×{g.contributors.length}
                        </span>
                      ) : null}
                      {g.contributors.map((c) => c.name).join(", ")}
                    </div>
                  </div>
                </div>
                {g.merged.length > 0 ? (
                  <ul className="merged-list">
                    {g.merged.map((m) => (
                      <li key={m.id} className="merged-item">
                        <span className="dim">↳</span>
                        <span className="txt">
                          {m.body} <span className="dim">— {m.author.name}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <form action={setRevealAction} style={{ marginTop: 18 }}>
            <input type="hidden" name="reveal" value="0" />
            <button className="btn ghost">Hide these again</button>
          </form>
        </>
      )}
    </>
  );
}
