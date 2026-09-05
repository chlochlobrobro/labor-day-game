import { redirect } from "next/navigation";
import EntryForms from "@/components/EntryForms";
import SetupNotice from "@/components/SetupNotice";
import { hasDatabase } from "@/lib/db";
import { listPlayers } from "@/lib/rules";
import { currentPlayer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EntryPage() {
  if (!hasDatabase()) return <SetupNotice />;

  const viewer = await currentPlayer();
  if (viewer) redirect("/board");

  const players = await listPlayers();

  return (
    <>
      <p className="eyebrow">Annual life updates</p>
      <h1>Sips &amp; Updates</h1>
      <p className="sub">
        Everyone writes the drinking-game rules for everyone else. You&rsquo;ll never
        see what&rsquo;s waiting on your own update — until you&rsquo;re up.
      </p>
      <EntryForms
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        needsPasscode={Boolean(process.env.GROUP_PASSCODE)}
      />
    </>
  );
}
