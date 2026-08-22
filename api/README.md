# API

Vercel serverless functions (Node.js) that connect directly to the MariaDB
database over TCP — no separate server to deploy. Vercel builds every file
under `api/` (except the `_lib/` directory, which is shared code, not a
route) into its own function, on the same deployment as the SPA. Because the
frontend and API share an origin, there's no CORS to configure and no
`VITE_API_BASE_URL` needed beyond `/api`.

## Environment variables

Set these in the Vercel project's settings (Production, Preview, and
Development each have their own) — never in a committed file. `.env.local`
works for `vercel dev` locally; it's already gitignored.

| Name | Required | Notes |
|---|---|---|
| `DB_HOST` | yes | The database's hostname, reachable from the public internet. |
| `DB_PORT` | no | Default `3306`. |
| `DB_USER` | yes | |
| `DB_PASS` | yes | |
| `DB_NAME` | yes | |
| `DB_SSL` | no | Set to `false` to disable TLS to the database. Defaults to on. |
| `DB_SSL_REJECT_UNAUTHORIZED` | no | Set to `false` if the host uses a certificate that doesn't chain to a public CA (common on budget DB hosts). Leave unset/`true` when it does. |
| `DB_POOL_SIZE` | no | Default `3`. Each warm serverless instance holds its own pool — the real ceiling on concurrent DB connections is `(concurrent instances) × DB_POOL_SIZE`. Check the database's own connection limit before raising this. |
| `TOKEN_TTL_DAYS` | no | Default `90`. How long a session cookie stays valid. |
| `SIGNUP_INVITE_CODE` | no | If set, `/api/auth/register` rejects any request whose `inviteCode` doesn't match — a simple gate against open registration on a public domain. **Leaving it unset means anyone who finds the URL can create an account.** Registration is still rate-limited per IP either way, but for anything beyond a private/household deployment, set this. |

## Local development

Two ways to run this locally:

- `npm run dev` (plain Vite) — no API, no database. `VITE_API_BASE_URL` is
  unset, so the app runs in local-only mode (see `src/lib/storage.js` and
  `src/lib/exportImport.js`). This is the normal day-to-day workflow for
  frontend work.
- `vercel dev` — serves the SPA and the `/api` functions together on one
  origin, same as production. Needed to test login, sync, or anything under
  `api/`. Requires a `.env.local` with the table above filled in and
  `VITE_API_BASE_URL=/api`.

## Request/response shape

Every route returns `application/json`. Errors are always
`{ "error": "<code>", "message": "<text>" }` with a matching HTTP status — a
raw database error never reaches the client; it's logged via
`console.error` (visible in the Vercel function logs) instead.

Auth is a session cookie (`gc_session`, httpOnly + Secure + SameSite=Lax),
set by `/auth/register` and `/auth/login`, cleared by `/auth/logout`. There's
no bearer token in the client at all — same-origin `fetch` sends the cookie
automatically, which is also why this only works when the SPA and the API
are the same Vercel deployment.

See `TASK-DATABASE.md` §5 for the full endpoint table and the two
serialisation traps (`s1`/`s2` as strings, array order as data) that
`api/_lib/serializer.js` exists to get right.
