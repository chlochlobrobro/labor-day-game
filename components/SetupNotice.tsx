const DB_VARS = ["POSTGRES_URL", "DATABASE_URL", "POSTGRES_PRISMA_URL"] as const;

/** Shown when the app can't reach a database — either none is configured, or
 *  the connection failed. Names which variables are present (never values) so
 *  a misconfigured deploy is diagnosable from the phone that hit it. */
export default function SetupNotice({ error }: { error?: string }) {
  const present = DB_VARS.filter((name) => Boolean(process.env[name]));

  return (
    <>
      <p className="eyebrow">Almost there</p>
      <h1>{error ? "Can’t reach the database" : "Connect a database"}</h1>
      <p className="sub">
        {error
          ? "A connection string is configured, but connecting to it failed."
          : "This app is deployed but has nowhere to store the rules yet."}
      </p>

      {error ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>What went wrong</p>
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
            {error}
          </pre>
        </div>
      ) : null}

      <div className="card">
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55 }}>
          In your Vercel project, open <b>Storage</b> and create a free Postgres
          database, then click <b>Connect</b> to link it to this project. Vercel adds a{" "}
          <code>POSTGRES_URL</code> environment variable for you.
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55 }} className="muted">
          Redeploy afterwards so the app picks it up. Tables are created
          automatically on first load.
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }} className="dim">
          Connection variables this deployment can see:{" "}
          <b>{present.length ? present.join(", ") : "none"}</b>
        </p>
      </div>
    </>
  );
}
