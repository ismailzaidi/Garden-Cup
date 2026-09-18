# The mode contract

A game mode is a single file under `src/modes/` that default-exports one
object matching the shape below. `src/modes/index.js` imports it and adds it
to the `MODES` array — that is the entire integration surface. If a mode needs
something that isn't on this contract, extend the contract deliberately
rather than reaching back into `App.jsx` or another mode's file.

```js
export default {
  /* identity */
  key: "knockout",                 // stable; also the value persisted as `mode`
  label: "Knockout",
  desc: "Single elimination bracket",
  icon: Swords,                    // a lucide-react component
  minPlayers: 2,
  maxPlayers: undefined,           // optional; omit for "no ceiling" (all four
                                    // built-in modes do). The shell disables
                                    // "Add a player" once this is hit — see a
                                    // fixed head-to-head mode for an example.
  stages: ["knockout"],            // the match.stage values this mode owns —
                                    // stages[0] is used by the shell to compute
                                    // the generic `standings` prop (see below)

  /* setup */
  config: {                        // declarative — SetupView renders one
                                    // picker per entry, generically
    kingTarget: {
      type: "choice",
      label: "Wins in a row to take the crown",
      options: [2, 3, 4, 5],
      default: 3,
    },
    finalLegs: {
      type: "choice",
      label: "The final",
      options: [1, 3],
      default: 3,
      format: (n) => `Best of ${n}`,   // optional — SetupView renders
                                        // `spec.format ? spec.format(opt) : opt`,
                                        // so a picker's buttons can read
                                        // "Best of 1" / "Best of 3" instead of
                                        // a bare option value. The stored
                                        // config value is still the raw option.
    },
  },
  summary: ({ players, config }) => <>...</>,   // the setup-screen blurb
  generateLabel: "GENERATE BRACKET",            // initial button label; the
                                                 // shell overrides it to
                                                 // "REGENERATE (CLEARS SCORES)"
                                                 // once matches exist, for
                                                 // every mode alike
  subtitle: ({ config }) => "SINGLE ELIMINATION · WINNER TAKES ALL",

  /* lifecycle */
  createFixtures: ({ players, config, rng }) => ({
    matches: [...],
    modeState: {},                // e.g. king returns { queue: [...] }
    initialTab: "bracket",
  }),

  /* derived — pure, no hooks */
  champion: ({ players, matches, config, modeState }) => player | null,

  /* navigation — return ONLY this mode's own tabs; the shell prepends
     "Players" and appends "Stats"/"History" itself */
  tabs: ({ matches, config, modeState }) => [{ key, label }],

  /* transition — optional; omit if the mode has no advancement step
     (pure round robin just plays out its fixtures). Pure: takes the
     current state and rng, returns the next state. The shell applies it —
     see "Advancement actions" below. */
  advance: ({ players, matches, config, modeState, rng }) => ({
    matches: nextMatches,
    modeState: nextModeState,
    tab: "bracket",
  }),

  /* rendering */
  views: {
    bracket: BracketView,          // each view gets the same props bundle —
                                    // see "Props every view receives" below
  },
};
```

`src/modes/index.js` is then:

```js
import league from "./league.jsx";
import roundrobin from "./roundrobin.jsx";
import knockout from "./knockout.jsx";
import king from "./king.jsx";

export const MODES = [league, roundrobin, knockout, king];
export const getMode = (key) => MODES.find((m) => m.key === key) ?? MODES[0];
```

Adding a mode is: write the file, add the import, add it to the array. Nothing
outside `src/modes/` should need to change.

## Advancement actions belong to the mode, not the shell

The old `generateFinal`, `advanceRound`, and `advanceKing` functions mutated
shared state directly. They do **not** appear on the contract as
free-floating callbacks. Instead a mode exports a pure `advance` transition
function — current state in, next state out — and the shell (by way of
`engine/useTournament.js`) applies the result:

