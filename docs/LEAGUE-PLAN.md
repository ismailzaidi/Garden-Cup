# Leagues + public launch (Supabase, WorkOS) — plan

Status: draft for sign-off. Nothing here is built yet.

## Decisions already made

| Topic | Decision |
|---|---|
| Database | Supabase Postgres. MariaDB is removed. |
| API | `api/` serverless functions stay. They are the **only door** to the database. |
| Auth | WorkOS (AuthKit). The custom scrypt/cookie auth is removed. |
| Visibility | Chosen per league: **Public** (anyone with the link can view) or **Private** (invite only). |
| League vs game modes | A League is a new top-level thing. The nine game modes stay as standalone quick tournaments. Fixtures in a league can optionally be played with a mode's rules (Chaos/Horror cards). |
| Teams | Organiser adds teams and can send an invite link so a manager can edit their own squad. |
| Points | Configurable per league. |
| Extra stats | Appearances/lineups, clean sheets, man of the match, team form, head-to-head. No assists. |
| Offline | League scoring stays offline-first. |
| Child data | Players (some under 18) are stored by **name only**. See "Privacy". |

## Architecture

```
Browser (React SPA, localStorage + outbox)
   │  WorkOS AuthKit login (hosted)   │  same-origin fetch /api/*
   ▼                                  ▼
WorkOS  ──session cookie──▶  api/*  (verifies session, checks role)
                                  │  supabase-js, server-only service key
                                  ▼
                             Supabase Postgres
                             (RLS ON, no anon/authenticated policies = deny all)
```

- The browser never holds a Supabase key. RLS is enabled on every table with no
  policies, so a leaked anon key reads nothing. The service key lives only in
  Vercel env vars.
- Authorisation is in `api/_lib/` (one `can(user, action, league)` helper),
  not scattered through handlers.
- Public leagues are served by read-only `api/public/*` routes returning a
  sanitised shape, cacheable at the edge. Private leagues need a session
  that is a member of the league.
- Use supabase-js over HTTPS rather than raw TCP: no connection-pool problem
  on serverless. Multi-step writes (generate fixtures, finalise a match) are
  Postgres functions called via RPC so they are transactional.

### WorkOS
- `api/auth/login` → redirect to AuthKit; `api/auth/callback` exchanges the
  code and sets a sealed, httpOnly session cookie; `logout` and `me` stay.
- `users` table is keyed by `workos_user_id`, created on first callback.
- New env vars: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`,
  `WORKOS_REDIRECT_URI`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  Remove the `DB_*`, `TOKEN_TTL_DAYS` and `SIGNUP_INVITE_CODE` vars.
- Accounts are for **adults only** (organisers and managers). Players do not
  have accounts.

## Data model

Leagues are fully relational, because we aggregate over them. Standalone
tournaments and history become `jsonb` documents. That is lossless by
construction and lets us delete the 400-line `serializer.js`.

```
users            id, workos_user_id, display_name, created_at
leagues          id, slug, name, owner_id, visibility(public|private), status(draft|active|complete),
                 legs, rules jsonb, season_label, created_at
