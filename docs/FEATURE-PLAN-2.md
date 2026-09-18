# Feature plan 2: a 30-second timer, a bigger chaos deck, an all-time Wins tab, a best-of-1 or best-of-3 final, a talking scoreboard

**Status: all five sections built.** Where a built version departs from the
original plan, the section below says so and why — every description here
matches the code as it stands. The suite went from 161 tests to 246;
`npm run lint` and `npm run build` are clean.

**Section 5A was later rebuilt.** Its hand-rolled oscillator voice was
never heard on a real phone before the countdown was moved onto the same
browser speech engine as the spoken result, and the oscillator module was
deleted. 5A below is kept as the historical record of that approach and the
review it went through; the *Update* at the end of section 5 describes what
actually ships.

Sections 1 to 4 were four changes, in the order they should be built.
Section 5 was added afterwards and built last. The first two are small
and self-contained. The third adds a shell-level tab — the first new one
since History — and, in its second step, the first database migration
since `001_init.sql`. The fourth gives every mode with a final a setup
choice between a one-off final and a best-of-three, and settles a
best-of-three early once it is decided. The fifth makes the app talk: a voice
counting the final ten seconds, synthesised from an `OscillatorNode` rather
than loaded from a recording, and a spoken result naming the winner and
loser when a match is marked played.

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

## 5. A talking scoreboard

**Status: built, then partly rebuilt.** 5B ships as described. 5A was built
as specified, then replaced: the countdown now speaks through the same
browser speech engine as the result, and the oscillator synthesis was
deleted. Read 5A for the reasoning and the review it survived, then read the
*Update* at the end of this section for what ships.

This section was reviewed before being finalised; the *Review notes* near the
end record what the review changed, including one factual claim it
corrected, and what building it changed again.

Two pieces of speech, deliberately built on two different mechanisms:

- **5A — the countdown.** A voice counting the final ten seconds, synthesised
  from an `OscillatorNode`. Fixed vocabulary, no recordings, no assets.
- **5B — the result.** When a match is marked played, the app says who won
  and who lost, by name: *"Bob lost, Tom won."*

They do not share an implementation, and the reason is the whole design
constraint of this section. 5A says ten words that are known at build time,
which is exactly what oscillator synthesis can do. 5B says names typed in at
setup, which it cannot do at any quality, so 5B uses the browser's speech
engine instead. Keeping them separate means the countdown still works on a
phone whose speech engine is missing or mute, and the result announcement
still works if the synthesised voice is switched off.

---

### 5A. The countdown, synthesised with OscillatorNode

> **Superseded — historical record.** The design below was built in full,
> then removed in favour of the browser's speech engine before anyone heard
> it; `src/engine/voice.js` no longer exists. It is kept because the
> reasoning and the review findings are worth having, and because the
> constraint it was written under (say ten words with an `OscillatorNode`)
> may come back if the speech route ever disappoints. For what ships, skip
> to the *Update* at the end of this section.

#### Today

`src/engine/audio.js` is four functions over one shared `AudioContext`, and
every sound in the app is generated, not loaded: there is not a single audio
asset in the repo. One private helper does all the work:

```js
function tone(freq, type, when, dur, vol)   // one oscillator, one gain, done
```

`playCountdownTick()` plays a single 1200 Hz square tone every second through
the final ten. It is unmistakable but it is a beep, and a beep cannot tell
you *which* second it is — the number only exists on screen, which is no help
to a player facing away from the phone.

Every function is wrapped in `try/catch` and routes through `unlockAudio()`,
because iOS refuses to start an `AudioContext` before a user gesture. That
contract is not negotiable and everything below keeps it.

#### The approach: source-filter synthesis, no samples

A human voice is a buzzing sound source shaped by the resonances of the
mouth. That is directly reproducible in Web Audio, and it is why an
`OscillatorNode` can be made to say "three" without a single recorded byte:

