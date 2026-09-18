# Feature plan 2: a 30-second timer, a bigger chaos deck, an all-time Wins tab, a best-of-1 or best-of-3 final

**Status: all four shipped.** Where the built version departs from the
original plan, the section below says so and why — the descriptions here
match the code as it stands. The suite went from 161 tests to 209;
`npm run lint` and `npm run build` are clean.

Four changes, in the order they should be built. The first two are small
and self-contained. The third adds a shell-level tab — the first new one
since History — and, in its second step, the first database migration
since `001_init.sql`. The fourth gives every mode with a final a setup
choice between a one-off final and a best-of-three, and settles a
best-of-three early once it is decided.

*Changed from the plan:* the Wins tab shipped before the best-of final
rather than after it, purely so the two could be built without fighting
over the same three files; neither depends on the other. Both Wins steps
shipped together, so the `W` column never had to live through a release
showing a dash for every row. Two details the plan left implicit were
settled while building: Win % renders a dash rather than dividing by zero
for the defensive "champion not in the players list" case, and the
footnote's caveat about match wins is always shown rather than appearing
only once a partial row exists, since the caveat is permanently true.

One bug surfaced that the plan did not anticipate. The first version of
the Wins assertions in `tests/App.playthrough.test.jsx` assumed a named
player wins, but which player starts at home is drawn at random by the
fixture generator, so the test passed or failed depending on the draw.
The playthrough now reads the home player's name out of the match card
and scores for that player by name. `homeNameOfFirstCard` and
`addGoalForName` at the top of that file exist for this, and any future
playthrough that needs a specific player to win should use them.

Same conventions as [`FEATURE-PLAN.md`](./FEATURE-PLAN.md): pure logic in
`engine/` with tests under `tests/`, nothing mode-specific in the shell,
`rng` threaded rather than called, and a real playthrough on a phone before
calling anything done.

---

## 1. A 30-second timer preset

### Today

`src/lib/theme.js:14` — `DURATION_PRESETS = [60, 120, 180, 300]`.
`src/components/MatchTimer.jsx:47-53` renders one button per preset and
labels it `{secs / 60}m`, so a 30-second entry would print **`0.5m`**. The
preset row only shows while a timer is untouched (not running, `remaining
=== duration`). The default is 180s (`src/engine/useTimers.js:4`).

Timers live only in `useTimers` state — nothing about a duration is
persisted, synced, or validated server-side — so this is a UI-only change.

### Required behaviour

- A fifth preset, **30 seconds**, first in the row: `30s · 1m · 2m · 3m · 5m`.
- Sub-minute presets are labelled in seconds (`30s`); minute presets keep
  `Nm`.
- The default stays 3 minutes.
- Everything else a 30-second match needs already works and must keep
  working: the countdown ticks at 10…1 and the full-time beep at 0
  (`useTimers` gates on `remaining`, not on the duration), the amber
  "Final 10" state, and goal logging with `second`/`duration` on each goal.

### Changes

**`src/lib/theme.js`** — `[30, 60, 120, 180, 300]`. Order matters: the row
renders in array order.

**`src/engine/format.js`** — one formatter, next to `formatTime` (the other
timer-label formatter), so `MatchTimer` stays dumb and the label is
testable without React:

```js
export function formatPreset(secs) {
  return secs < 60 ? `${secs}s` : `${secs / 60}m`;
}
```

**`src/components/MatchTimer.jsx`** — import it and render
`{formatPreset(secs)}` in place of `{secs / 60}m`. No layout change
expected: five `flex-1` buttons at `text-[11px]` fit the narrowest card the
app targets. Confirm on a real phone that `30s` doesn't wrap.

### Edge cases (must all hold)

- **Last-gasp stat** — `useTournament.js:186` counts a goal as last-gasp
  when `duration - second <= 10`. In a 30-second match that's the final
  third of the game. That is the stat's definition, not a bug; leave it.
