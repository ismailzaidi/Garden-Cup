# Five new game modes — implementation brief

Audience: the implementing agent. Goal: add five kid-focused game modes to
Garden Cup. Each one is a self-contained plug-in under `src/modes/` following
the existing contract — nothing outside `src/modes/` changes except the two
registries and one deliberate helper promotion described below.

**Read these first, in order:**

1. [`src/modes/contract.md`](../src/modes/contract.md) — every field a mode
   exports, the props bundle every view receives, and what already lives in
   `engine/`/`components/`.
2. [`docs/ADDING-A-MODE.md`](ADDING-A-MODE.md) — the worked example
   (`bestofn.jsx`) with the easy-to-miss details: `standings` arrives
   pre-computed, `rng` is threaded (never call `Math.random` directly),
   `stage` strings must be globally unique, omit `advance` entirely when
   there is no second phase.
3. `src/modes/king.jsx` and `src/modes/knockout.jsx` — the two reference
   implementations for modes *with* an `advance` transition.

## Ground rules (apply to every mode below)

- **Integration surface per mode:** the new `src/modes/<key>.jsx` file, one
  import + one array entry in `src/modes/index.js`, and one line in
  `api/_lib/modes.js` (`MODE_STAGES`) — the server keeps a hand-written
  mirror of `key → stages`, and `tests/modeRegistryParity.test.js` fails if
  you forget it. That test is the drift guard; do not weaken it.
- **Stage names must be unique across all modes.** Already taken: `group`,
  `final`, `knockout`, `king`, `bestofn`. The stages chosen below avoid them.
- **`createFixtures` and `advance` are pure and take `rng`** (default
  `Math.random`); pass it through to `shuffle`/`randomOrder`/
  `generateGroupMatches` so tests can seed them.
- **If `advance` doesn't apply to the current state, return the input state
  unchanged** — the caller doesn't check first.
- **Reuse, don't rebuild:** `MatchCard`, `StandingsTable`, `ChampionBanner`,
  `SectionLabel`, `EmptyCard`, `ProgressBar`, `computeStandings`,
  `generateGroupMatches`, `makeId`, `shuffle`, `randomOrder`, `matchWinner`,
  `roundLabel`. Keep components dumb — a mode's view passes props
  (`needsWinner`, `homeTag`, `hideToggle`, ...) rather than teaching a
  component about the mode.
- **Champion rules are pure functions of `{ players, matches, config,
  modeState }`** — they do NOT receive the `goals` log, so anything
  goal-count-based must be derived from match scores (`s1`/`s2` of played
  matches), which are the source of truth anyway.
- **Scores flow through `actions.addGoal(matchId, side)`**, which also feeds
  the goal log / Stats tab. That is fine for all five modes (noted per mode
  where it matters).
- **Tests:** each mode with non-trivial pure logic (a fixture generator, a
  champion rule, an `advance`) gets a characterisation test file under
  `tests/`, in the style of `knockout.test.js` / `king.test.js` — seedable
  rng, no React needed for the pure parts.
- **Kid-facing copy:** short, loud, playful. The existing modes set the tone
  ("START THE ARENA", "WINNER TAKES ALL"). Keep it in that register.

## One shared refactor first (prerequisite for mode 4)

`generateKnockoutRound1` and the round-advance helpers (`latestRoundState`,
the winner-pairing logic in `advance`) currently live inside
`src/modes/knockout.jsx` because only one mode used them. Mode 4 (Penalty
Shootout Cup) needs the same bracket machinery, and the contract forbids one
mode importing from another mode's file. So: promote them to a new
`src/engine/bracket.js`, have `knockout.jsx` import from there, update the
"what is shared" list in `contract.md`, and fix the import in
`tests/knockout.test.js`. Behaviour must not change — the existing knockout
tests stay green untouched (import path aside).

---

## Mode 1 — Garden World Cup (`worldcup`)

*The full tournament fantasy: group stage, semi-finals, a third-place match,
and THE FINAL. This is the mode kids will pick when everyone's round.*

- **Identity:** key `worldcup`, label "Garden World Cup", desc "Group stage,
  semi-finals, then the final", icon `Globe` (lucide-react),
  `minPlayers: 4`, no `maxPlayers`.
- **Stages:** `["wcgroup", "wcko"]` (`wcgroup` first so the shell's generic
  `standings` prop covers the group stage).