- **Source** — one `OscillatorNode`, `type: "sawtooth"`. A sawtooth is used
  because it is rich in harmonics; a sine has nothing for the filters to
  shape and would only ever beep.
- **Filter** — three `BiquadFilterNode`s in **parallel**, each
  `type: "bandpass"`, tuned to the first three formants of the vowel being
  spoken, summed back into one gain. Three resonances are what the ear reads
  as a vowel.
- **Envelope** — a `GainNode` per word, so words start and stop like speech
  rather than clicking.
- **Movement** — formant frequencies are *ramped* during the word. This is
  what makes it read as speech rather than as a chord: "five" and "nine" are
  diphthongs whose formants glide, and the glide is most of what identifies
  them.
- **Consonants** — see the fricative note below. They are in scope, and they
  are what separates the ten words from ten vowels.

The result is a small robot counting you down. It will not be mistaken for a
person, and this plan does not pretend otherwise.

#### Pitch carries the count, vowels are the garnish

The single most useful property here is not vowel intelligibility, it is
that the ear tracks pitch effortlessly. **Step the fundamental down one
semitone per number**, about 165 Hz at "ten" down to about 98 Hz at "one".
A player facing away from the phone then hears the countdown's *position*
from pitch alone, and the words become a bonus rather than the load-bearing
part. Direction is a one-line change; try both and keep whichever reads as
more urgent in the garden.

Scale the formant table by about 1.1 to match the slightly higher voice.
This also helps on a phone speaker, which reproduces essentially nothing
below about 400 Hz — F1 of "two", "three" and "six" is simply gone on the
device no matter how it is tuned, which is another reason not to rest the
design on vowels.

#### The words

Ten words, not ten vowels. Each is an onset, a nucleus and a coda. Formants
are F1 / F2 / F3 in Hz; an arrow is a glide across the segment. Nasal murmurs
are about 250 / 1000 / 2300 with the F2 and F3 branches pulled down about
10 dB. "Pseudo-fricative" is the two-oscillator noise described below.

| Word | Onset | Nucleus | Coda | ms |
| --- | --- | --- | --- | --- |
| ten | /t/ hard onset, 5 ms edge | ɛ 530 / 1840 / 2480 | /n/ murmur, 60 ms | 330 |
| nine | /n/ murmur, 60 ms | aɪ 730→270 / 1090→2290 / 2440 | /n/ murmur, 60 ms | 420 |
| eight | none, soft onset | eɪ 400→270 / 2000→2290 / 2600 | /t/ abrupt cutoff then silence | 300 |
| seven | /s/ pseudo-fricative, 80 ms | ɛ 530 / 1840 / 2480, then ə 500 / 1500 | /v/ voiced fricative 50 ms, /n/ murmur | 480 |
| six | /s/ pseudo-fricative, 80 ms | ɪ 390 / 1990 / 2550 | closure gap then /ks/ fricative, 80 ms | 320 |
| five | /f/ pseudo-fricative, 70 ms | aɪ 730→270 / 1090→2290 / 2440 | /v/ voiced fricative, 50 ms | 400 |
| four | /f/ pseudo-fricative, 70 ms | ɔː 570 / 840 / 2410 | F3 dips to 1800 for r-colour | 350 |
| three | /θ/ 60 ms, then /r/ F3 1600→3010, F2 1300→2290 | iː 270 / 2290 / 3010 | none | 380 |
| two | /t/ hard onset, 5 ms edge | uː 300 / 870 / 2240 | none | 300 |
| one | /w/ 300 / 650, ramping in over 70 ms | ʌ 640 / 1190 / 2390 | /n/ murmur, 60 ms | 340 |

The vowel values are Peterson and Barney male averages and are a starting
point, not a finished voice. **They must be tuned by ear through a phone
speaker**, not headphones. Treat this table as the thing most likely to
change during the build.

