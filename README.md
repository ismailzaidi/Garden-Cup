# Garden Cup

[![CI](https://github.com/ismailzaidi/Garden-Cup/actions/workflows/ci.yml/badge.svg)](https://github.com/ismailzaidi/Garden-Cup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A 1v1 football tournament tracker for garden matches. Eleven game modes,
per-match timers that tick out the final ten seconds aloud, goal-minute
logging, top-scorer stats, and persistent history — installable as a
home-screen app and built to keep working on a phone with a weak signal.

## Modes

- **League + Final** — round robin (1–4 legs), top 2 play a final
- **Pure League** — round robin, top of the table wins
- **Knockout** — randomised single-elimination bracket with automatic byes
- **Winner Stays On** — king defends the pitch, challengers queue up
- **Best of N** — two players, a fixed number of legs (3, 5, or 7), most points wins
- **Garden World Cup** — two groups, then semi-finals, a third-place playoff, and the final
- **Golden Boot Race** — first player to score N goals in total takes the boot
- **Last One Standing** — everyone plays everyone, bottom of the table goes out each round
- **Penalty Shootout Cup** — a knockout bracket decided entirely on penalties
- **Chaos Cup** — round robin where every match is dealt a random silly rule
- **League + Chaos** — round robin played straight, then a final where every leg has a random silly rule

Fixtures give every player a fair share of home starts: nobody sits through a
whole tournament kicking off away from home (see `generateGroupMatches` in
[`src/engine/match.js`](src/engine/match.js)).

New modes are a self-contained file plus one registry line — see
[`docs/ADDING-A-MODE.md`](docs/ADDING-A-MODE.md) and the contract it
implements, [`src/modes/contract.md`](src/modes/contract.md).

## Architecture

```
  Browser (phone/tablet) ── static assets + same-origin fetch ──▶ Vercel
                                                                     │
                                    Vite/React SPA  +  api/*  (Node.js serverless)
                                                                     │
                                                          TCP, TLS, mariadb driver
                                                                     ▼
                                                          MariaDB (optional)
```

The frontend and API are one Vercel deployment — no separate host, no CORS,
no cross-origin auth token. A database is entirely optional (see
**Data & persistence** below); without one, this is a static SPA with zero
backend at all.

| Layer | Tech |
|---|---|
| UI | React 18, Vite 5, Tailwind CSS |
| State/persistence engine | Plain hooks (`src/engine/`) — no external state library |
| API | Node.js serverless functions (`api/`), no framework |
| Database | MariaDB, plain parameterised SQL, no ORM |
| Auth | httpOnly session cookie, scrypt password hashing — no auth library |
| Tests | Vitest + Testing Library |

## Run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173 in local-only mode (see below) — no database
or environment variables required.

## Testing & linting

Tests live in [`tests/`](tests/), one folder, separate from the source
they exercise — not scattered as `*.test.js` files next to their subjects.

```bash
npm run lint    # ESLint
npm run test    # Vitest, once
npm run test:watch
npm run build   # production build
```

All four run in CI on every push and pull request
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Tests cover the
tournament engine (standings, fixture generation, undo), every game mode's
fixture/advancement logic, the v1→v2 save-state migration, the client/server
mode registry staying in sync, and a full playthrough of the app through
Testing Library.

## Data & persistence

A database is optional. Every state change writes to the browser's
`localStorage` first (keys `gardenCup:current` and `gardenCup:history`) — that
write is synchronous and never depends on a network call, so the app works
fully offline and requires nothing else to run at all.

**Local-only mode (default):** if `VITE_API_BASE_URL` isn't set, that's the
whole story — no accounts, no server, data lives only on this device. Use the
export/import buttons (top of the app) to move data to another device or keep
a manual backup: export downloads a JSON file of the current tournament and
full history; import restores from one. Nothing is ever deleted silently by
either action.

**Cloud sync (optional):** set `VITE_API_BASE_URL=/api` and deploy the
serverless functions under `api/` (see [`api/README.md`](api/README.md)) to
add accounts and cross-device sync against a MariaDB database.
`localStorage` stays the write-through cache either way — sign-in adds a
background sync on top of it, it doesn't replace it. A phone that loses
signal mid-tournament keeps working normally; goals sync once the connection
comes back. On first sign-in on a new device, existing local data is never
imported automatically — you're asked first.

Clearing browser data (or never configuring an API at all) erases anything
that hasn't been exported or synced.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full runbook — Vercel project
setup, environment variables, applying the database schema, rollback, and
custom domains.

## Add to home screen

The app ships a web manifest, so on iOS (Share → Add to Home Screen) or
Android (menu → Install app) it launches fullscreen like a native app and
works offline after first load.

## Audio note

Browsers block sound until the user interacts with the page. The app unlocks
audio on the first tap, so tap anything once before relying on the 10-second
warning beep.

## License

[MIT](LICENSE)
