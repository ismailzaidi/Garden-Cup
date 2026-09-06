# Adding a game mode

Garden Cup's game modes are plug-in modules under `src/modes/`. Adding one
touches exactly three things: a new file, one import, one array entry. Nothing
outside `src/modes/` should need to change. If you find yourself editing
`App.jsx`, a view in `src/views/`, or a component in `src/components/` to make
your mode work, stop — that means the mode contract is missing something, not
that your mode is unusual. Extend the contract (documented in full in
[`contract.md`](../src/modes/contract.md)) instead of special-casing it.

This walks through adding a real mode, **Best of N** — two players, a fixed
number of legs, most points after all legs wins — so you can see the shape of
a real diff, not just the interface.

## 1. Read the contract

Open [`src/modes/contract.md`](../src/modes/contract.md) first. It documents
every field a mode object can have, what props every view receives, and what
already lives in `engine/` and `components/` for you to import rather than
reimplement (standings, top scorers, match ids, shuffling, timers, audio, and
every dumb presentational component). `knockout.jsx` is the shortest complete
mode and is worth reading end to end as a second reference — it has a setup
config, a champion rule, a single view, and no second phase.

## 2. Sketch the mode before writing code

Answer these before opening an editor:

- **Identity** — key, label, one-line description, a `lucide-react` icon.
- **Player count** — `minPlayers`, and `maxPlayers` if the mode doesn't work
  for an open-ended roster (Best of N is exactly two players, always).
- **Setup config** — what does the player pick before generating? Each entry
  becomes a picker on the setup screen for free; you write the schema, not the
  UI. Best of N needs one: how many legs.
- **Fixtures** — what matches does `createFixtures` produce, and under what
  `stage` name? Pick a `stage` string no other mode uses.
- **Champion rule** — a pure function of players/matches/config/modeState.
  When is there no champion yet (not enough matches played, or the result is
  level)?
