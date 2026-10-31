# Public launch plan (Supabase, consent, game modes first)

Status: agreed. Phase 1 (Supabase foundation) is built; phases 2 onwards are not.
Replaces the earlier league plan.

Garden Cup is a trading name of **ZD Wholesale Limited**, the data controller.

## What changed and why

The earlier plan spent most of its effort on a full league system (teams,
squads, fixtures). The review concluded that free, established tools already
do this (FA Full-Time, Spond, LeagueRepublic), it serves a different customer
from the game modes, and the game modes are what makes Garden Cup different.
So:

| Topic | Decision |
|---|---|
| Leagues | **Dropped.** History and the Wins table already give a running all-time table. A light "Season" view may come later if users ask. |
| Database | Supabase Postgres. MariaDB is removed. |
| Auth | Supabase Auth. (WorkOS is no longer used.) |
| API | `api/` stays and is the only path to the database. |
| Game modes | Created by us only. Users play our modes; there are no user-made modes or rule decks, so no user content to moderate. |
| Payments | Later. Nothing in this plan depends on the model chosen. |
| Sign-up | Adult account holder, parental/guardian safeguarding consent, Terms and Privacy Policy accepted at sign-up. |
| Content | Every mode audited for suitability: see [`MODE-AUDIT.md`](MODE-AUDIT.md). |

## Who the account is for

**One adult account holder (18+), usually a parent or carer.** Children play
on that adult's device and appear only as names inside a tournament. Children
never have their own login.

This is what keeps safeguarding manageable. If children could sign up
themselves, the UK Children's Code would apply to the whole service, and
under-13s would need verified parental consent: a parent-email approval
flow, age-appropriate defaults everywhere, and more. That can be revisited
later, but it is a separate project.

## Architecture

```
Browser (React SPA, localStorage first, works offline)
   │  same-origin fetch /api/*  (httpOnly session cookie, no token in JS)
   ▼
api/*  (Vercel functions)
   │  @supabase/ssr: signs in/out with Supabase Auth, refreshes the session
   │  queries as the signed-in user, so RLS applies too
   ▼
Supabase: Auth + Postgres (RLS: a row is visible only to its owner)
```

- **The front end barely changes.** `api/auth/register|login|logout|me` keep
  their URLs and response shapes. Only their insides move from scrypt and
  MariaDB to Supabase Auth. Sign-up now waits for the email link
  (`/api/auth/confirm`). The browser never holds a Supabase key, and the
  CSP (`connect-src 'self'`) stays as it is.
- **Defence in depth:** the API queries with the user's session, not the
  service key, so Postgres row-level security (`user_id = auth.uid()`) still
  blocks a bug in a handler from reading someone else's data. The service key
  will be needed only for account deletion (phase 2).
- **Simpler storage:** tournaments and history are stored as `jsonb`
  documents, which is lossless by construction. `api/_lib/serializer.js`
  (about 400 lines) and its mapping tables are deleted.
- **Offline-first stays:** `syncEngine`, the outbox and the conflict banner
  keep working against the same API contract.
- **Moving local data in:** the existing "ask before importing this device's
  data" flow (`src/lib/reconcile.js`) is reused unchanged.

### Schema (`supabase/migrations/`)

```
tournaments         id, user_id, client_id, mode, state jsonb, history_saved, status, version   (phase 1)
tournament_history  id, user_id, client_id, mode, played_at, record jsonb                      (phase 1)
consents            id, user_id, kind (terms|privacy|guardian|age18), version, accepted_at      (phase 2)
```

RLS is on for every table, and each policy is owner-only. Deleting the auth
user cascades to everything. The display name lives on the Supabase user
(`user_metadata.display_name`), so there is no separate profiles table.

Env vars: `SUPABASE_URL` and `SUPABASE_ANON_KEY` (server-side only).
`SUPABASE_SERVICE_ROLE_KEY` arrives with account deletion in phase 2.

## Sign-up, consent and legal

### The sign-up form
1. Email, password, display name. Supabase sends a confirmation email, and
   the account is not active until it is confirmed.
2. Three separate, unticked checkboxes (all required):
   - **"I am 18 or over."**
   - **"I am the parent or guardian of any child whose name I add, or I have
     their parent's or guardian's permission. I will only add first names or
     nicknames."** (the safeguarding consent)
   - **"I agree to the [Terms of Use] and have read the [Privacy Policy]."**
3. Each accepted item is written to `consents` with the document version and
   a timestamp. When a document's version changes, the user is asked to accept
   again at their next sign-in before they can continue.

### Documents to publish (static pages, linked from sign-up and the footer)
- **Privacy Policy**: what is stored (email, display name, the names typed
  into tournaments, scores), why, where (Supabase region, chosen as UK/EU),
  processors (Supabase, Vercel), retention, deletion, and contact details.
- **Terms of Use**: adults only, accounts are personal, acceptable use
  (no real surnames, contact details or anything identifying a child),
  play-safely disclaimer (garden games carry normal physical risk;
  supervise children), and liability limits.
- **Safeguarding statement**: children never hold accounts; names only; no
  photos; nothing is public; how to report a concern and how to remove data.
- **Cookie notice**: one essential session cookie, no tracking cookies. With
  only essential cookies there is no cookie banner.

The text of these needs review by someone qualified. This plan is not legal
advice. Also check whether the business must pay the UK ICO data protection
fee; most organisations that process personal data do.

### Data rights built into the app
- **Delete my account**: removes everything immediately (cascade), from
  Settings.
- **Download my data**: the existing JSON export, available to signed-in users.
- **Data minimisation**: player names are capped at 24 characters, and the UI
  hint says "First name or nickname". There are no other fields about players.

## Delivery phases

Each phase is its own PR with tests, merged in order.

1. **Supabase foundation** (built): migrations, RLS and the
   `save_current_tournament` function in `supabase/migrations/`; `api/`
   rewritten on `@supabase/ssr` with the same endpoints, plus email
   confirmation. MariaDB, `migrations/`, `serializer.js` and the custom auth
   are removed. Access rules are tested on a real Postgres (`npm run test:db`,
   also in CI).
2. **Sign-up consent and legal pages**: the consent checkboxes, the `consents`
   table, re-consent on a version change, the Privacy, Terms, Safeguarding
   and Cookie pages, and account deletion.
3. **Content fixes from the audit**: the "Change" and "Add" items in
   `MODE-AUDIT.md` (heading rule, face-height keeper rules, open-ended
   forfeit, borrowed card-game names, food and exercise stakes), plus age
   labels on each mode.
4. **Learn what people do**: cookieless, privacy-friendly analytics counting
   modes played, tournaments finished and return visits. Never names or
   free text.
5. **Share card** (optional): an image of a finished tournament that the user
   chooses to share. Names are shown as typed, and the user can switch them to
   initials before sharing.
6. **Payments** (later): an `entitlements` table and a `premium` flag on the
   mode contract. Whatever the model, never sell randomised content
   (no paid random rule packs); see the audit.

## Decided
- **No existing MariaDB users**: nothing to copy across; everyone starts fresh.
- **Supabase region**: London (eu-west-2).
- **Data controller**: ZD Wholesale Limited, trading as Garden Cup.

## Still open
1. The contact email for privacy and safeguarding requests (needed for the
   policies in phase 2).
