# Deployment

Garden Cup is one deployment: a Vercel project that serves the built SPA as
static assets and the API under `api/` as serverless functions, on the same
origin. There is no separate host, no CORS to configure, and (per
[`vercel.json`](vercel.json)) a build command, output directory, and security
headers pinned explicitly rather than left to auto-detection.

A database is optional — see the README's **Data & persistence** section.
Skip straight to [Front end only](#front-end-only) if you don't need
accounts or cross-device sync.

## Prerequisites

- A [Vercel](https://vercel.com) account with this repo connected (import it
  from GitHub — Vercel auto-detects the Vite framework, and `vercel.json`
  pins the build command and output directory regardless).
- If you want cloud sync: a MariaDB (or MySQL-compatible) database reachable
  from the public internet over TCP, secured by credentials and TLS rather
  than an IP allow-list — Vercel serverless functions don't have a fixed
  outbound IP, so an allow-list-only database won't work here.

## Front end only

1. Import the repo into Vercel. Leave the framework preset on its
   auto-detected value (Vite); `vercel.json` already sets the build command
   and output directory.
2. Deploy. `VITE_API_BASE_URL` is unset, so the app runs in local-only mode:
   no accounts, no server calls, `localStorage` is the only store, and the
   export/import buttons are the only way to move data between devices.

That's a complete, working deployment. Everything below is for adding
accounts and cross-device sync on top of it.

## Adding the database

1. **Provision the database** and apply the schema:

   ```bash
   mysql --host=<DB_HOST> --port=<DB_PORT> --user=<DB_USER> -p <DB_NAME> < migrations/001_init.sql
   ```

   See [`migrations/README.md`](migrations/README.md) — the file is
   idempotent, so re-running it is safe.

2. **Set the API's environment variables** in the Vercel project settings
   (**Settings → Environment Variables**), for Production, Preview, and
   Development individually. The full list, with what each one does, is in
   [`api/README.md`](api/README.md): `DB_HOST`, `DB_PORT`, `DB_USER`,
   `DB_PASS`, `DB_NAME`, `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`,
   `DB_POOL_SIZE`, `TOKEN_TTL_DAYS`, `SIGNUP_INVITE_CODE`. None of these are
   prefixed `VITE_` — they're read by the serverless functions only, never
   bundled into the browser build.

3. **Set the front end's environment variable**, also per-environment:

   ```
   VITE_API_BASE_URL=/api
   ```

   This is a same-origin relative path, not a separate host — it exists as a
   variable at all so local-only mode (unset) stays the default for anyone
   who forks this project without setting up a database.

4. **Redeploy.** Environment variable changes don't apply to already-built
   deployments; trigger a new one (push a commit, or use Vercel's "Redeploy"
   action).

5. **Verify**: register an account, confirm the session cookie is set
   (`gc_session`, `HttpOnly`), play a short tournament, and confirm it
   appears in `SELECT * FROM tournaments` on the database. Then log in from
   a different browser and confirm the same data shows up there.

No credential, hostname, or connection string belongs in this repo at any
point — not in a commit, not in a comment, not in an example. Only variable
*names* are documented; values live in Vercel's environment variable store
(or a gitignored local `.env.local` for `vercel dev`).

## Local development

- `npm run dev` — plain Vite dev server, local-only mode (no `api/`
  functions run). This is the normal day-to-day frontend workflow.
- `vercel dev` — serves the SPA and the `api/` functions together on one
  origin, matching production. Needed to exercise login or sync locally;
  requires a `.env.local` with the database variables above and
  `VITE_API_BASE_URL=/api`.

## Rollback

Front end and API are one deployment, so Vercel's standard rollback
(**Deployments → select a previous one → Promote to Production**) reverts
both together — there's no separate "roll back the API" step. A schema
migration is the exception: `migrations/*.sql` files are additive by
convention (see `migrations/README.md`), so rolling back the deployment
after a migration has run does not undo the schema change. Plan migrations
accordingly, and take a database backup before applying one you're not
confident in.

## Custom domain

Vercel's standard flow: **Settings → Domains → Add**, then point the
registrar's DNS at Vercel per its instructions. Because the API is served
from the same domain (`/api/*`), no separate origin or CORS configuration is
needed when the domain changes — everything under the new domain stays
same-origin automatically.