- **Goals-by-minute chart** — every goal in a 30-second match lands in the
  `0-1m` bucket. Fine.
- **Ticks** — a 30s timer ticks 10 times and beeps once, exactly like the
  15s case already under test. No preset under 10 seconds is being added; if
  one ever is, `tests/useTimers.test.js` already covers "ticks from the
  first second".

### Tests

- **`tests/format.test.js`** (new) — `formatPreset(30) === "30s"`,
  `formatPreset(60) === "1m"`, `formatPreset(300) === "5m"`. Add
  `formatTime` cases while there (it has none today).
- **`tests/matchTimer.test.jsx`** (new) — render `MatchTimer` with an
  untouched timer: buttons `30s`, `1m`, `2m`, `3m`, `5m` all present, in
  that order; clicking `30s` calls `onSetDuration(30)`; with
  `timer={{ duration: 30, remaining: 30, running: false }}` the clock reads
  `00:30` and the `30s` button is the highlighted one.
- **`tests/useTimers.test.js`** — one added case for the preset value
  itself: set 30, start, advance 30s → `playCountdownTick` ×10,
  `playBeep` ×1.

---

## 2. A bigger, sillier chaos deck

### Today

`src/engine/twists.js:12-23` holds **ten** twists. `dealTwists` deals
without repeats until the deck is empty, then reshuffles — so any Chaos Cup
longer than ten matches sees repeats:

| Roster | 1 leg | 2 legs |
| --- | --- | --- |
| 4 players | 6 | 12 |
| 5 players | 10 | 20 |
| 6 players | 15 | 30 |

League + Chaos deals at most four (one per final leg), so it never repeats
today and never will.

The header comment in `twists.js` sets the one hard rule and it stays:
**twists are real-world rules for the players, never scoring rules for the
app.** A twist that changes how a goal counts would invalidate the generic
standings both chaos modes rely on.

### Required behaviour

- The deck grows from 10 to **30**. A 5-player, 2-leg Chaos Cup (20 matches)
  never repeats; a 6-player, 2-leg one (30) uses the deck exactly once.
- **The existing ten keys are untouched.** `m.twist` is persisted on every
  chaos match in localStorage, and `twistOf` returns `null` for an unknown
  key — so renaming or deleting a key makes the banner silently vanish from
  every saved tournament that dealt it. New rule for the file, written into
  its header comment: *append only; never rename or remove a key.*
- Every new twist is: kid-safe, playable 1v1, needs nothing beyond a cone
  or two (the deck already assumes a "cone line"), and is a rule for the
  players, not for the app.
- `label` ≤ 22 characters (`TwistBanner` truncates), `detail` one short
  sentence in the deck's existing register — short, loud, playful.
- Labels and emoji unique across the deck: two banners must never look
  alike at a glance, and `tests/App.playthrough.test.jsx:363,377` finds a
  banner by label text, which throws if a label matches twice on screen.

### The twenty new twists

Grouped by kind so the deck feels varied when dealt. Keys are stable
identifiers; the copy can be tuned freely.

**Movement and body**

| key | emoji | label | detail |
| --- | --- | --- | --- |
| `trex-arms` | 🦖 | T-rex arms | Elbows pinned to your sides all match. Tiny arms only. |
| `walking` | 🚶 | Walking football | No running, ever. Get caught running and it's your opponent's ball. |
| `penguin` | 🐧 | Penguin feet | Heels together, waddle everywhere. |
| `spin-start` | 🌀 | Dizzy kick-off | Spin round three times before every kick-off. |
| `freeze` | 🧊 | Freeze! | One FREEZE each per match — shout it and your opponent stands still for three seconds. |
| `fence-run` | 🏃 | Fence run | After every goal, both players run and touch the far end of the garden before play restarts. |
| `statue-keeper` | 🗿 | Statue keeper | Guarding your goal? Feet stay planted — arms and body only. |

**Shooting and finishing**

