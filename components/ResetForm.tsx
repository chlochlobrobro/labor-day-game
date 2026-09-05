"use client";

import { useActionState } from "react";
import { resetAction, type FormState } from "@/app/actions";

const empty: FormState = {};

export default function ResetForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(resetAction, empty);

  if (state.ok) {
    return (
      <div className="card">
        <p style={{ margin: "0 0 14px", fontSize: 15 }}>Done — the game is clear.</p>
        <a className="btn" href="/" style={{ textDecoration: "none" }}>
          Back to the start
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="card">
      {state.error ? <div className="error">{state.error}</div> : null}
      <div className="field">
        <label htmlFor="reset-pass">Reset passcode</label>
        <input
          id="reset-pass"
          name="passcode"
          type="password"
          autoComplete="off"
          required
          disabled={!enabled}
        />
      </div>
      <div className="field">
        <button
          className="btn secondary"
          name="scope"
          value="rules"
          disabled={pending || !enabled}
        >
          Clear the rules, keep everyone
        </button>
      </div>
      <div className="field">
        <button className="btn danger" name="scope" value="everything" disabled={pending || !enabled}>
          Delete everything
        </button>
      </div>
      <p className="footnote" style={{ marginBottom: 0 }}>
        Clearing the rules also re-locks anyone who had revealed theirs, so you
        can run the whole round again. Deleting everything drops names and PINs
        too — everyone re-joins from scratch.
      </p>
    </form>
  );
}
