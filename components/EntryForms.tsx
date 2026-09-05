"use client";

import { useActionState, useState } from "react";
import { joinAction, loginAction, type FormState } from "@/app/actions";

type Person = { id: string; name: string };

const empty: FormState = {};

export default function EntryForms({
  players,
  needsPasscode,
}: {
  players: Person[];
  needsPasscode: boolean;
}) {
  const [mode, setMode] = useState<"login" | "join">(players.length ? "login" : "join");

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`btn ${mode === "login" ? "" : "ghost"}`}
          onClick={() => setMode("login")}
          disabled={!players.length}
        >
          I&rsquo;m already in
        </button>
        <button
          type="button"
          className={`btn ${mode === "join" ? "" : "ghost"}`}
          onClick={() => setMode("join")}
        >
          Add me
        </button>
      </div>
      {mode === "login" ? <LoginForm players={players} /> : <JoinForm needsPasscode={needsPasscode} />}
    </>
  );
}

function LoginForm({ players }: { players: Person[] }) {
  const [state, action, pending] = useActionState(loginAction, empty);
  // A hidden input rather than a <select>: React resets the form after an
  // action, which would snap a <select> back to the first name and check the
  // next PIN attempt against the wrong person. Tap targets beat an iOS wheel
  // picker anyway.
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");

  return (
    <form action={action} className="card">
      {state.error ? <div className="error">{state.error}</div> : null}
      <input type="hidden" name="playerId" value={playerId} />
      <div className="field">
        <label>Who are you?</label>
        <div className="namegrid">
          {players.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`nametag ${p.id === playerId ? "on" : ""}`}
              aria-pressed={p.id === playerId}
              onClick={() => setPlayerId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="login-pin">Your PIN</label>
        <input
          id="login-pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="••••"
          required
        />
      </div>
      <div className="field">
        <button className="btn" disabled={pending || !playerId}>
          {pending ? "Checking…" : "Let me in"}
        </button>
      </div>
    </form>
  );
}

function JoinForm({ needsPasscode }: { needsPasscode: boolean }) {
  const [state, action, pending] = useActionState(joinAction, empty);
  return (
    <form action={action} className="card">
      {state.error ? <div className="error">{state.error}</div> : null}
      <div className="field">
        <label htmlFor="join-name">Your name</label>
        <input
          id="join-name"
          name="name"
          type="text"
          autoComplete="given-name"
          placeholder="Ornella"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="join-pin">Pick a PIN (4–8 digits)</label>
        <input
          id="join-pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="••••"
          required
        />
      </div>
      {needsPasscode ? (
        <div className="field">
          <label htmlFor="join-passcode">Group passcode</label>
          <input id="join-passcode" name="passcode" type="text" autoComplete="off" required />
        </div>
      ) : null}
      <div className="field">
        <button className="btn" disabled={pending}>
          {pending ? "Joining…" : "Join the game"}
        </button>
      </div>
      <p className="footnote" style={{ marginBottom: 0 }}>
        Your PIN just stops someone grabbing your phone and peeking at their own
        rules. Don&rsquo;t reuse a real one.
      </p>
    </form>
  );
}