Durations differ on purpose. "Six" is one short syllable and "seven" is two;
that contrast is a cue the ear uses, and flattening every word to the same
length throws it away. No word may exceed 500 ms: a word that overruns its
second is a bug, not a style choice.

#### Fricatives without a single sample

Fricatives are noise, and noise is what makes "six", "seven", "three", "five"
and "four" recognisable. It does **not** require an `AudioBufferSourceNode`:
two oscillators in heavy frequency modulation — a 5 to 6 kHz square carrier,
a modulator at a few hundred Hz, a large modulation index — produce a dense,
hiss-like spectrum that serves perfectly well as /s/ and /f/. Wire it by
connecting the modulator through a high-gain `GainNode` into the carrier's
`frequency` param.

This stays entirely inside the brief, costs two more nodes per fricative
word, and is the single biggest intelligibility win available. It is in
scope.

#### Filter bandwidths and levels

**Do not use a single `Q` for every branch.** Web Audio's bandpass bandwidth
is `frequency / Q`, so `Q = 10` at F1 = 270 Hz gives a 27 Hz passband while
the source's harmonics are 100 to 165 Hz apart. The nearest harmonic falls
outside the band, the branch drops several dB, and it *warbles* as the
fundamental glides. Every vowel with a low F1 is affected.

Specify bandwidths and derive Q per target:

| Branch | Bandwidth | Resulting Q |
| --- | --- | --- |
| F1 | 80 Hz | roughly 3 to 9 |
| F2 | 110 Hz | roughly 8 to 20 |
| F3 | 180 Hz | roughly 13 to 17 |

The rule behind the numbers: every passband must be at least one fundamental
wide, so it always contains a harmonic. If a single constant per branch is
wanted instead, `Q` of about 4, 10 and 13 is close enough to start.

A sawtooth's harmonics fall off at 1/n, which leaves F2 of a front vowel like
"three" far weaker than a real voice. Correct it with per-branch gains — F1
at 1.0, F2 around 0.6 to 1.0, F3 around 0.3 to 0.5 — or a single `highshelf`
at 1 kHz, +6 to +9 dB, ahead of the branches.

Sum through a master `GainNode` at or below 0.3, with a
`DynamicsCompressorNode` on the voice bus. The destination hard-clips, and
three summed resonant branches reach full scale far more easily than the
existing 0.1 to 0.25 tones do.

#### Scheduling hygiene

Four rules, each of which is a bug if broken. The existing `tone()` helper is
*not* a safe template for any of them.

- **Linear ramps, not exponential.** `tone()` uses
  `exponentialRampToValueAtTime`, which can neither start from nor reach
  zero. Copying it into an envelope either clicks or throws. Use: gain 0 at
  the start, linear to level over 15 to 20 ms, linear back to 0 at the end,
  and `osc.stop(end + 0.02)` — the stop must come *after* the release.
- **Schedule slightly ahead.** Start each word at `ctx.currentTime + 0.03`,
  never at `currentTime`. Events placed at "now" are already in the past
  when the audio thread sees them and get clamped, which is exactly where
  attack clicks come from.
- **Skip unless the context is running.** If `ctx.state !== "running"` —
  locked, backgrounded, or iOS's non-standard `"interrupted"` after a phone
  call — schedule nothing at all. Today `tone()` queues into a frozen clock
  and ten queued ticks collapse into one loud tick on resume. Nobody noticed
  with beeps; ten queued *words* play simultaneously as a chord.
- **Fix `unlockAudio` while here.** It resumes only on `"suspended"`; it
  should resume on any state other than `"running"`.

#### Changes

**`src/engine/voice.js`** (new) — the word table and the graph builder, pure
and context-injected, importing nothing from `audio.js`:

```js
// ctx is injected rather than imported so the whole module is testable
// without a browser — jsdom implements no Web Audio at all.
export function speakWord(ctx, word, startTime) { ... }   // returns end time
export const WORDS = { 10: "ten", 9: "nine", ... };
```

