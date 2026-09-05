"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  addRuleAction,
  deleteRuleAction,
  editRuleAction,
  mergeRulesAction,
  unmergeRuleAction,
  type FormState,
} from "@/app/actions";
import { SIMILAR_THRESHOLD, similarity } from "@/lib/similarity";

export type ClientGroup = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  contributors: { id: string; name: string }[];
  merged: { id: string; body: string; authorId: string; authorName: string }[];
};

const empty: FormState = {};

export default function RuleBoard({
  targetId,
  targetName,
  viewerId,
  groups,
}: {
  targetId: string;
  targetName: string;
  viewerId: string;
  groups: ClientGroup[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  // Drop selections for rules that vanished under us (someone else merged first).
  useEffect(() => {
    const live = new Set(groups.map((g) => g.id));
    setSelected((prev) => {
      const next = prev.filter((id) => live.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [groups]);

  const duplicatePairs = useMemo(() => {
    const pairs: { a: ClientGroup; b: ClientGroup; score: number }[] = [];
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const score = similarity(groups[i].body, groups[j].body);
        if (score >= SIMILAR_THRESHOLD) pairs.push({ a: groups[i], b: groups[j], score });
      }
    }
    return pairs.sort((x, y) => y.score - x.score);
  }, [groups]);

  const flagged = useMemo(() => {
    const ids = new Set<string>();
    for (const p of duplicatePairs) {
      ids.add(p.a.id);
      ids.add(p.b.id);
    }
    return ids;
  }, [duplicatePairs]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectedGroups = groups.filter((g) => selected.includes(g.id));

  return (
    <>
      <Composer targetId={targetId} targetName={targetName} groups={groups} />

      {duplicatePairs.length > 0 ? (
        <div className="dupe-hint" style={{ marginTop: 18 }}>
          <b>
            {duplicatePairs.length} possible duplicate
            {duplicatePairs.length === 1 ? "" : "s"}
          </b>{" "}
          — e.g. &ldquo;{truncate(duplicatePairs[0].a.body)}&rdquo; and &ldquo;
          {truncate(duplicatePairs[0].b.body)}&rdquo;.
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn small ghost"
              onClick={() => setSelected([duplicatePairs[0].a.id, duplicatePairs[0].b.id])}
            >
              Review these two
            </button>
          </div>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="empty" style={{ marginTop: 18 }}>
          Nothing for {targetName} yet. What are they guaranteed to bring up?
        </p>
      ) : (
        <ul className="rules">
          {groups.map((g) => (
            <li
              key={g.id}
              className={[
                "rule",
                selected.includes(g.id) ? "selected" : "",
                flagged.has(g.id) ? "flagged" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="rule-top">
                <button
                  type="button"
                  aria-label={selected.includes(g.id) ? "Deselect rule" : "Select rule"}
                  className={`check ${selected.includes(g.id) ? "on" : ""}`}
                  onClick={() => toggle(g.id)}
                >
                  ✓
                </button>
                <div className="rule-body">
                  {editing === g.id ? (
                    <form
                      action={editRuleAction}
                      onSubmit={() => setEditing(null)}
                    >
                      <input type="hidden" name="ruleId" value={g.id} />
                      <textarea name="body" defaultValue={g.body} maxLength={240} />
                      <div className="rule-actions">
                        <button className="btn small">Save</button>
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {g.body}
                      <div className="rule-meta">
                        {g.contributors.length > 1 ? (
                          <span className="pill" style={{ marginRight: 8 }}>
                            ×{g.contributors.length}
                          </span>
                        ) : null}
                        {g.contributors.map((c) => c.name).join(", ")}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {g.merged.length > 0 ? (
                <ul className="merged-list">
                  {g.merged.map((m) => (
                    <li key={m.id} className="merged-item">
                      <span className="dim">↳</span>
                      <span className="txt">
                        {m.body} <span className="dim">— {m.authorName}</span>
                      </span>
                      <form action={unmergeRuleAction}>
                        <input type="hidden" name="ruleId" value={m.id} />
                        <button className="btn small ghost">Split</button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : null}

              {editing === g.id ? null : (
                <div className="rule-actions">
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => setEditing(g.id)}
                  >
                    Reword
                  </button>
                  {g.authorId === viewerId && g.merged.length === 0 ? (
                    <form action={deleteRuleAction}>
                      <input type="hidden" name="ruleId" value={g.id} />
                      <button className="btn small danger">Delete mine</button>
                    </form>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {selectedGroups.length >= 2 ? (
        <MergeBar
          targetId={targetId}
          selectedGroups={selectedGroups}
          onCancel={() => setSelected([])}
        />
      ) : selectedGroups.length === 1 ? (
        <div className="mergebar">
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Select one more rule to combine it with.
          </p>
        </div>
      ) : null}
    </>
  );
}

function MergeBar({
  targetId,
  selectedGroups,
  onCancel,
}: {
  targetId: string;
  selectedGroups: ClientGroup[];
  onCancel: () => void;
}) {
  // Default to the wording that already carries the most people.
  const best = [...selectedGroups].sort(
    (a, b) => b.contributors.length - a.contributors.length || b.body.length - a.body.length,
  )[0];
  const [text, setText] = useState(best.body);

  useEffect(() => setText(best.body), [best.body]);

  const people = new Map<string, string>();
  for (const g of selectedGroups) for (const c of g.contributors) people.set(c.id, c.name);

  return (
    <form action={mergeRulesAction} className="mergebar" onSubmit={onCancel}>
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="keepId" value={best.id} />
      <input
        type="hidden"
        name="mergeIds"
        value={selectedGroups.filter((g) => g.id !== best.id).map((g) => g.id).join(",")}
      />
      <label htmlFor="combined">
        Combine {selectedGroups.length} rules into one ({people.size} people)
      </label>
      <input
        id="combined"
        name="combined"
        type="text"
        value={text}
        maxLength={240}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn">Combine</button>
      </div>
    </form>
  );
}

function Composer({
  targetId,
  targetName,
  groups,
}: {
  targetId: string;
  targetName: string;
  groups: ClientGroup[];
}) {
  const [state, action, pending] = useActionState(addRuleAction, empty);
  const [draft, setDraft] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setDraft("");
      formRef.current?.reset();
    }
  }, [state.ok]);

  const match = useMemo(() => {
    if (draft.trim().length < 4) return null;
    let top: { body: string; score: number; who: string } | null = null;
    for (const g of groups) {
      for (const candidate of [
        { body: g.body, who: g.contributors.map((c) => c.name).join(", ") },
        ...g.merged.map((m) => ({ body: m.body, who: m.authorName })),
      ]) {
        const score = similarity(draft, candidate.body);
        if (score >= SIMILAR_THRESHOLD && (!top || score > top.score)) {
          top = { body: candidate.body, score, who: candidate.who };
        }
      }
    }
    return top;
  }, [draft, groups]);

  return (
    <form action={action} ref={formRef} className="card">
      <input type="hidden" name="targetId" value={targetId} />
      {state.error ? <div className="error">{state.error}</div> : null}
      <label htmlFor="body">Take a sip when {targetName}&hellip;</label>
      <textarea
        id="body"
        name="body"
        value={draft}
        maxLength={240}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="mentions her dog by name"
        required
      />
      {match ? (
        <div className="dupe-hint">
          Sounds a lot like <b>&ldquo;{match.body}&rdquo;</b> from {match.who}. Add
          yours anyway and you can fold them together, or tweak it into something
          different.
        </div>
      ) : null}
      <div className="field">
        <button className="btn" disabled={pending || draft.trim().length < 3}>
          {pending ? "Adding…" : "Add rule"}
        </button>
      </div>
    </form>
  );
}

function truncate(text: string, max = 42) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