| key | emoji | label | detail |
| --- | --- | --- | --- |
| `toe-poke` | 👟 | Toe pokes only | Every shot is a toe poke. No laces, no side-foot. |
| `trick-first` | 🎨 | Trick to score | Pull off a skill before you shoot — stepover, drag-back, anything — or the goal doesn't count. |
| `call-your-corner` | 📣 | Call your corner | Shout which corner you're aiming for before you shoot. Wrong corner, no goal. |
| `shot-clock` | ⏰ | Shot clock | Shoot within ten seconds of winning the ball, or hand it over. |
| `tiny-goals` | 🥅 | Tiny goals | A cone in each goal halves it — both ends, all match. |
| `quiz-goal` | 🧮 | Quiz goal | Before a goal counts, answer a quiz question from your opponent. Get it wrong and play on. |

**Talking and performing**

| key | emoji | label | detail |
| --- | --- | --- | --- |
| `sound-effects` | 🎺 | Sound effects | Make your own sound effect for every kick, save and goal. |
| `opposite-day` | 🙃 | Opposite day | Say the opposite of what you mean all match: "terrible goal!" |
| `posh-voice` | 🎩 | Posh match | Poshest voice only. "I say, splendid tackle." |
| `superhero` | 🦸 | Superhero names | Pick a superhero name each and answer to nothing else. |
| `count-touches` | 🔢 | Count your touches | Count every touch out loud. Lose count and it's your opponent's ball. |
| `singing` | 🎤 | Singing dribbler | Sing while you have the ball. Stop singing and you lose it. |

**Restarts and celebrations**

| key | emoji | label | detail |
| --- | --- | --- | --- |
| `dance-restart` | 🕺 | Dance restart | The scorer picks a dance and both players do it before the next kick-off. |

**Considered and rejected**, so nobody re-proposes them:

- *Goals count double / golden goal / next goal wins* — scoring rules. They
  break the "never change how a goal counts" invariant and the standings.
- *Headers only* — FA guidance restricts heading for under-12s.
- *Socks only, blindfolds, knee-slide finishes* — slipping and injury risk.
- *Anything needing music or a phone timer on the pitch* — the phone is
  busy being the scoreboard.

### Changes

**`src/engine/twists.js`** — append the twenty entries after
`commentator`; nothing else in the file changes. Array order is irrelevant
to dealing (the deck is shuffled) so appending is safe. Extend the header
comment with the append-only rule and why.

Nothing else needs touching. `dealTwists`, `twistOf`, `TwistBanner`,
`chaos.jsx`, and `leaguechaos.jsx` are all deck-size agnostic.

**Known gap, out of scope, worth knowing:** the server never stores
`m.twist`. `validateState` in `api/_lib/serializer.js` keeps only the
match fields it names, and `migrations/001_init.sql` has no `twist` column
on `matches`. In cloud mode, any state composed back from the server — a
409 conflict resolution, or signing in on a second device — comes back
without twists, and every chaos banner disappears. Local-only mode is
unaffected. Expanding the deck neither causes nor fixes this. If it is
fixed, the shape is: a nullable `twist VARCHAR(24)` column on `matches`,
round-tripped in `validateState` and `composeTournamentRow`, in the same
`002` migration file that feature 3 below introduces.

### Tests

**`tests/chaos.test.js`**

- Rename `"never repeats a twist within the first ten matches"` to
  `"never repeats a twist within one pass through the deck"` — the body
  already uses `TWISTS.length`, only the name is stale.
- New `describe("the twist deck")`:
  - `TWISTS.length >= 30`.
  - keys unique; labels unique; emoji unique.
  - every `label.length <= 22`; every `detail` non-empty.
  - the original ten keys (`weak-foot`, `one-touch`, `sitting-keeper`,
    `silent`, `slow-mo`, `swap-ends`, `long-range`, `hop-start`,
    `no-looking`, `commentator`) are all still present — a literal list in
    the test, so a rename fails loudly.