It uses factory methods (`ctx.createOscillator()`, `ctx.createBiquadFilter()`,
`ctx.createGain()`) rather than constructors, matching `audio.js` and keeping
the test fake simple.

`voice.js` deliberately does **not** wrap itself in `try/catch`. A pure
module that swallows its own errors makes its tests pass while the graph is
broken. The `try/catch` belongs at the `audio.js` boundary.

**`src/engine/audio.js`** — keeps the context private. `getAudioContext` is
*not* exported; instead the ten-line wrapper lives here, inside the existing
guard:

```js
export function playCountdownTick(remaining) {
  try {
    unlockAudio();
    const ctx = getAudioContext();
    if (ctx.state !== "running") return;
    if (!getVoicePref() || !WORDS[remaining] || speakingUntil > ctx.currentTime) {
      tone(1200, "square", 0, 0.15, 0.25);       // the existing beep
      return;
    }
    speakingUntil = speakWord(ctx, WORDS[remaining], ctx.currentTime + 0.03);
  } catch { /* no audio */ }
}
```

This keeps the unlock contract in one file, avoids a circular import, and
leaves `voice.js` a pure table plus graph builder.

`speakingUntil` also settles the two-timer case. The interval loops every
running timer in one callback, so two timers in their final ten would start
two words in the same millisecond, which is mush rather than "talking over
each other". One timestamp makes the second timer fall back to the beep.

`speakFullTime()` is **not** built. "Full time" is two unvoiced consonants
and would come out as "ull-ime". The triple beep at zero is the signal people
already know and it stays exactly as it is.

**`src/engine/useTimers.js`** — the entire change is one argument:

```js
- playCountdownTick();
+ playCountdownTick(remaining);
```

`remaining` is already in scope at that line, and `useTimers` stays ignorant
of how the countdown sounds, which is the existing division of labour.
`speakCount` says **one number per call** — never a whole sequence, which
would break pause.

**The preference** — one key, `gardenCup:voice`, owned by `audio.js` through
`getVoicePref()` / `setVoicePref(on)`. Stored `"0"` means off; absence means
on. It is device-local: not in `exportData`, never synced, and that should be
stated in the README. One speaker button in the hero's pill row in
`src/App.jsx`, beside export and import, where it is reachable with no
tournament in progress, carrying `aria-label` and `aria-pressed` so
`App.test.jsx` can find it by accessible name. The same key gates 5B.

**Toggling it on speaks a sample word.** The tap is a user gesture, which is
the one thing iOS wants in order to unlock audio, and the person flipping the
switch wants to hear what they just turned on. This also quietly retires the
README's "tap anything once before relying on the warning beep" instruction.

#### Edge cases (must all hold)

- **Audio unavailable or not yet unlocked**: silent, no throw, as today.
- **Screen locks mid-countdown**: iOS freezes `setInterval` and interrupts
  the `AudioContext`, so the countdown stops. This is already true of the
  beep today. On unlock the interval fires once and announces whichever
  second is current, or beeps if the timer expired meanwhile. Keeping audio
  alive in a locked pocket is a different feature — a silent media element
  holding the session open, plus pre-scheduling against the audio clock —
  and it is explicitly **out of scope** here.
- **iOS silent switch**: Web Audio is muted by the ringer switch. Nothing in
  this app makes a sound on a silenced phone, today included. Say so in the
  README's audio note, and turn the ringer on before judging the voice.
- **After a phone call or a headphone swap**, Safari has a history of leaving
  a context running at the wrong sample rate. A beep merely sounds off; a
  voice shifts every formant and becomes unintelligible. Recovery is to close
  and recreate the context. Named as a known limitation, not solved here.
- **Pause inside the final ten** stops the countdown at the next second
  boundary, as the tick does. A word already scheduled is allowed to finish;
  cutting a word off mid-vowel sounds broken.
