# API

Vercel serverless functions (Node.js) on the same deployment as the SPA, so
there's no CORS to configure and the front end only needs
`VITE_API_BASE_URL=/api`. Vercel builds every file under `api/` (except
`_lib/`, which is shared code, not a route) into its own function.

Behind them is Supabase: **Supabase Auth** for accounts and sessions, and
**Supabase Postgres** for the data. The browser never talks to Supabase. Each
request builds a Supabase client that acts as the signed-in user
([`_lib/supabase.js`](_lib/supabase.js)), so row-level security in the
database applies to every query, on top of the checks in the handlers.

## Environment variables

Set these in the Vercel project's settings (Production, Preview, and
Development each have their own), never in a committed file. `.env.local`
works for `vercel dev` locally; it's already gitignored.

| Name | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Project Settings → API → Project URL. |
| `SUPABASE_ANON_KEY` | yes | Project Settings → API → the anon (publishable) key. Used server-side only, always with the user's session, so it can only do what row-level security lets that user do. |
| `SUPABASE_SERVICE_ROLE_KEY` | for account deletion | Project Settings → API → the service-role (secret) key. Bypasses row-level security, so it is used in exactly one place: `DELETE /api/account`, after the password is checked, to delete the user (Supabase only lets an admin do that). Without it, that route replies `503` and nothing else changes. |

Without the first two every route replies `503 not_configured`.

## Routes

| Route | Methods | What it does |
|---|---|---|
| `/api/auth/register` | POST | `{email, password, displayName}`. `201 {user}` if signed straight in, or `202 {confirmationRequired: true}` when the email link must be clicked first (the normal case). |
| `/api/auth/confirm` | GET | The link in the confirmation and reset emails. Signs the user in and redirects to `/?confirmed=1` (or `/?reset=1` for a reset), or to `/?confirm_error=1`. |
| `/api/auth/login` | POST | `{email, password}` → `{user}`. |
| `/api/auth/logout` | POST | Ends this device's session, or every session with `{everywhere: true}`. |
| `/api/auth/me` | GET | `{user}` or 401. |
| `/api/auth/forgot` | POST | `{email}` → always `{sent: true}` (so it can't reveal who has an account); emails a reset link. |
| `/api/account` | PATCH, POST, DELETE | My account. PATCH `{displayName}` → `{user}`. POST `{currentPassword, newPassword}` changes the password (`currentPassword` may be left out within an hour of a reset email). DELETE `{password}` deletes the account and, by cascade, all its data. |
| `/api/tournaments/current` | GET, PUT, DELETE | The tournament in progress. PUT is `{expectedVersion, state}` → `{version}`, or `409 {version, state}` when another device saved first. |
| `/api/history` | GET, POST, DELETE | Finished tournaments. POST is idempotent on the record's id. |
| `/api/history/:clientId` | DELETE | One history record. |

## Request/response shape

Every route returns `application/json`. Errors are always
`{ "error": "<code>", "message": "<text>" }` with a matching HTTP status. A
raw database or Supabase error never reaches the client; it's logged via
`console.error` (visible in the Vercel function logs) instead.

Sessions are Supabase Auth cookies, forced `HttpOnly`, `Secure` and
`SameSite=Lax` by `_lib/supabase.js`. Same-origin `fetch` sends them
automatically, so there is no token in the page's JavaScript at all.

## Data

Saved tournaments and history records are each one `jsonb` document, in
exactly the shape the client keeps. [`_lib/state.js`](_lib/state.js) and
[`_lib/historyRecord.js`](_lib/historyRecord.js) validate them first: every
field is either checked or dropped, and nothing that is checked is lost. The
two traps a change there can break (`s1`/`s2` as strings, array order as
data) are documented at the top of `state.js`, and `tests/state.test.js`
plays every mode through to prove the round trip is lossless.

The schema, its row-level security and the `save_current_tournament`
function are in [`../supabase/migrations/`](../supabase/migrations/);
`npm run test:db` runs the access-rule tests against a real Postgres.

## Local development

- `npm run dev` (plain Vite): no API, no database, local-only mode. This
  is the normal day-to-day workflow for frontend work.
- `vercel dev`: serves the SPA and the `/api` functions together on one
  origin, as in production. Needed to test sign-in or sync. Requires a
  `.env.local` with the variables above and `VITE_API_BASE_URL=/api`. Point
  it at a separate Supabase project for development, never production.

## Function count

Each route file is one Vercel serverless function. There are 10; Vercel's
free (Hobby) plan allows 12 per deployment, so prefer adding a method to an
existing route (as `/api/account` does) over a new file.