- New: `chaos.createFixtures` with 5 players and `chaosLegs: 2` yields 20
  matches carrying 20 distinct twists.

**`tests/leaguechaos.test.js`** and **`tests/App.playthrough.test.jsx`** —
unchanged; both are deck-size agnostic (the playthrough checks
`TWISTS.some((t) => screen.queryByText(t.label))`, which is why label
uniqueness is enforced above).

---

## 3. An all-time Wins tab

### Today

Every mode gets three shell tabs — Players, Stats, History
(`src/App.jsx:58-63`). Stats is per-tournament: it reads the goals log,
which "New" wipes. History is the only cross-tournament view, and it's a
list of finished tournaments, not a table of players. Nothing anywhere ranks
players by how often they have won.

A history record (`src/engine/useTournament.js:192-200`) is:

```js
{ id, date, mode, players: [names], champion: name,
  topScorer: { name, goals } | null, totalGoals }
```

mirrored on the server by `tournament_history` and
`tournament_history_players`. Players are stored as **names** — player ids
are per-tournament and mean nothing across two of them.

### Required behaviour

A new shell tab, **Wins**, between Stats and History, for every mode. One
row per player who has ever appeared in a finished tournament, ranked by
wins:

- **Titles** — tournaments won: history records whose `champion` is this
  player. The headline number, and what the ranking is led by.
- **W** — matches won across finished tournaments. History records don't
  carry this today, so it arrives in step B below; step A shows a dash.
- Also shown: **Played** (tournaments entered) and **Win %**
  (titles ÷ entered).
- Order: titles desc → match wins desc → entered asc (fewer entries for the
  same titles is the better record) → name.
- Top three get the medal treatment the top-scorers list uses
  (`MEDAL_COLORS`), first place on the gold background.
- Usable with no live tournament, like History — it's built from history.
- Names are matched after `trim()` and case-folding; the row shows the most
  recently used spelling. The limitation is inherent in the data and is
  stated in the footnote rather than hidden: two different kids called
  "Sam" merge; "Sam" and "Sammy" don't.
- Footnote under the table: *"Built from History — delete a tournament
  there and its wins go with it."* Empty state: *"No finished tournaments
  yet — the first champion starts the all-time table."*

Only finished tournaments count. A tournament in progress has a live table
of its own; its results join the all-time table the moment it has a
champion, because that is the moment it enters History.

### Step A — titles from the history you already have (client only)

**`src/engine/wins.js`** (new, pure, no React):

```js
/* One row per distinct player name across every finished tournament.
   History is newest-first, so the first spelling seen is the current one. */
export function computeWinsTable(history) {
  // key: name.trim().toLowerCase()
  // row: { key, name, titles, entered, played, w, d, l, hasResults }
  // - every name in record.players: entered++, ensure row
  // - record.champion (matched by key): titles++, ensure row even if the
  //   champion isn't in players (defensive — imported/old data)
  // - record.results?[name] (step B): played/w/d/l summed, hasResults = true
  // sorted: titles desc, w desc, entered asc, name asc
}
```

Winless players still appear — a kid with no titles wants to see their name
and, after step B, their match wins.

**`src/engine/useTournament.js`** — alongside `topScorers`:

```js
const winsTable = useMemo(() => computeWinsTable(history), [history]);
```

and return it. Deleting or clearing history recomputes it for free.

**`src/views/WinsView.jsx`** (new) — props `{ winsTable }`. Its own table
markup rather than `StandingsTable`, whose columns are a league table's and
should not grow mode flags: columns `#`, `Player`, `Titles`, `Played`, `W`,
`Win %`; the first two columns sticky like `StandingsTable` so it scrolls
sideways on a phone; `W` renders `—` while `!hasResults`; `EmptyCard` for
the empty state; `SectionLabel` "All-time" above.

**`src/App.jsx`**

