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

   - **Email Templates → Reset Password**: the same idea, for "Forgot
     password?". The app opens on My account, ready for a new password:

     ```html
     <a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Set a new password</a>
     ```

   - **SMTP**: set up your own email sender before launch; see
     [How the emails are sent](#how-the-emails-are-sent).
   - **Rate Limits**: see [Rate limits](#rate-limits) for what to change.

4. **Set the API's environment variables** in Vercel (**Settings →
   Environment Variables**), for Production, Preview and Development
   individually: `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` (see [`api/README.md`](api/README.md)). The
   service-role key is only for "Delete my account"; without it that one
   button replies "not set up" and everything else works. Neither is prefixed `VITE_`; they're
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

## How the emails are sent

Garden Cup's own code never sends email. Supabase Auth does, when the API
asks it to:

| What the person does | API route | Supabase sends | Template | The link goes to |
|---|---|---|---|---|
| Creates an account | `POST /api/auth/register` | "Confirm your email" | Confirm signup | `/api/auth/confirm?type=email`, which signs them in and opens Home |
| Taps "Forgot password?" | `POST /api/auth/forgot` | "Reset your password" | Reset Password | `/api/auth/confirm?type=recovery`, which signs them in and opens My account to set a new password |

The wording is edited in the Supabase dashboard (**Authentication → Email
Templates**); only the link in each must match the ones in step 3 above.

**Delivery.** Supabase's built-in sender is for trying things out only: it
sends very few emails an hour and may only deliver to your own team's
addresses. For real users, connect an email provider:

1. Sign up with a transactional email provider (Resend, Postmark, Amazon
   SES and Brevo all work; Resend and Postmark are the quickest to set up).
2. Verify a sending domain with them, e.g. `mail.gardencup.app`. They give
   you DNS records (SPF, DKIM, and ideally DMARC) to add at your domain's
   DNS host. Without these, emails land in spam.
3. In Supabase, **Authentication → Emails → SMTP Settings**: turn on custom
   SMTP and enter the provider's host, port, username and password, a
   sender address such as `no-reply@mail.gardencup.app`, and the sender
   name `Garden Cup`.
4. Send yourself a sign-up and a password reset to check both arrive.

## Rate limits

Two layers, so neither a bot nor a buggy device can hammer the service or
run up email costs:

**1. In the API (built in; nothing to set up).** Every route counts
requests in Postgres (`rate_limit_hit`, in `supabase/migrations/`) and
replies `429 Too Many Requests` with a `Retry-After` header when over:

| What | Limit |
|---|---|
| Sign in | 30 per 15 min per IP address, and 10 per 15 min per email |
| Create an account | 5 per hour per IP address |
| Forgot password | 5 per hour per IP address, and 3 per hour per email |
| Email links opened | 20 per 15 min per IP address |
| Change password / delete account | 10 per 15 min per account |
| Change display name | 20 per hour per account |
| Saving and loading tournaments and history | 600 per 5 min per account (far above real play) |

Only hashes are stored: no email or IP address goes into the table. The
numbers live in `LIMITS` in `api/_lib/rateLimit.js`. If the limiter can't
reach the database, requests are let through rather than locking everyone
out. The app treats a 429 on a save as "try later": the save stays queued
and is retried after the `Retry-After` time, never dropped.

**2. In Supabase Auth (dashboard: Authentication → Rate Limits).**
Supabase counts some limits per IP address, but every request reaches it
from Vercel's servers, so to Supabase all your users share a handful of
addresses. Left at the defaults, a busy evening could hit them for
everyone. So:

- **Raise** the per-IP limits for sign-ins/sign-ups and token
  verifications well above the defaults (for example to their maximum).
  The API's own per-person limits above take over that job.
- **Keep** "emails sent per hour" as a deliberate overall cap. Once your
  own SMTP is connected, set it to what your email provider plan allows
  (for example 100 an hour to start). It caps the damage if anything gets
  past the limits above.

## Deploying database changes

Schema changes are files in `supabase/migrations/`, deployed by
[`.github/workflows/deploy-db.yml`](.github/workflows/deploy-db.yml) when
they reach `main`. Supabase keeps a list of the migrations it has run, so
each deploy applies only the new files, in name order.

**One-time setup.** In GitHub, add these as **secrets** (not variables),
either under **Settings → Secrets and variables → Actions → New repository
secret**, or under **Settings → Environments → `production` → Environment
secrets**. The environment must be named exactly `production`, because the
deploy job uses that one:

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