- **A duration under ten seconds** starts the voice from the first second.
- **`remaining` outside 1 to 10** falls back to the beep.
- **Voice off** falls back to the current 1200 Hz tick, unchanged.

#### The acceptance bar

This section replaces a signal that works with one that must be tuned by ear,
and it does so by default for everyone. So the bar is written down in advance
rather than judged on the night:

> Played through a phone speaker at about three metres, to someone who has
> not heard it before and is told only that it is counting, at least 7 of the
> 10 words are identified correctly when played in shuffled order.

If it misses that bar, ship it default-off or do not ship it. Decide against
the bar, not against how much work it took.

#### Tests

`audio.js` has no tests at all today, and jsdom implements no Web Audio —
`AudioContext`, `OfflineAudioContext`, `BiquadFilterNode` and
`OscillatorNode` are all `undefined` — so this section brings its own
harness. A hand-rolled fake, not a new dependency: the repo has no
test-double library and should not grow one for this.

The fake must provide `currentTime`, `destination`, `createOscillator`,
`createBiquadFilter`, `createGain`, and a fake `AudioParam` recording
`setValueAtTime`, `linearRampToValueAtTime`, `cancelScheduledValues` and
`value`, plus every `connect` target so the graph can be walked.

**`tests/voice.test.js`** (new) — assertions that fail if the app is silent,
not merely if the table was mistyped:

- **Reachability**: walking `connect` from every started oscillator reaches
  `ctx.destination`.
- **Non-zero envelope**: every word's master gain schedules at least one
  value above zero after a zero.
- **No past events**: every scheduled time is at or after the `startTime`
  passed in, and every ramp is anchored by a `setValueAtTime` on the same
  param.
- **Budget measured on the nodes**: `max(stop times) - startTime` is under
  0.5 s, so `speakWord` cannot pass by returning a tidy number.
- **Ten distinct words**: no two words schedule the same set of segments —
  this is what catches "five" and "nine" being written identically.
- **Glides ramp, steady vowels do not.**
- **Every started node is stopped.**

**`tests/audio.test.js`** (new) — the seam nothing else covers, since
`useTimers.test.js` mocks all of `audio.js` and `voice.test.js` sits below
it. `vi.stubGlobal("AudioContext", FakeAudioContext)`, and because
`sharedAudioCtx` is a module singleton, `vi.resetModules()` between cases.
Assert: preference on gives a voice graph for `playCountdownTick(7)`;
preference off gives one 1200 Hz square oscillator; a suspended context
schedules nothing; no `AudioContext` global at all does not throw.

**`tests/useTimers.test.js`** — extend the existing case to assert
`playCountdownTick` is called *with* the second it announces, counting 10
down to 1, rather than only counting calls.

**Not testable here, so verify on a phone**, ringer on, through the speaker:
the acceptance bar above, plus nothing clipping and no word overrunning its
second.

---

### 5B. The result, spoken when a match is marked played

#### What it says

Marking a match played announces the outcome by name, in the app's own
voice: *"Bob lost, Tom won."*

The wording is a copy decision, not a technical one, and worth one thought
before building: this is a kids' app, and naming the loser first every single
match may land harder than intended. The alternative that keeps the
information and loses the sting is winner-first — *"Tom won, Bob lost"* — or
simply *"Tom wins it"*. The example above is what was asked for and is the
default; changing it is a one-line change to a single template.

#### Why this cannot use the oscillator

5A works because its ten words are known when the code is written. Player
names are typed in at setup, and turning arbitrary text into speech requires
grapheme-to-phoneme conversion, which is an entire field and not something to
hand-roll into a garden football app. There is no version of formant
synthesis that says "Aarav" or "Sifiso" acceptably.

So 5B uses the browser's built-in `speechSynthesis`. That is a different
mechanism from 5A with a different set of trade-offs, and the honest summary
is that it is **more** reliable than 5A in the one way that matters most
here: it is triggered by a tap.

