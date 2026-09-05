# Sips & Updates

A private web app for the annual life-update round: everyone secretly writes the
drinking-game rules for everyone *else*, near-identical rules get folded
together, and nobody sees their own list until they stand up to present.

- **You never see your own rules.** Your own page is a locked count until you
  tap *I'm presenting*. The server refuses to render your list before then, so
  poking at the URL doesn't help.
- **You see everyone else's.** Add rules, reword them, fold duplicates together.
- **Duplicates get caught twice.** While you type, the app warns if someone
  already wrote something similar; on the page, near-identical rules are flagged
  so anyone can combine them into a single rule with a `×3` badge.
- **Name + PIN.** Each person claims a name and a PIN the first time, so nobody
  can pick up a phone and browse to their own list.

Built for phones — one link, opened in Safari, no app install and no accounts.

## Deploying it

The app needs a Postgres database. Roughly five minutes end to end:

1. Push this repo to GitHub (it already is, if you're reading this there).
2. Go to [vercel.com/new](https://vercel.com/new), import the repo, and deploy.
   The first deploy will succeed but show a "connect a database" screen.
3. In the Vercel project, open **Storage → Create Database → Postgres** (the
   free Neon tier is plenty), and **Connect** it to the project. Vercel adds a
   `POSTGRES_URL` environment variable automatically.
4. Redeploy (Deployments → ⋯ → Redeploy) so the app picks up the variable.

Tables are created automatically the first time the app loads. Send everyone the
URL; each person taps **Add me** to claim their name and PIN.

### Optional environment variables

| Variable | What it does |
| --- | --- |
| `POSTGRES_URL` | Postgres connection string. `DATABASE_URL` also works, so Supabase/Neon/Railway are fine. **Required.** |
| `GROUP_PASSCODE` | If set, a new person must type this passcode to join. Stops a stray link-forward from adding a stranger. |
| `APP_SECRET` | Signs the login cookie. Defaults to a value derived from the database URL, which is fine for one weekend. |

### If a deploy fails

Vercel runs the build, then refuses to publish an app on a Next.js release with a
known CVE — the log ends with `Vulnerable version of Next.js detected` *after*
`Build Completed`. Bump `next` in `package.json` to the newest patch release and
push; the dependency is on a caret range so `npm install` picks up patches on its
own.

Note that **Redeploy** on a failed deployment rebuilds that same commit. To pick
up a fix, deploy the new commit instead.

### Running it locally

```bash
npm install
echo 'POSTGRES_URL=postgresql://localhost:5432/sips' > .env.local
npm run dev
```

## How the secret is kept

Each person's list is filtered out server-side, not hidden with CSS — `/p/<your
own id>` redirects to your locked page, and the count is the only thing that
crosses the wire. PINs are stored as salted scrypt hashes and the login cookie
is signed and `httpOnly`.

It is still a party game among friends, not a vault: anyone with database access
can read everything, and nothing stops someone from reading over your shoulder.

## Resetting between years

```sql
truncate rules, players cascade;
```

Or drop just the rules and keep the roster:

```sql
truncate rules;
update players set revealed_at = null;
```
