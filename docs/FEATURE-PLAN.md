# Feature plan: countdown sound, guaranteed home starts, League + Chaos

**Status: all three shipped.** Where the built version departs from the
original plan, the section below says so and why — the descriptions here
match the code as it stands.

Three changes, in the order they should be built. The first two are
self-contained engine changes; the third is a new game mode that follows
[`ADDING-A-MODE.md`](./ADDING-A-MODE.md) and the contract in
[`src/modes/contract.md`](../src/modes/contract.md), plus one deliberate
piece of code movement (the chaos twist deck becomes shared).

---

## 1. Audible countdown through the final 10 seconds

### Today

`src/engine/useTimers.js` plays `playCountdownRing()` exactly **once**, on the
first tick where `remaining <= 10` (gated by `warnedRef`), then nothing until
the full-time `playBeep()` at zero. If you miss that single ring — phone in a
pocket, players shouting — the final 10 seconds are silent.

### Required behaviour

When a running match timer reaches 10 seconds or less, it must play a sound
**every second** until it either expires or is paused:

- At each of the last 10 seconds (10, 9, 8, … 1): a short, sharp tick.
- At 0: the existing full-time `playBeep()` (unchanged).

### Changes

**`src/engine/audio.js`** — add one function:

```js
export function playCountdownTick() {
  // one short, loud tone per call — distinct from the goal chime
  // (triangle/soft) and the full-time beep (triple square).
  // e.g. a single 1200 Hz square tone, ~0.15s, vol ~0.25.
}
```

`playCountdownRing()` turned out to have no other caller, so it was removed
rather than left exported and dead.

**`src/engine/useTimers.js`** — in the 1-second interval, replace the
once-only `warnedRef` gate with a per-second gate:

- Track the last second a tick was played per timer id (e.g.
  `lastTickRef.current[id] = remaining`), and play `playCountdownTick()`
  whenever `running && remaining >= 1 && remaining <= 10` and this
  `remaining` value hasn't ticked yet for this id. The dedup matters because
  `setInterval` jitter can deliver two callbacks inside the same displayed
  second.
- Reset the per-id tick tracking in the same places `warnedRef` is reset
  today: `startTimer`, `resetTimer`, `setTimerDuration`, `clearTimers`.

### Edge cases (must all hold)

- **Pause inside the final 10** → ticks stop immediately; **resume** → ticks
  continue from the current second (do not replay seconds already ticked
  unless the timer was reset).
- **Duration set to 10s or less** and started → ticks from the very first
  second.
- **Two timers running at once** → each ticks independently (same as the
  current beep behaviour).
- Audio must stay wrapped in try/catch and route through `unlockAudio()`,
  as every function in `audio.js` already does — no crash on iOS before the
  first user gesture.

### Tests

Extend `tests/useTimers.test.js` (fake timers, mock `audio.js`):

- Start a 15s timer, advance 15 ticks → `playCountdownTick` called exactly
  10 times (at 10..1), `playBeep` once at 0.
- Pause at 7s remaining, advance 5s → no further ticks; resume → ticks
  resume at 7, 6, …
- Reset then start again → ticks fire again for the new run.

---

## 2. Guaranteed home start for every player

### Today

`p1` is the home/left slot on `MatchCard` (it's what `homeTag` labels, and
whoever kicks off). Every fixture generator decides it with
`randomOrder(a, b, rng)` — an independent coin flip per match
(`src/engine/match.js:16`). Nothing stops a player from drawing the away
slot in *every* match of their tournament.

### Required behaviour

Within a tournament's initial fixtures, **every player who has two or more
matches must be `p1` (home) at least once**. Stronger target, which implies
it: keep each player's home and away counts within 1 of each other across
the matches the generator creates.

**Documented exception:** when a player's entire tournament is a single
match (e.g. 2 players × 1 leg in Round Robin), one of the two must start
away — mathematically unavoidable. The coin flip stands there.

### Changes

**`src/engine/match.js` — `generateGroupMatches`** (this one function covers
`league`, `roundrobin`, `chaos`, `goldenboot`, `survivor`, `leaguechaos`, and
the World Cup groups, per `contract.md`):

1. Keep the existing pair-building and per-leg `shuffle` of match order.
2. Seat the players in a **random circle** — one `shuffle(players, rng)` per
   tournament — and let the shorter way round host. A pair sat exactly
   opposite (only possible on an even roster) is settled by seat order.