league_members   league_id, user_id, role(owner|manager), team_id?    -- invites via token
league_invites   token_hash, league_id, team_id, expires_at
teams            id, league_id, name, colour, manager_user_id?
squad_players    id, team_id, name, sort_order        -- NAME ONLY, nothing else
fixtures         id, league_id, round, leg, home_team_id, away_team_id, scheduled_for?, mode_key?, status
matches          fixture_id, home_goals, away_goals, home_pen, away_pen, motm_player_id?, played, version
lineups          fixture_id, player_id, team_id                -- appearances
match_events     id(client ulid), fixture_id, type(goal|yellow|red), player_id, second, deleted
tournaments      id, user_id, client_id, mode, state jsonb, version, history_saved   -- standalone modes
tournament_history id, user_id, client_id, record jsonb, finished_at
```

`rules jsonb` holds the points config (below). Scores in `matches` are derived
from `match_events` on finalise, so two devices cannot disagree.

### Points and table
- Per-league rules: points for win / draw / loss (default 3/1/0), optional
  bonus points, red-card deduction on/off, ordered tie-breaks
  (goal difference, goals for, head-to-head, then name).
- `computeStandings` (`src/engine/standings.js`) gains a `rules` argument with
  today's behaviour as the default, so existing modes and tests do not change.
- The table is computed from fixtures on read (small data, no stored table to
  go stale). Form, head-to-head, clean sheets, appearances and top scorers
  come from the same pass.

### Offline-first scoring
- Every league write is an **idempotent operation** with a client-generated
  id (goal, card, lineup change, full time). Operations go into a local outbox
  and replay in order when online; replaying is safe.
- Goals and cards are append-only `match_events`, so two people scoring the
  same match merge instead of overwriting. Full time is a versioned write; a
  stale version returns a conflict the UI can show (reusing the existing
  `ConflictBanner`).
- The existing `syncEngine`/`reconcile` code is reworked for per-operation
  sync of leagues. Standalone modes keep the current whole-state sync, pointed
  at the new `tournaments` table.

### Moving local data into the database
- After first sign-in, an **Import this device's data** screen lists the
  tournament in progress and the number of History records and asks first,
  as the app does today. Nothing is uploaded silently.
- Import is idempotent on `client_id`, so tapping it twice, or importing on
  two devices, creates no duplicates.
- The JSON export/import files keep working as a manual backup.

## Privacy (under-18 data)

This is a launch blocker, not a polish item.

- **Name only.** One free-text name per player, no surname field, DOB, photo,
  contact details, school or free-text notes. Guidance in the UI suggests
  first name or nickname. No analytics or tracking scripts.
- Players have no accounts. Only adults (organiser, manager) sign up.
- **Privacy policy page** linked from the footer, the sign-in screen and
  the invite page. It states what is stored, why, where (host region), who
  processes it (Supabase, WorkOS, Vercel), retention, and how to request
  deletion.
- Managers confirm when adding a squad: *"I am the parent/guardian or have
  the permission of the parents/guardians of these players."*
- Delete controls: remove a player, remove a team, delete a league, and delete
  my account. All cascade and are honoured in the database, not just hidden.
- Public leagues show player names. The organiser can switch a league's public
  view to **first name + initial** or **hide player names** (team stats only).
- Cookies: one essential session cookie only.
- A short data-processing record and a retention rule (e.g. inactive leagues
  are archived, then deleted after N months) so there is something to point to.
- The policy text should be reviewed by someone qualified. It is not legal advice.

## Delivery phases

1. **Foundation**: `supabase/migrations/` with the schema and RLS-deny-all,
   `api/_lib/db.js` on supabase-js, WorkOS login/callback/me/logout, `users`
   table. Remove MariaDB, `migrations/`, `mariadb` dep. Update `DEPLOYMENT.md`
   and `api/README.md`.
2. **Standalone sync on Postgres**: tournaments and history as jsonb; keep the
   existing sync engine and its tests green; add the import-local-data screen.
3. **Leagues core**: create league, rules, legs, teams, squads, fixture
   generation (reusing `generateGroupMatches` for legs and home/away fairness),
   fixtures list, score entry, table.
4. **Offline operations + conflicts** for league scoring.
5. **Stats**: lineups, clean sheets, MOTM, form, head-to-head, top scorers, cards.
6. **Sharing**: public/private, invite links for managers, public read routes,
   name-display setting.
7. **Privacy and launch**: policy page, consent checkbox, delete flows,
   rate limiting on public routes, security review, production checklist.

Each phase is its own PR with tests. Phases 1–2 ship without any visible
league UI, which keeps the migration off the critical path of the new feature.

## Testing
- Vitest unit tests for configurable standings, form, head-to-head and
  fixture generation (legs 1–4, odd team counts, byes).
- Handler tests for auth and permission cases: other user's league, manager
  editing another team, private league read as anonymous, expired invite.
- A schema test that runs the migrations on a local Supabase and asserts that
  the anon key can read nothing.
- Outbox tests: replay twice gives the same result, out-of-order replay, and a
  conflict on full time.

## Still open
See the questions at the end of the conversation.