- **Config:** `groupLegs` — choice, label "Group games between each pair",
  options `[1, 2]`, default `1`.
- **`createFixtures`:** `shuffle(players, rng)`, deal alternately into
  groups A and B. Per group, call `generateGroupMatches(groupPlayers,
  groupLegs, rng)` and remap each match: `{ ...m, stage: "wcgroup",
  group: "A" }` (the generator hard-codes `stage: "group"`, which belongs to
  league/roundrobin — remap, don't touch the generator).
  `modeState: { groups: { A: [ids], B: [ids] } }`, `initialTab: "groups"`.
- **`advance`:**
  - All `wcgroup` matches played and no `wcko` matches yet → semi-finals
    (stage `wcko`, `round: 1`): A1 v B2 and B1 v A2, using
    `computeStandings` per group (filter matches by `m.group`).
    `randomOrder` home/away with the threaded rng.
  - Both semis decided (`matchWinner` non-null; draws don't count — see
    below) and no round-2 matches → generate the final (`round: 2`) between
    the winners AND a third-place match (`round: 2, thirdPlace: true`)
    between the losers. Kids care about the bronze — don't skip it.
  - Anything else → return state unchanged.
- **Champion:** the decided winner of the round-2 match that is **not**
  `thirdPlace`; otherwise `null`.
- **Views/tabs:** `groups` ("Groups") always; `knockout` ("Finals") only
  once `wcko` matches exist. GroupsView: per group a `SectionLabel`
  ("Group A"), a `StandingsTable` of that group's local standings, its
  `MatchCard`s, then the advance button ("KICK OFF THE SEMI-FINALS") when
  the stage is complete. FinalsView: modelled on knockout's BracketView —
  sections "Semi-finals", "Third place", "The Final"; `needsWinner` on every
  `wcko` MatchCard (no draws in the knockout rounds — settle it in the
  garden, then enter the winner's score higher); `ChampionBanner` subtitle
  "Garden World Cup winner".
- **Edge cases:** 4 players means both group members advance — that's fine,
  the semis still reshuffle across groups. Odd player counts make uneven
  groups — also fine, `generateGroupMatches` and `computeStandings` don't
  care.
- **Tests:** group dealing is deterministic under a seeded rng; semis pair
  A1/B2 and B1/A2; final + third-place generated only when both semis are
  decided; champion comes from the final, never the third-place match.

## Mode 2 — Golden Boot Race (`goldenboot`)

*Nobody defends. First player to bang in N total goals across all their
matches wins the Golden Boot. Pure scoring joy, with a live race chart.*

- **Identity:** key `goldenboot`, label "Golden Boot Race", desc "First to
  score N goals in total wins", icon `Target`, `minPlayers: 2`.
- **Stages:** `["goldenboot"]`.
- **Config:** `bootTarget` — choice, label "Goals to win the Golden Boot",
  options `[5, 10, 15]`, default `10`.
- **`createFixtures`:** `generateGroupMatches(players, 1, rng)` remapped to
  `stage: "goldenboot"` (keep the generator's `leg` field for grouping).
  Empty `modeState`, `initialTab: "race"`.
- **Goal totals:** derive from played matches only — for each player, sum
  the `s1`/`s2` they scored. Put this in an exported pure helper
  (`computeGoalTotals(players, matches)`) inside the mode file so the
  champion rule and the view share it and it's directly testable.
- **Champion:** among players with total ≥ `bootTarget`, the unique maximum;
  two or more tied at the max → `null` (race isn't settled).
- **`advance` ("one more round!"):** applies only when every fixture is
  played and there's no champion. Nobody reached the target → append one
  more full round-robin leg (leg numbers continue). Two-plus tied at the
  max ≥ target → append a mini round-robin among **only** the tied players
  (a straight head-to-head when it's two). Otherwise unchanged.
- **Views/tabs:** single `race` tab ("Race"). Top: the race — one row per
  player, sorted by total, `ProgressBar` toward `bootTarget`, the leader
  visually crowned; this is the centrepiece, make it big. Below: MatchCards
  grouped by leg with `SectionLabel`s. `ChampionBanner` subtitle
  "Golden Boot winner — first to {target}". When `advance` applies, the
  button reads "EXTRA ROUND — RACE ISN'T OVER".
- **Note:** conceding doesn't matter and draws don't matter — only goals
  scored. Say so in `summary` so it reads as a feature, not a bug.
- **Tests:** totals ignore unplayed matches; champion null on a tie at the
  max; tiebreaker fixtures include only the tied players; extra leg
  numbering continues from the last leg.

## Mode 3 — Last One Standing (`survivor`)

*Every round, everyone plays everyone — then the bottom of the table is OUT.
Repeat until one player is left standing. Maximum drama.*

- **Identity:** key `survivor`, label "Last One Standing", desc "Lowest
  scorer is knocked out every round", icon `Flame`, `minPlayers: 3`.
- **Stages:** `["survivor"]`.
- **Config:** none (`{}`).
- **`createFixtures`:** round-robin among all players via
  `generateGroupMatches(players, 1, rng)`, remapped to `{ ...m, stage:
  "survivor", round: 1 }`. `modeState: { alive: [all ids], eliminated: [] }`
  (`eliminated` entries: `{ id, round }`). `initialTab: "rounds"`.
- **`advance` (the elimination):** applies only when every match of the
  highest `round` is played. Compute standings over **that round's matches
  only**, restricted to alive players; the last-placed player is eliminated
  (append to `eliminated`, remove from `alive`). Then: if 2+ players remain,
  generate the next round's round-robin among survivors (`round + 1`); if 1
  remains, generate nothing — they're the champion. Ties at the bottom are
  split by `computeStandings`' existing order (points, then goal
  difference, then goals scored, then name) — do not invent a new
  tiebreaker; instead state it in the UI copy.
- **Champion:** `modeState.alive.length === 1` → that player.
- **Views/tabs:** `rounds` ("Arena") — current round's MatchCards under a
  `SectionLabel` ("Round {n} — {alive} left"); while the round is live, show
  the current round-table with the last-placed row highlighted in the danger
  colour ("in the drop zone"); when the round completes, the advance button:
  "KNOCK OUT THE LAST PLACE". Below, an "Out of the garden" list — each
  eliminated player with the round they went out (newest first), styled
  like king.jsx's Results list. `ChampionBanner` subtitle "Last one
  standing". Second tab `table` ("Table") showing the shell's cumulative
  `standings` across all rounds.
- **Edge cases:** all-drawn rounds still eliminate someone (standings order
  decides); with 3 players round sizes go 3 → 2, so the last round is a
  single head-to-head final — a nice natural climax, no special-casing
  needed.
- **Tests:** elimination picks `computeStandings`' last row; the next round
  only includes survivors; champion appears exactly when one player is
  left; `advance` is a no-op while the round is unfinished.

## Mode 4 — Penalty Shootout Cup (`penalties`)

*A knockout bracket where every tie is a penalty shootout. No pitch marathon
— just nerves. Kids re-enact the World Cup final shootout every summer;
now the app keeps score.*

- **Prerequisite:** the `engine/bracket.js` promotion described above.
- **Identity:** key `penalties`, label "Penalty Shootout Cup", desc
  "A knockout decided entirely on pens", icon `Goal` (lucide-react has it;
  fall back to `CircleDot` if the installed version doesn't),
  `minPlayers: 2`.
- **Stages:** `["pens"]`.
- **Config:** `pensEach` — choice, label "Penalties per player", options
  `[3, 5]`, default `5`.
- **`createFixtures`:** `generateKnockoutRound1(players, rng)` from
  `engine/bracket.js`, remapped to `stage: "pens"`. Byes carry over as-is
  (MatchCard already renders them).
- **`advance`:** identical round-pairing logic to knockout, via the shared
  helpers. Winners pair up, `randomOrder`, next `round`.
- **Match semantics:** the score IS penalties converted. `needsWinner` on
  every MatchCard — a level shootout goes to sudden death **in the garden**
  and the final converted tallies (e.g. 6–5) go in the app. Put that rule in
  the view copy: "Still level after {pensEach} each? Sudden death — keep
  tapping until someone misses." The timer widget is simply never started;
  no changes to MatchTimer.
- **Champion:** winner of the decided single-match final round (same rule as
  knockout).
- **Views/tabs:** single `bracket` ("Shootout") tab, closely following
  knockout's BracketView (`roundLabel` headings, advance button "NEXT
  ROUND OF SHOOTOUTS"). `ChampionBanner` subtitle "Ice in the veins —
  shootout champion".
- **Conscious trade-off (state it in `summary`):** converted pens are
  recorded through `actions.addGoal`, so they count in the Stats tab like
  goals. For a garden app that's a feature — the shootout king tops the
  scorer chart. Do not build a parallel scoring path.
- **Tests:** mostly covered by the shared bracket tests after the
  promotion; add one test that `createFixtures` stamps `stage: "pens"` on
  every match including byes.

## Mode 5 — Chaos Cup (`chaos`)

*A round-robin where every match comes with a random silly rule the players
must obey in real life. The app is the referee that deals the chaos.*

- **Identity:** key `chaos`, label "Chaos Cup", desc "Every match has a
  random silly rule", icon `Dices`, `minPlayers: 2`.
- **Stages:** `["chaos"]`.
- **Config:** `legs` — choice, label "Times each pair plays", options
  `[1, 2]`, default `1`.
- **The twist deck** — a `TWISTS` array in the mode file, each
  `{ key, emoji, label, detail }`. Ship these ten:
  1. 🦶 "Weak foot only" — shoot with your wrong foot.
  2. 🕐 "One touch" — one touch to shoot, no dribbling.
  3. 🧎 "Sitting keeper" — keepers must sit on the ground.
  4. 🤫 "Silent match" — talk or celebrate out loud and the goal doesn't count.
  5. 🐢 "Slow-mo celebrations" — every goal must get a slow-motion replay celebration.
  6. 🔁 "Swap ends" — attack the other goal after every goal scored.
  7. 🎯 "Long range only" — goals only count from outside the box / past the cone line.
  8. 🐸 "Hop start" — restart play hopping on one leg until you touch the ball.
  9. 🙈 "No looking" — penalty taker must look away as they shoot (keeper picks when).
  10. 👑 "Commentator match" — you must commentate your own play, third person.
  Twists are physical rules only — they never change how the app scores, so
  the generic standings stay valid. Do not add score-multiplier twists.
- **`createFixtures`:** `generateGroupMatches(players, legs, rng)` remapped
  to `stage: "chaos"`, then stamp each match with a twist drawn with the
  threaded rng — deal without repeats until the deck is exhausted, then
  reshuffle (so ≤10 matches never see a duplicate). Store the twist key on
  the match (`twist: "weak-foot"`). `initialTab: "fixtures"`.
- **Champion:** same shape as roundrobin's — all matches played and a clear
  points leader (`standings[0].pts !== standings[1].pts`), else `null`
  (mirror `roundrobin.jsx` exactly).
- **Views/tabs:** single `fixtures` ("Chaos") tab. `StandingsTable` up top,
  then MatchCards grouped by leg — each card preceded by its twist banner
  (emoji + label big, `detail` underneath in mute). MatchCard stays dumb:
  the banner is the view's element sitting above the card, not a MatchCard
  prop. `ChampionBanner` subtitle "Survived the chaos". `generateLabel`:
  "DEAL THE CHAOS".
- **Tests:** twist assignment is deterministic under a seeded rng; no
  duplicate twists within the first 10 matches; every match carries a valid
  twist key; champion mirrors the roundrobin rule.

---

## Suggested implementation order

1. `chaos` (single-phase warm-up, exercises the remap-and-stamp pattern)
2. `goldenboot` (first custom champion rule + a real `advance`)
3. `survivor` (modeState-driven elimination, closest to `king`)
4. the `engine/bracket.js` promotion, then `penalties`
5. `worldcup` (the big one — two stages, three advancement steps)

One commit per numbered step, keeping the suite green at every commit.

## Verification checklist (per mode, from ADDING-A-MODE.md)

- [ ] `npm run build` clean.
- [ ] `npm test` green — including `modeRegistryParity.test.js`, which means
      `api/_lib/modes.js` got its line.
- [ ] New pure logic has characterisation tests with a seeded rng.
- [ ] Manual playthrough: add `minPlayers` players, generate, play every
      match, confirm the champion banner AND the History entry appear.
- [ ] `git diff --stat` shows only: the mode file, `src/modes/index.js`,
      `api/_lib/modes.js`, tests — plus, for step 4 only, the
      `engine/bracket.js` promotion. Anything else means the contract needs
      extending; fix the contract, not the mode.