3. Play every **even-numbered leg the other way round**, so a player who
   hosted more often in leg 1 travels more often in leg 2.

*Changed from the plan:* the plan called for a greedy "lowest home count
hosts" rule plus a fix-up pass for anyone left on zero. That guarantees the
floor — everyone gets a home start — but not the stronger property the tests
below assert, and it demonstrably loses: with four players it can leave a
player 0 home / 3 away whenever they draw the first fixture against each
opponent and lose all three tie-breaks. The circle rule is *provably* within
one either way, because each seat hosts every player within half a lap and
travels to the rest, and the alternating legs cancel the odd-leg remainder.
The randomness lives in the seating draw rather than in each match, so
fixtures stay seedable and no player is favoured by roster order.

**Two-player leg sets** — `bestofn.jsx`'s `createFixtures` and `league.jsx`'s
`generateFinalMatches` coin-flipped each leg independently. Both now use a
shared `alternateHome(a, b, legCount, rng)` in `engine/match.js`: one flip
picks who hosts leg 1, then it alternates. It lives in `engine/` rather than
in either mode file because three modes need it (Best of N, the league final,
and the new chaos final) — the same rule the contract applies to any helper a
second mode reaches for. Best of 3 gives one player 2 homes and the other 1,
which is the best possible; nobody plays a 3+ leg series entirely away.

**Out of scope, on purpose:**

- `king.jsx` — the king is always `p1` by design (`homeTag="KING"`).
- `knockout.jsx` / `penalties.jsx` round 1 — each player has exactly one
  match per round, so the exception applies; a cross-round alternation is a
  possible follow-up, not part of this change.

### Tests

Extend `tests/match.test.js` with a seeded rng:

- 4 players × 1 leg (3 matches each): every player has ≥1 home match; run
  across many seeds, not one lucky seed.
- Home/away counts per player differ by at most 1 for several player counts
  and leg counts (3–8 players × 1–3 legs).
- 2 players × 3 legs (`bestofn` and league final generators): home alternates
  leg to leg.
- Existing invariants still hold: every pair meets `legCount` times, match
  count is unchanged, same-seed generation is deterministic.

---

## 3. New mode: League + Chaos

### Concept

Exactly League + Final's shape — a round-robin group stage under normal
rules, then the top 2 meet in a multi-leg final — except **every final leg
is dealt a random twist from the Chaos deck**. The group stage is played
straight; the chaos is the prize for reaching the final.

### Step 0 — promote the twist deck to shared code