```js
const result = mode.advance({ players, matches, config, modeState, rng: Math.random });
setMatches(result.matches);
setModeState(result.modeState);
if (result.tab) setTab(result.tab);
```

A mode's view calls this through `actions.advance()`. This keeps every
transition testable without React, which matters because these are the
functions most likely to break when a mode changes.

If `advance` doesn't apply for a given state (e.g. the round isn't decided
yet, or there's no live match), return the input state unchanged rather than
throwing — the caller doesn't check before calling.

## Props every mode view receives

One bundle, passed to every registered view. Views destructure what they
need and ignore the rest.

```js
{
  players, matches, goals, config, modeState,
  nameOf,                     // (id) => name
  standings,                  // computeStandings(players, matches-in-stages[0])
                               // — the mode's *primary* table. A mode with a
                               // second phase (league's final) computes its
                               // own secondary standings locally by importing
                               // computeStandings from engine/standings.js.
  champion,                   // this mode's champion() result, already computed
  timerControls,              // (matchId) => { timer, onStart, onPause, onReset, onSetDuration }
  actions: {
    addGoal, undoGoal, togglePlayed, advance, setTab,
  },
}
```

## What is shared and must not move into a mode

These live in `engine/` and `components/`; modes import them rather than
redefining them:

- `computeStandings`, `computeTopScorers`, `computeMinuteBuckets` — generic
  over any list of matches; also power the shared Stats tab.
- `matchWinner`, `shuffle`, `randomOrder`, `roundLabel`, `makeId`.
- `generateGroupMatches` — the round-robin generator used by every mode with
  a round-robin phase (`league`, `roundrobin`, `chaos`, `goldenboot`,
  `survivor`, `leaguechaos`). It stamps `stage: "group"`; a mode owning a
  different stage remaps the returned matches rather than changing the
  generator. It also owns home/away balance: `p1` is the home side, and the
  generator guarantees every player a fair share of home starts, so a mode
  must not re-flip the sides it returns.
- `alternateHome` — the same guarantee for a two-player leg series (a Best of
  N, a multi-leg final): one flip picks who hosts leg 1, then it alternates.
  Use it instead of calling `randomOrder` per leg, which can hand one player
  every away start.
- `engine/twists.js` — `TWISTS`, `dealTwists`, `twistOf`, the deck of silly
  real-world rules shared by `chaos` and `leaguechaos`. A twist must never
  change how a goal counts, or the generic standings stop being valid.
- `engine/bracket.js` — `generateKnockoutRound1`, `latestRoundState`,
  `bracketChampion`, and `advanceBracket`, the single-elimination machinery
  shared by `knockout` and `penalties`. `advanceBracket` takes the stage to
  stamp on the next round, so a bracket mode never has to remap mid-flight.
- All audio (`engine/audio.js`) and all timer logic (`engine/useTimers.js`) —
  timers are per match, not per mode.
- `MatchCard`, `MatchTimer`, `GoalPanel`, `StandingsTable`, `SectionLabel`,
  `EmptyCard`, `ChampionBanner`, `ProgressBar`, `TwistBanner` — keep them dumb. They decide
  nothing about which mode is active; the mode's view passes in the values
  (`needsWinner`, `homeTag`, `awayTag`, `hideToggle`, ...) that make them
  behave correctly for that mode.
- The Stats, Wins and History tabs (`views/StatsView.jsx`, `views/WinsView.jsx`,
  `views/HistoryView.jsx`) — every mode gets all three, unconditionally, from
  the shell.

Fixture generators and transition logic that only one mode uses
(`generateFinalMatches`, `makeKingMatch`, `computeKingStreaks`,
`computeGoalTotals`) live inside that mode's own file — until a second mode
needs them, at which point they move to `engine/` (or `components/`) rather
than being imported across modes. `engine/bracket.js` is exactly that move:
it was `knockout`'s private code until `penalties` needed the same bracket.
`engine/twists.js` and `components/TwistBanner.jsx` are the same move again,
out of `chaos` once `leaguechaos` needed the deck.