- `tabs`: insert `{ key: "wins", label: "Wins" }` after Stats.
- The disabled rule at `App.jsx:146` currently special-cases two keys:
  `t.key !== "setup" && t.key !== "history" && matches.length === 0`.
  Replace with a small set — `const ALWAYS_ON = new Set(["setup", "wins",
  "history"])` — and test membership.
- Render `{tab === "wins" && <WinsView winsTable={winsTable} />}`. No mode
  registers a `wins` view, so `activeMode.views[tab]` is `undefined` on that
  tab and the mode renders nothing, exactly as on Stats and History.

**`src/modes/contract.md`** — the "what is shared" bullet *"The Stats and
History tabs … every mode gets both"* becomes *Stats, Wins and History*.

**`README.md`** — one clause in the opening paragraph ("an all-time Wins
table") and one sentence under **Data & persistence** saying Wins derives
from History, so clearing History clears it.

### Step B — match wins, carried on every new history record

Match wins need per-player results that history doesn't keep. Add them to
the record at the moment it's written; old records simply lack them.

**Record shape** — in the history effect at `useTournament.js:192`, add:

```js
results: computeStandings(players, matches)
  .map(({ name, played, w, d, l, gf, ga }) => ({ name, played, w, d, l, gf, ga })),
```

`computeStandings` over **all** matches, every stage — a league's group and
final, every knockout round, every king match — so a "match win" means the
same thing in every mode. It already skips unplayed matches and byes. The
effect's deliberately narrow dependency list (`champion?.id`, …) is fine:
it runs on the render where the champion appears, when `matches` in the
closure is exactly the finished tournament — the same moment `goals` and
`topScorers` are read today.

**Client** — `computeWinsTable` sums `results` where present. When some
records have results and older ones don't, the sum is a partial count;
`hasResults` is true if *any* record contributed, and the footnote gains a
second sentence: *"Match wins count tournaments finished after the Wins tab
was added."* Partial-but-honest beats a dash forever.

**`api/history/index.js`**

- `POST`: read `record.results` (array, ≤ 64 entries; each `name` sliced to
  24 chars, each number clamped with the same `Number.isFinite`/`Math.trunc`
  pattern the endpoint already uses for `totalGoals`, capped at 65535 to
  match the column). When inserting `tournament_history_players`, look up
  the result for each player name and write the new columns; `NULL` when
  there is none. The `ON DUPLICATE KEY UPDATE id = id` idempotency stays as
  is — re-posting an old record (import, reconciliation) does not backfill,
  which is correct: those records never had results.
- `GET`: select the new columns; attach `results` to a record only when at
  least one of its player rows has a non-null `w`. Older rows come back
  without the key and the client treats that as "no results".

**`migrations/002_history_results.sql`** — additive and idempotent, per
`migrations/README.md`:

```sql
ALTER TABLE tournament_history_players
  ADD COLUMN IF NOT EXISTS played SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS w      SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS d      SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS l      SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS gf     SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS ga     SMALLINT UNSIGNED NULL;

INSERT IGNORE INTO schema_migrations (version) VALUES ('002_history_results');
```

`NULL` means "recorded before results were kept". Add the file to the table
in `migrations/README.md`. **Apply the migration before deploying the API
change** — the new `INSERT` names the columns and will fail against the old
table.

**Nothing else changes.** Export/import bundles whatever is on the record
and `importData` re-posts through `addHistory`, so `results` travels with
the JSON. First-login reconciliation (`src/lib/reconcile.js`) adopts the
server's history wholesale; records with and without `results` mix freely.
`tests/exportImport.test.js` and `tests/syncEngine.test.js` build records
by hand with only `id`/`champion` and don't assert the shape, so they stay
green.

### Edge cases (must all hold)

- **Same name across tournaments** merges; case and surrounding whitespace
  don't split a player (`"bob"`, `"Bob "` → one row, shown as the newest
  spelling).
- **Champion not in the players list** (hand-edited or older imported data)
  still earns a row and a title.
- **History cleared** → empty state. **One entry deleted** → its titles and
  results leave the table on the next render.