`chaos.jsx` privately owns `TWISTS`, `dealTwists`, `twistOf`, and the
`TwistBanner` component. The contract is explicit: the moment a second mode
needs them they move to shared code rather than being imported across mode
files (the same move that created `engine/bracket.js` when `penalties`
needed `knockout`'s bracket):

- `TWISTS`, `dealTwists`, `twistOf` → new **`src/engine/twists.js`**.
- `TwistBanner` → new **`src/components/TwistBanner.jsx`** (it's a dumb
  presentational component; it belongs with the others).
- `chaos.jsx` switches to importing both; re-export from `chaos.jsx` only if
  `tests/chaos.test.js` imports the deck from there, otherwise update the
  test imports.
- Update the "what is shared" list in `contract.md`.

### The mode file: `src/modes/leaguechaos.jsx`

| Contract field | Value |
| --- | --- |
| `key` | `"leaguechaos"` |
| `label` | `"League + Chaos"` |
| `desc` | `"Round robin, top 2 meet in a chaos final"` |
| `icon` | `Zap` (lucide) — `ListOrdered` and `Dices` are taken |
| `minPlayers` | 2 |
| `stages` | `["lcgroup", "lcfinal"]` — both new, unique across the registry (`group`/`final` belong to `league`, `chaos` to Chaos Cup) |
| `config` | `legCount`: legs per group pairing, options `[1, 2, 3, 4]`, default 3 — same picker as league; the final reuses the same leg count, exactly as league does |

- **`createFixtures`** — `generateGroupMatches(players, legCount, rng)`
  remapped to `stage: "lcgroup"` (the generator stamps `"group"`; remap,
  don't touch the generator). No twists in the group stage. `initialTab:
  "fixtures"`.
- **`advance`** — same logic as league's `advance`: take the top 2 from
  `computeStandings(players, groupMatches)`, generate `legCount` final legs
  stamped `stage: "lcfinal"`, home alternating between the finalists (per
  feature 2), **and deal each leg a twist** via `dealTwists(legCount, rng)`
  stored on the match as `m.twist` — the same field Chaos Cup uses.
  Regenerating the final deals fresh twists. If standings has fewer than 2
  rows, return the input state unchanged (the contract forbids throwing).
- **`champion`** — identical rule to league: all final legs played, final
  standings computed over just the two finalists, higher points wins, level
  on points → no champion yet (the Table tab's regenerate button deals the
  chaos again, or players play a decider).
- **`tabs`** — `Fixtures · n/m`, `Table`, `Chaos Final · n/legCount`.
- **`views`** — three, mirroring league's:
  - `fixtures`: reuse `FixturesList` filtered to `lcgroup`.
  - `standings`: `StandingsTable` with `highlightTopN={2}` plus the advance
    button — label it `SET UP CHAOS FINAL (TOP 2)` / `REDEAL CHAOS FINAL`.
  - `final`: league's `FinalView` shape, but each `MatchCard` is topped with
    `<TwistBanner twist={twistOf(m.twist)} />` like Chaos Cup's fixture list.
- **`summary` / `subtitle` / `generateLabel`** — e.g. *"N matches (P players
  × L legs), then the top 2 play a final where every leg has a random silly
  rule."* / `"L LEGS · 3 PTS WIN · TOP 2 REACH THE CHAOS FINAL"` /
  `"GENERATE FIXTURES"`.

### Registration

`src/modes/index.js` — one import, one array entry:

```diff
 import worldcup from "./worldcup.jsx";
+import leaguechaos from "./leaguechaos.jsx";

-export const MODES = [league, knockout, king, roundrobin, bestofn, chaos, goldenboot, survivor, penalties, worldcup];
+export const MODES = [league, knockout, king, roundrobin, bestofn, chaos, goldenboot, survivor, penalties, worldcup, leaguechaos];
```

Plus one line in `MODE_STAGES` in `api/_lib/modes.js`:
`leaguechaos: ["lcgroup", "lcfinal"]`. The server keeps a hand-written mirror
of the registry (it can't import client JSX), and
`tests/modeRegistryParity.test.js` fails if the two drift — without it every
save for the new mode 422s and the user sees a stuck "Sync error" pill. The
original plan missed this; `ADDING-A-MODE.md` has been corrected to name both
files as the integration surface.

Nothing else changes for the mode itself — if it seems to need it, the
contract is missing something; fix the contract, not the shell.

### Tests

- **`tests/leaguechaos.test.js`** — pure-logic characterisation tests, in
  the style of `knockout.test.js` / `chaos.test.js`:
  - `advance` picks the top 2 on points and stamps `lcfinal` legs, each with
    a `twist` drawn from the deck, no repeats within a deal of ≤10.
  - `advance` with fewer than 2 standings rows returns state unchanged.
  - Champion: null while legs remain, null when level, winner on points.
  - Regenerating the final replaces old `lcfinal` matches rather than
    appending.
- **`tests/App.playthrough.test.jsx`** — add a full playthrough (generate →
  play group → advance → play chaos final → champion banner + History
  entry), matching the pattern the other ten modes follow.
- **`tests/modeRegistryParity.test.js`** — should pick the new mode up
  automatically; run it to confirm the contract shape is complete.

---

## Build order & verification

1. **Countdown tick** — independent, ship first.
2. **Home-start balance** — touches the shared generator, so run the *whole*
   suite: every round-robin mode's tests plus the playthroughs exercise it.
3. **League + Chaos** — depends on step 2 (final legs alternate home) and on
   the twist-deck extraction.

For each step: `npm run build`, `npm test`, then a real playthrough on the
device.

**Result:** 161 tests pass (137 before this work), `npm run build` and
`npm run lint` are clean. Nothing in `App.jsx`, `src/views/`, or the shared
components needed touching for the new mode — the only files outside
`src/modes/` and `tests/` are the two new shared modules
(`engine/twists.js`, `components/TwistBanner.jsx`), the balance work in
`engine/match.js`, the timer/audio pair, the `api/_lib/modes.js` mirror
line, and the docs that describe them.

Still worth doing on a real phone, since no test can hear it: start a match
timer and confirm the last ten seconds tick audibly through a pocket, and
that pausing silences them straight away.