- **Does it have a second phase?** Only write `advance` if something happens
  after the initial fixtures play out (league's final; knockout's next round;
  king's next challenger). Best of N doesn't — the legs you generate are the
  whole tournament, same as `roundrobin`.
- **Views** — one component per tab. Reuse `components/FixturesList.jsx` if
  your mode is a filtered, leg-grouped list of matches; reuse
  `components/StandingsTable.jsx` and `components/MatchCard.jsx` regardless.

## 3. Write `src/modes/<key>.jsx`

Default-export the contract object. A minimal, single-phase mode (no
`advance`) looks like this — this is close to the real `bestofn.jsx`:

```jsx
import { Repeat } from "lucide-react";
import { C } from "../lib/theme.js";
import { makeId, alternateHome } from "../engine/match.js";
import { computeStandings } from "../engine/standings.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import MatchCard from "../components/MatchCard.jsx";

const DEFAULT_LEGS = 5;

function champion({ players, matches }) {
  if (matches.length === 0) return null;
  if (matches.some((m) => !m.played)) return null;
  const standings = computeStandings(players, matches);
  if (standings.length !== 2) return null;
  return standings[0].pts !== standings[1].pts ? standings[0] : null;
}

function MatchesView({ matches, nameOf, champion, standings, timerControls, actions }) {
  const playedCount = matches.filter((m) => m.played).length;
  return (
    <>
      {champion && (
        <ChampionBanner name={champion.name} subtitle={`${champion.pts}–${standings[1]?.pts ?? 0} on points`} />
      )}
      <StandingsTable standings={standings} />
      <div className="space-y-2.5">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={actions.addGoal}
            onUndoGoal={actions.undoGoal} onTogglePlayed={actions.togglePlayed} {...timerControls(m.id)} />
        ))}
      </div>
      {playedCount < matches.length && (
        <p className="text-xs text-center" style={{ color: C.mute }}>
          {matches.length - playedCount} leg{matches.length - playedCount === 1 ? "" : "s"} still to play.
        </p>
      )}
    </>
  );
}

export default {
  key: "bestofn",
  label: "Best of N",
  desc: "Two players, a fixed number of legs, most points wins",
  icon: Repeat,
  minPlayers: 2,
  maxPlayers: 2,
  stages: ["bestofn"],
  config: { legs: { type: "choice", label: "Number of legs", options: [3, 5, 7], default: DEFAULT_LEGS } },
  summary: ({ config }) => (
    <><b style={{ color: C.ink }}>{config.legs ?? DEFAULT_LEGS} legs</b> head to head. Most points wins; a level score means no champion yet.</>
  ),
  generateLabel: "GENERATE LEGS",
  subtitle: ({ config }) => `BEST OF ${config.legs ?? DEFAULT_LEGS} · HEAD TO HEAD`,
  createFixtures: ({ players, config, rng = Math.random }) => {
    const legs = config.legs ?? DEFAULT_LEGS;
    const matches = alternateHome(players[0], players[1], legs, rng).map(([a, b], i) => (
      { id: makeId(), stage: "bestofn", leg: i + 1, p1: a.id, p2: b.id, s1: "0", s2: "0", played: false }
    ));
    return { matches, modeState: {}, initialTab: "matches" };
  },
  champion,
  tabs: ({ matches }) => {
    const playedCount = matches.filter((m) => m.played).length;
    return [{ key: "matches", label: matches.length ? `Legs · ${playedCount}/${matches.length}` : "Legs" }];
  },
  views: { matches: MatchesView },
};
```

A few things this example leans on that are easy to miss:

- **`standings` arrives pre-computed.** The shell computes
  `computeStandings(players, matches-in-stages[0])` generically for every
  mode and hands it to every view as `standings` — Best of N's view never
  calls `computeStandings` itself. A mode with a second phase (like league's
  final) computes its *secondary* standings locally, but the primary table is
  always free.
- **`rng` is threaded, not called directly.** `createFixtures` and `advance`
  both receive `rng` and default it to `Math.random` — pass it into `shuffle`,
  `alternateHome`, and `generateGroupMatches` rather than letting them fall
  back on their own default, so the mode stays seedable in tests.
- **Home/away is not a per-match coin flip.** `p1` kicks off and wears the
  HOME tag, so `alternateHome` (two players over several legs) and
  `generateGroupMatches` (a round robin) each hand out home starts fairly.
  Calling `randomOrder` per match instead can leave a player away in every
  fixture they play.
- **`stage` must be unique.** Pick a string no other mode uses (`"bestofn"`
  here). It's what lets `computeStandings(players, matches-in-stages[0])`
  isolate the right matches, and it's what a future server-side schema
  validates against the mode registry instead of an enum.
- **No `advance` key at all if there's no second phase.** `roundrobin.jsx`
  and this example both omit it. The shell checks `if (!activeMode.advance)
  return;` before calling it, so leaving it off is safe, not a stub you fill
  in later.

## 4. Register it

In `src/modes/index.js`:

```diff
 import league from "./league.jsx";
 import roundrobin from "./roundrobin.jsx";
 import knockout from "./knockout.jsx";
 import king from "./king.jsx";
+import bestofn from "./bestofn.jsx";

-export const MODES = [league, knockout, king, roundrobin];
+export const MODES = [league, knockout, king, roundrobin, bestofn];
```

Then add the same key and its stages to `MODE_STAGES` in `api/_lib/modes.js`.
The server can't import this registry (it's client JSX), so it keeps a
hand-written mirror, and `tests/modeRegistryParity.test.js` is what catches
you forgetting: without it every save for the new mode 422s, the sync engine
treats that as non-retryable, and the user just sees a stuck "Sync error"
pill.

Those two files are the whole integration. The setup screen's mode grid, the
tab bar, the generate button, the config pickers, persistence (including the
schema migration, since v2 state is already keyed by mode/config/modeState
rather than a fixed set of fields), the Stats tab, and the History tab all
pick the new mode up automatically — none of them mention any mode by name.

## 5. Verify

- `npm run build` — should succeed with no bundle-size surprise.
- `npm test` — the existing suite should be untouched and green; add
  characterisation tests for any new pure logic your mode introduces (a
  champion rule, a fixture generator) the same way `knockout.test.js` and
  `king.test.js` do for theirs.
- Play through it for real: add exactly `minPlayers`/`maxPlayers` players,
  generate, play every match, confirm the champion banner and the History
  entry both appear.
- `git diff --stat` — for a self-contained mode like this one, it should show
  only the new mode file, the two-line change to `src/modes/index.js`, and
  the one-line change to `api/_lib/modes.js`. If it shows anything else, the
  contract was missing something — fix `contract.md` and the shell code that
  reads it, not the mode file.