- **The iOS gesture problem does not apply.** Browsers require a user gesture
  before speaking. Marking a match played *is* a tap, so the requirement is
  satisfied by construction. This is the opposite of the countdown, which
  fires from a timer with no gesture behind it.
- **Quality varies by device** and is robotic in a plainer way than 5A's
  voice. Nothing to do about that.
- **Availability varies.** `window.speechSynthesis` may be missing entirely;
  jsdom has none, and neither will some embedded browsers.

**Fallback when speech is unavailable or the voice preference is off:** a
two-note motif through the existing `tone()` helper — rising for a win,
falling for a draw. The app still tells you something happened; it just does
not say who.

#### Privacy, which matters more than it looks

Player names are children's names, typed by the family. Some platforms
provide network-backed voices, which would mean those names leaving the
device to be spoken. That is not an acceptable default for this app.

**Prefer a local voice explicitly**: filter `getVoices()` to
`voice.localService === true` and use the first match for the page's
language. If no local voice exists, fall back to the two-note motif rather
than speaking through a remote one. Say this in the README next to the note
about the app working offline.

#### Changes

**`src/engine/announce.js`** (new) — the pure part, separate from `voice.js`
because it is text, not oscillators:

```js
/* The sentence is pure so it can be tested without a speech engine. */
export function resultSentence(match, nameOf) { ... }   // string | null
export function speakResult(sentence) { ... }           // guarded side effect
```

`resultSentence` returns `null` for anything that is not a result: a bye, a
match with a missing player. A drawn match says **"All square"** rather than
"it's a draw", because in knockout, penalties and World Cup ties the card on
screen says the match still needs a winner, and the audio must not contradict
it by announcing a result.

**`src/engine/useTournament.js`** — `togglePlayed` grows from a one-liner,
following the shape `addGoal` already uses: read the match, fire the sound,
then set state. The side effect stays *outside* the state updater, which
matters because React may invoke an updater twice.

```js
const togglePlayed = (id) => {
  const match = matches.find((m) => m.id === id);
  if (match && !match.played) speakResult(resultSentence(match, nameOf));
  setMatches((p) => p.map((m) => (m.id === id ? { ...m, played: !m.played } : m)));
};
```

Announcing only on the false-to-true transition is the whole rule:
un-marking a match says nothing, and neither does re-marking one that is
already played.

**`speechSynthesis` handling** inside `speakResult`:

- `speechSynthesis.cancel()` before each utterance, so marking three matches
  quickly does not queue three sentences deep.
- `getVoices()` can be empty until the `voiceschanged` event fires; if it is
  empty on the first call, speak with the engine default rather than waiting,
  and pick the local voice from then on.
- Rate around 1.05 so it does not drag; default pitch.
- Wrapped in `try/catch` like everything else that makes noise.

#### Edge cases (must all hold)

- **Un-marking a played match** is silent.
- **A bye** is silent: there was no match.
- **A drawn match** says "All square", in every mode.
- **Both players named the same thing** produces "Sam lost, Sam won", which
  is daft but harmless and not worth special-casing.
- **A very long name** is spoken in full; the 24-character cap already keeps
  this bounded.
- **Voice preference off** gives the two-note motif, not silence.
- **No `speechSynthesis`** gives the two-note motif, no throw.
- **Marking played while a countdown word is mid-flight**: both sound at
  once. Accepted — a match being marked played means its timer is finished
  or irrelevant, so the overlap is rare and brief.

#### Tests

- **`tests/announce.test.js`** (new), pure and the bulk of the value:
  home win, away win, draw, bye, missing player, and that the sentence names
  the winner and loser correctly whichever side won. These are ordinary
  string assertions with no audio anywhere.
- **`tests/useTournament` coverage via `tests/App.playthrough.test.jsx`** —
  stub `window.speechSynthesis` with a fake recording utterance text, then
  assert marking a match played speaks a sentence containing both player
  names, and that clicking the same button again to un-mark speaks nothing.
  Use the existing `homeNameOfFirstCard` helper so the assertion does not
  assume which player drew the home slot.
