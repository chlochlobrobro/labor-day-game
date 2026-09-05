import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import RuleBoard, { type ClientGroup } from "@/components/RuleBoard";
import { hasDatabase } from "@/lib/db";
import { getPlayer, rulesFor } from "@/lib/rules";
import { currentPlayer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) redirect("/");
  const { id } = await params;
  const viewer = await currentPlayer();
  if (!viewer) redirect("/");
  // The one rule the whole game rests on: your own list is never served here.
  if (viewer.id === id) redirect("/me");

  const target = await getPlayer(id);
  if (!target) notFound();

  const groups = await rulesFor(id);
  const clientGroups: ClientGroup[] = groups.map((g) => ({
    id: g.id,
    body: g.body,
    authorId: g.author.id,
    authorName: g.author.name,
    contributors: g.contributors,
    merged: g.merged.map((m) => ({
      id: m.id,
      body: m.body,
      authorId: m.author.id,
      authorName: m.author.name,
    })),
  }));

  const total = groups.reduce((n, g) => n + 1 + g.merged.length, 0);

  return (
    <>
      <AutoRefresh />
      <Link href="/board" className="back">
        ‹ Everyone
      </Link>
      <h1>Rules for {target.name}</h1>
      <p className="sub">
        {total === 0
          ? `${target.name} can't see any of this.`
          : `${groups.length} rule${groups.length === 1 ? "" : "s"} from ${total} submission${
              total === 1 ? "" : "s"
            }. ${target.name} can't see any of it.`}
        {target.revealed_at ? ` They've now revealed their list to themselves.` : ""}
      </p>

      <RuleBoard
        targetId={target.id}
        targetName={target.name}
        viewerId={viewer.id}
        groups={clientGroups}
      />

      <p className="footnote">
        Tick two or more rules to fold them into one — the count next to a rule shows
        how many people landed on the same idea.
      </p>
    </>
  );
}
