"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <p className="eyebrow">Something broke</p>
      <h1>That page didn’t load</h1>
      <p className="sub">
        Usually the database: either it isn’t connected to this deployment yet, or
        it stopped accepting connections.
      </p>
      <div className="card">
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#f0b3a8",
          }}
        >
          {error.message || "Unknown error"}
          {error.digest ? `\n\nDigest: ${error.digest}` : ""}
        </pre>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={reset}>
          Try again
        </button>
        <a className="btn ghost" href="/" style={{ textDecoration: "none" }}>
          Start over
        </a>
      </div>
    </>
  );
}