- **Ties** resolve by the stated order; the medal follows the row position.
- **No live tournament** → Wins tab enabled, Stats still disabled.

### Tests

- **`tests/wins.test.js`** (new, pure):
  - empty history → `[]`.
  - three records, A wins two, B wins one, C never wins → order A, B, C with
    titles 2/1/0 and correct `entered`.
  - case/whitespace merge → one row named from the newest record.
  - champion missing from `players` → row with one title, `entered` 0.
  - tie on titles → more match wins first → fewer entries first → name.
  - no record has `results` → `w` is `0` and `hasResults` is `false`; a mix
    → sums only the records that have them, `hasResults` `true`.
- **`tests/App.test.jsx`** — with no tournament, the Wins tab is enabled and
  shows the empty card; Stats stays disabled.
- **`tests/App.playthrough.test.jsx`** — extend the League + Final
  playthrough: after the History assertion, click `Wins`; Alice's row shows
  1 title, 1 played, 2 match wins (she won the group match 2–0 and the final
  2–0). Then read `gardenCup:history` from `localStorage` and assert the
  record's `results` has Alice at `w: 2` and Bob at `l: 2` — that pins the
  record shape the API relies on.
- **API** — there are no automated API tests in this repo. Verify by hand
  against a dev database: apply `002`, POST a record with `results` and GET
  it back intact; GET a pre-migration record and confirm it has no
  `results` key; POST the same record twice and confirm one row.

---

## 4. The final: best of 1 or best of 3

### Today

Three modes have a named final; none of them lets you choose its length.

- **League + Final** (`src/modes/league.jsx`) and **League + Chaos**
  (`src/modes/leaguechaos.jsx`) — `advance` builds the final with
  `config.legCount`, the *group-stage* leg count (1–4). A four-leg group
  stage means a four-leg final; a one-leg stage means a one-off. The
  champion rule is: every final leg played, most points wins, level on
  points → no champion (the Table tab's regenerate/redeal button, or a
  decider). The tab reads `Final · n/legCount`.
