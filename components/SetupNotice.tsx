export default function SetupNotice() {
  return (
    <>
      <p className="eyebrow">Almost there</p>
      <h1>Connect a database</h1>
      <p className="sub">
        This app is deployed but has nowhere to store the rules yet.
      </p>
      <div className="card">
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55 }}>
          In your Vercel project, open <b>Storage</b> and create a free Postgres
          database, then click <b>Connect</b> to link it to this project. Vercel adds a{" "}
          <code>POSTGRES_URL</code> environment variable for you.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }} className="muted">
          Redeploy afterwards so the app picks it up. Tables are created
          automatically on first load.
        </p>
      </div>
    </>
  );
}
