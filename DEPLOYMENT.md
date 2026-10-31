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
- If you want accounts and cloud sync: a [Supabase](https://supabase.com)
  project. Garden Cup's is in **London (eu-west-2)**; keep it there, since
  the Privacy Policy says that's where the data lives.

## Front end only

1. Import the repo into Vercel. Leave the framework preset on its
   auto-detected value (Vite); `vercel.json` already sets the build command
   and output directory.
2. Deploy. `VITE_API_BASE_URL` is unset, so the app runs in local-only mode:
   no accounts, no server calls, `localStorage` is the only store, and the
   export/import buttons are the only way to move data between devices.

That's a complete, working deployment. Everything below is for adding
accounts and cross-device sync on top of it.

## Adding accounts and sync (Supabase)

1. **Create the project** in the Supabase dashboard, region **London
   (eu-west-2)**. Keep the database password somewhere safe; nothing in this
   repo needs it.

2. **Connect the migration deploy** (see [Deploying database changes](#deploying-database-changes)
   below): add the three repository secrets, then run the **Deploy database**
   workflow once from the Actions tab. That applies every file in
   `supabase/migrations/`; you never paste SQL into the dashboard.

3. **Configure Auth** (Authentication in the dashboard):
   - **Providers**: Email on, **Confirm email on**. Leave every other
     provider off.
   - **Password**: minimum length 10 (the API checks the same).
   - **URL Configuration**: Site URL = the production URL (e.g.
     `https://gardencup.app`). Add each preview URL you sign in on to
     Redirect URLs.
   - **Email Templates → Confirm signup**: point the link at the API, which
     signs the user in on their own device:

     ```html
     <a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
     ```

   - **SMTP**: set up a custom SMTP sender before launch. Supabase's built-in
     email is for testing only and sends just a handful of emails an hour,
     which will block real sign-ups.

4. **Set the API's environment variables** in Vercel (**Settings →
   Environment Variables**), for Production, Preview and Development
   individually: `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see
   [`api/README.md`](api/README.md)). Neither is prefixed `VITE_`; they're
   read by the serverless functions only. Use a separate Supabase project
   for Preview/Development so test accounts never mix with real ones.

5. **Set the front end's environment variable**, also per environment:

   ```
   VITE_API_BASE_URL=/api
   ```

   This is a same-origin relative path, not a separate host. It exists as a
   variable at all so local-only mode (unset) stays the default for anyone
   who forks this project without setting up a backend.

6. **Redeploy.** Environment variable changes don't apply to already-built
   deployments; trigger a new one (push a commit, or use Vercel's "Redeploy"
   action).

7. **Verify**: create an account, click the link in the email, and confirm
   you land in the app signed in. Play a short tournament and check it
   appears in the `tournaments` table (Table Editor). Sign in from a
   different browser and confirm the same data shows up there.

No credential, hostname, or connection string belongs in this repo at any
point: not in a commit, not in a comment, not in an example. Only variable
*names* are documented; values live in Vercel's environment variable store
(or a gitignored local `.env.local` for `vercel dev`).

## Deploying database changes

Schema changes are files in `supabase/migrations/`, deployed by
[`.github/workflows/deploy-db.yml`](.github/workflows/deploy-db.yml) when
they reach `main`. Supabase keeps a list of the migrations it has run, so
each deploy applies only the new files, in name order.

**One-time setup.** In GitHub, **Settings → Secrets and variables → Actions
→ New repository secret**, add:

| Secret | Where it comes from |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase dashboard → your avatar → **Account → Access Tokens → Generate new token** |
| `SUPABASE_PROJECT_ID` | The production project's ref: **Project Settings → General → Project ID** (also the `xxxx` in `xxxx.supabase.co`) |
| `SUPABASE_DB_PASSWORD` | The database password chosen when the project was created (reset it under **Project Settings → Database** if lost) |

Then **Actions → Deploy database → Run workflow** once to create the tables.

**Every change after that (works from a phone):**

1. Ask Claude (in the Claude app) for the change. It adds a new migration
   file, adds checks to `supabase/tests/rls.sql` where access rules change,
   and opens a pull request.
2. CI runs the migrations and the access tests on a throwaway Postgres.
3. Merge the pull request in the GitHub app.
4. **Deploy database** runs: the tests again, a dry run listing what will
   be applied (visible in the job log), then the real push. A failed
   migration is rolled back and the job goes red; GitHub emails you.

**Rules that keep this safe:**

- **Never change the schema in the Supabase dashboard** (Table Editor or
  SQL editor). The files in the repo are the only source of truth; a
  dashboard edit makes production differ from what the tests check.
  Looking at data in the dashboard is fine.
- **Never edit or rename a migration that has been deployed.** Fix it with
  a new, later file.
- **Additive first.** Vercel deploys the app at the same moment the
  migration runs, so a release must work with both the old and new schema
  for a minute: add columns or tables in one release, start using them in
  the same or a later one, and only remove things in a later release still.
- **Preview/development project**: run the workflow by hand against it if
  needed by temporarily pointing the secrets at it, or apply migrations to
  it with `supabase db push --project-ref <dev-ref>` from a computer.

Optional: GitHub can require an approval before the deploy job runs
(**Settings → Environments → production → Required reviewers**). On a
private repository this needs a paid GitHub plan.

## Local development

- `npm run dev` — plain Vite dev server, local-only mode (no `api/`
  functions run). This is the normal day-to-day frontend workflow.
- `vercel dev` — serves the SPA and the `api/` functions together on one
  origin, matching production. Needed to exercise login or sync locally;
  requires a `.env.local` with the Supabase variables above and
  `VITE_API_BASE_URL=/api`.
- `npm run test:db` checks the migrations and their access rules against a
  local Postgres (see the README's Testing section).

## Rollback

Front end and API are one deployment, so Vercel's standard rollback
(**Deployments → select a previous one → Promote to Production**) reverts
both together — there's no separate "roll back the API" step. A schema
migration is the exception: rolling back the deployment after a migration
has run does not undo the schema change, so keep migrations additive (a new
column or table, never a dropped one, in the same release as the code that
uses it). Plan migrations
accordingly, and check Supabase's backups (Database → Backups) before applying one you're
not confident in.

## Custom domain

Vercel's standard flow: **Settings → Domains → Add**, then point the
registrar's DNS at Vercel per its instructions. Because the API is served
from the same domain (`/api/*`), no separate origin or CORS configuration is
needed when the domain changes — everything under the new domain stays
same-origin automatically.