- **Garden World Cup** (`src/modes/worldcup.jsx`) — one final match, round
  2 of `wcko`, `needsWinner` (a played tie doesn't count), with a single
  third-place match beside it. `finalOf` finds *the* one match.
- **Knockout** and **Penalty Shootout Cup** — the "FINAL" is just the last
  round of the shared bracket (`roundLabel(1)` in `engine/match.js`), one
  match with `needsWinner`. They stay as they are (see *Out of scope*).

### Required behaviour

- Setup gains a second picker, **"The final"**, with two buttons that read
  **`Best of 1`** and **`Best of 3`**, on League + Final, League + Chaos and
  Garden World Cup. Like every config picker it shows only before fixtures
  are generated; the value is read when the final is set up.
- The group-stage `legCount` no longer has any say in the final's length.
- **Best of 1** — one leg. A draw is level → the existing "level on points"
  message and the existing regenerate/decider flow. Unchanged behaviour,
  now chosen rather than inherited.
- **Best of 3** — three legs, home alternating (`alternateHome`, as today),
  and **settled as soon as it's decided**: two wins from two crowns the
  champion with the third leg unplayed. Points stay the currency (3/1/0, as
  every final uses today), so a W–D–D final still has a winner after three
  legs, while W–L–D is level and goes to the existing tie flow. The exact
  rule: the leader is champion once their points lead is bigger than
  `3 × unplayed legs` — with everything played, that reduces to "more
  points", which is today's rule verbatim.
- The dead third leg stays on screen, unplayed, under the champion banner
  — a family that wants to play it for fun can. Nothing depends on it:
  `togglePlayed` on it cannot change the outcome, and the tab reads
  `Final · 2/3` honestly.
- World Cup's third-place match stays a single game regardless.
- Defaults preserve what each mode does today out of the box: League +
  Final and League + Chaos default to **Best of 3** (their default
  `legCount` is 3, so their default final is already three legs); Garden
  World Cup defaults to **Best of 1** (its final is one match today).

### Changes

**`src/engine/series.js`** (new, pure) — the champion rule, shared by all
three modes because all three need it (the same move that made
`engine/twists.js`):

```js
import { computeStandings } from "./standings.js";

/* Winner of a two-player leg series, settled early when the trailing
   player can no longer catch up. Draws are worth a point, so W-D-D wins. */
export function seriesWinner(finalists, legs) {
  if (finalists.length !== 2 || legs.length === 0) return null;
  const [lead, trail] = computeStandings(finalists, legs);
  const unplayed = legs.filter((m) => !m.played).length;
  return lead.pts - trail.pts > 3 * unplayed ? lead : null;
}
```

`league.jsx` and `leaguechaos.jsx` currently carry an identical inline
version of the all-played case; both `champion()` functions become
"find the finalists, call `seriesWinner`". The returned row is a standings
row (`id`, `name`, `pts`, …), which is what the champion banners already
read.

**The config picker** — `src/views/SetupView.jsx:32-46` renders each
option as `{opt}`, so a `[1, 3]` picker would show bare `1` and `3`
buttons. That is bad copy and, worse, it collides with the existing
`clickText("1")` calls in `tests/App.playthrough.test.jsx` (lines 34, 140,
197, 358, 394), which would find two `1` buttons and throw. Extend the
choice spec with an optional formatter — a contract extension, not a
special case:

```js
finalLegs: { type: "choice", label: "The final", options: [1, 3], default: 3,
             format: (n) => `Best of ${n}` },
```

`SetupView` renders `{spec.format ? spec.format(opt) : opt}`; the stored
value is still the number. Document `format` in the config example in
`src/modes/contract.md`.

**Config keys** — `finalLegs` (default 3) on `league` and `leaguechaos`;
**`wcFinalLegs`** (default 1) on `worldcup`. The names differ on purpose:
`useTournament.js`'s `defaultConfig()` flattens every mode's config into one
object, last-registered mode winning, and a mode switch never resets it —
so two modes sharing a key must share a default or one of them shows the
wrong button pre-selected. `chaosLegs` vs `legCount` is the existing
precedent. The two league modes share `finalLegs` because they share the
default, exactly as they share `legCount` today.

**`src/modes/league.jsx`**

- `advance`: `generateFinalMatches(top1, top2, config.finalLegs ?? 3, rng)`
  instead of `config.legCount`.
- `champion`: finalists + `seriesWinner`.
- `tabs`: `Final · n/${config.finalLegs ?? 3}`.
- `summary`: "…then the top 2 play a **best-of-3 final**." `subtitle`:
  `${legCount} LEG(S) · TOP 2 · BEST-OF-${finalLegs} FINAL`.

**`src/modes/leaguechaos.jsx`** — the same four edits; the final's twists
are dealt per leg already, so `dealTwists(finalLegs, rng)` just follows the
new count.

**`src/modes/worldcup.jsx`**

- `finalOf` (one match) becomes `finalLegsOf` (the round-2 non-third-place
  matches, ordered by `leg`).
- `advance`, semis → final: build `wcFinalLegs` final matches with
  `alternateHome(winnerA, winnerB, n, rng)` rather than one `makeKoMatch`
  — a leg series must not coin-flip home per leg (FEATURE-PLAN §2). Each
  is `{ stage: "wcko", round: 2, leg, thirdPlace: false, … }`. The
  third-place match is unchanged. The "already has round 2" guard is
  unchanged.
- `champion`: `seriesWinner(finalists, finalLegsOf(matches))`. With
  `needsWinner` on every knockout card, a played tie is a leg still waiting
  for a winner: it earns a point each, never widens the lead, and so can
  never crown anyone early — the rule is safe here without a special case.
- `FinalsView`: `canAdvance = decided && finalLegs.length === 0`; "THE
  FINAL" section lists every leg. Subtitle on the banner stays "Garden
  World Cup winner".
- `summary`: "…then a best-of-{n} final — and the losers play off for
  third."

**`README.md`** — the three mode bullets mention the choice ("top 2 play a
best-of-1 or best-of-3 final").

### Out of scope, on purpose

Knockout and Penalty Shootout Cup. Their final is a round of the bracket
in `engine/bracket.js`, shared by both, with byes and a `round` counter
that assume one match per tie. A best-of-three there means the bracket
holding several matches per pairing and `advanceBracket` waiting on a
series rather than a match — a bracket-engine change, not a config
switch. Worth doing if wanted; it is its own plan.

### Edge cases (must all hold)

- **Best of 3, 2–0 up** → champion, third leg unplayed, tab `Final · 2/3`,
  History entry written at that moment (the history effect keys on
  `champion?.id`, unchanged).
- **Best of 3, W–D with one to play** (4–1) → no champion yet; the third
  leg decides. **W–D–D** → champion. **W–L–D** (4–4) → level, existing
  message.
- **Best of 1, drawn** → level, existing message.
- **Regenerate/redeal the final** re-reads `finalLegs`: a level three-leg
  final redeals as three fresh legs.
- **An in-progress save from before this change** has no `finalLegs`;
  every read is `config.finalLegs ?? 3` / `config.wcFinalLegs ?? 1`, and a
  final already generated keeps whatever legs it has — nothing regenerates
  on load.

### Tests

- **`tests/series.test.js`** (new): one leg unplayed → null; one leg drawn
  → null; one leg won → winner; three legs 2–0 up with one to play →
  winner early; W–D with one to play → null; W–D–D → winner; W–L–D → null;
  all played and level → null; not exactly two finalists → null.
- **`tests/league.test.js`** (new — league has no unit test today):
  `advance` with `legCount: 4, finalLegs: 1` makes one final leg; with
  `legCount: 1, finalLegs: 3` makes three, home alternating; `champion`
  crowns at 2–0 with a leg unplayed.
- **`tests/leaguechaos.test.js`** — the `advance` cases pass `legCount: 3`
  and expect three final legs; switch them to `finalLegs: 3` (and the
  four-leg "never repeats a twist" case to `finalLegs: 3` — three is now the
  maximum). Add the early-settlement case.
- **`tests/worldcup.test.js`** — "generates a final and a third-place
  match" gains a `wcFinalLegs: 3` variant: three final legs, one
  third-place; the champion "comes from the final" case becomes first to
  two.
- **`tests/App.playthrough.test.jsx`** — the League + Final and League +
  Chaos playthroughs expect a one-match final (`finalGoalButtons` length
  2); they now click `Best of 1` before generating. Add one best-of-3
  playthrough: win two legs → `Champion` appears with the third leg still
  showing `Mark played`. The World Cup playthrough is unchanged (default
  `Best of 1`).

---

## Build order & verification

1. **Timer preset** — trivial and independent; ship first.
2. **Chaos deck** — pure data; ship second. Independent of 1.
3. **Best-of final** — three mode files, one engine module, one line in
   `SetupView`, one line in `contract.md`. Independent of 1 and 2; before
   the Wins tab because it's smaller and touches nothing the Wins tab does.
4. **Wins tab, step A** — client only; ships and is useful on its own.
5. **Wins tab, step B** — migration first, then the API, then the client
   record change. Depends on 4.

For each step: `npm run lint`, `npm test`, `npm run build`, then on a
phone: pick `30s` and hear ten ticks and the beep; deal a 5-player, 2-leg
Chaos Cup and scroll the whole list for a repeated banner; set up a
best-of-3 final, win two legs and see the banner with the third leg
untouched; finish a tournament and watch its champion climb the Wins tab.

Cloud-mode check for step 5: apply `002` → deploy → finish a tournament on
one device → sign in on another and open Wins.

When shipped, update this file's status line the way `FEATURE-PLAN.md`
did, and note anywhere the built version departed from the plan and why.