- **No speech engine**: with `window.speechSynthesis` deleted, marking a
  match played does not throw.

---

### Review notes

This section was reviewed before being finalised. What the review changed:

- **The word table was vowels only**, which made "five" and "nine" identical
  rows — the section's own uniqueness test would have failed against its own
  data. Onsets, codas and per-word durations were added.
- **A single `Q` of 10 was wrong** for every low-F1 vowel and would have
  warbled. Replaced with specified bandwidths, plus per-branch gains to
  correct the sawtooth's spectral tilt, plus a master level and compressor.
- **The claim that noise requires an `AudioBufferSourceNode` was wrong.**
  Two oscillators in heavy FM give a serviceable fricative, so consonants
  moved from "deferred upgrade" into scope — the single biggest
  intelligibility win, at the cost of two nodes.
- **The screen-lock claim was backwards.** The original text implied the
  oscillator voice survives a screen lock where speech synthesis does not.
  Neither survives: iOS freezes the interval and interrupts the context.
  Corrected, and pocket use is now explicitly out of scope.
- **The proposed tests would all have passed on a silent app.** Rewritten
  around reachability to the destination, non-zero envelopes, no
  past-scheduled events, and a node-measured duration budget, plus a new
  `audio.test.js` for the one function that decides whether anything plays.
- **`getAudioContext` is no longer exported.** The wrapper moved into
  `audio.js`, keeping the context private and the unlock contract in one
  place, and leaving `voice.js` pure.
- **`speakFullTime` was cut** rather than shipped as an option that cannot
  sound right.
- **Scheduling hygiene, the pitch-per-number idea, the two-timer drop rule,
  the speaker button speaking on toggle, and the acceptance bar** were all
  added on the review's recommendation.

#### What building it changed again

- **The plan's own code sketch for 5B had a bug.** `resultSentence` was
  written to be called from `togglePlayed` with the *pre-toggle* match, so a
  version that checked `match.played` went silent in real use while its unit
  tests still passed. The module now documents why it must not look at that
  flag, and a regression test is named for it.
- **The empty-voice-list case was made stricter than the plan said.** The
  plan allowed speaking through the engine's default voice while
  `getVoices()` was still empty. That default may be a network voice, so the
  build plays the motif for that first call and caches the real list once
  the browser reports it. The stricter reading wins because the whole point
  of the rule is that children's names stay on the device.
- **Word envelopes are two layers, not one.** A single envelope on the
  master gain cannot make the closure gap in "six" actually silent, so there
  are per-segment gates feeding a word-level envelope.
- **Plosive edges reuse the fricative mechanism** at very short durations
  rather than introducing a fourth segment type. Zero samples still, but the
  difference between a click and a hiss is cruder than the table implies.
- **"Seven" is two sequential steady vowels** rather than a glide, because
  the table gives no path between ɛ and ə.

#### What the builder expects to be wrong on a phone

Recorded here because it was flagged honestly before anyone listened, and it
is the shortlist to check first when someone does:

- The two-oscillator fricative makes dense inharmonic sidebands, not true
  broadband noise, and may read as a buzz rather than an "s" on a small
  speaker.
- F1 for "two", "three" and "six" sits at 270 to 390 Hz even after scaling,
  and a phone speaker reproduces almost nothing down there — exactly the
  risk that put pitch, not vowels, in charge of carrying the count.
- The 5 ms plosive edges on "ten" and "two" may be too brief to survive a
  small speaker's transient response.

---

The review also recommended keeping the result announcement deferred. It is
included here anyway, at the explicit request of the person the app is for.
The reasoning for deferring it is preserved above in 5B: it needs a second
mechanism, and it crosses a boundary the mode contract otherwise keeps clean.
Both points are now handled rather than dodged — the mechanism is named and
isolated, and the announcement is driven from `useTournament`, which is the
one place that already knows both the score and the names.

---

### Update: 5A rebuilt on speechSynthesis, and a spoken pause reminder added

The acceptance bar above was never run — nobody heard 5A's oscillator voice
on a real phone before the owner decided to change course. Rather than tune
a synthesised voice by ear, the countdown now speaks through the same
`speechSynthesis` engine as the result (5B), so there is one voice engine
for everything the app says instead of two. The oscillator module
(`src/engine/voice.js` and its tests) has been deleted; its formant tables,
fricative synthesis and the rest of 5A's design above are historical record
only, not a description of what ships.

What's true now instead:

- **One shared speech primitive.** Local-voice selection and the `speak()`
  call live in `audio.js`, not `announce.js` — `announce.js` keeps just the
  sentence-building (`resultSentence`) and imports `speak()`, so there is
  still exactly one direction of import and no cycle. The local-voice-only
  rule is unchanged, and now serves two reasons instead of one: privacy for
  typed-in names, and reliability, since this app must work with no network
  and a network-backed voice would not.
- **The countdown** speaks "ten" down to "one" through `speak()`, falling
  back to the existing 1200 Hz tick when speech can't be confirmed (off,
  unavailable, or no local voice). `speechSynthesis.cancel()` runs before
  every utterance, the same rule 5B already used, so seconds never queue.
- **A new spoken pause reminder.** Pausing a running timer says "Game
  paused" once immediately, then repeats on a named interval
  (`PAUSE_REMINDER_INTERVAL_MS` in `useTimers.js`) for as long as it stays
  paused — players kept asking whether the game had stopped, so a single
  announcement wasn't enough. Resuming, resetting, changing the duration, or
  clearing all timers stop the repeat and cancel any in-flight utterance
  immediately. There is no beep fallback for this one: silence when there's
  nothing to speak with, not an invented noise.
- **No iOS-specific priming.** An earlier draft of this change primed the
  speech engine with a near-silent utterance on `startTimer`, reasoning that
  the timer-driven interval has no user gesture behind it. The owner
  decided against tailoring the app to iOS's gesture rules: there is no
  priming, detection, or retry logic. If a browser declines to speak
  without a fresh gesture, the countdown's beep fallback and the pause
  reminder's silence are the accepted result — the same fallbacks used for
  every other reason speech might be unavailable.

---

## Build order & verification

1. **Timer preset** — trivial and independent; ship first. *Shipped.*
2. **Chaos deck** — pure data; ship second. Independent of 1. *Shipped.*
3. **Best-of final** — three mode files, one engine module, one line in
   `SetupView`, one line in `contract.md`. Independent of 1 and 2; before
   the Wins tab because it's smaller and touches nothing the Wins tab does.
   *Shipped, after the Wins tab rather than before it — see the note at the
   top of this file.*
4. **Wins tab, step A** — client only; ships and is useful on its own.
   *Shipped.*
5. **Wins tab, step B** — migration first, then the API, then the client
   record change. Depends on 4. *Shipped alongside step A.*
6. **Talking scoreboard** — last, and only after review. *Built, 5B then
   5A, in that order.* It is the only item whose result cannot be judged
   from a test run, and that half of it remains outstanding: the voice
   still needs a quiet evening and a real garden before it should be on by
   default for anyone else.

For each step: `npm run lint`, `npm test`, `npm run build`, then on a
phone: pick `30s` and hear ten ticks and the beep; deal a 5-player, 2-leg
Chaos Cup and scroll the whole list for a repeated banner; set up a
best-of-3 final, win two legs and see the banner with the third leg
untouched; finish a tournament and watch its champion climb the Wins tab.

Cloud-mode check for step 5: apply `002` → deploy → finish a tournament on
one device → sign in on another and open Wins.

When shipped, update this file's status line the way `FEATURE-PLAN.md`
did, and note anywhere the built version departed from the plan and why.
