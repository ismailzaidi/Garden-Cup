import { useMemo } from "react";
import { Goal, ChevronRight } from "lucide-react";
import { C } from "../lib/theme.js";
import { roundLabel } from "../engine/match.js";
import { generateKnockoutRound1, latestRoundState, bracketChampion, advanceBracket } from "../engine/bracket.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import MatchCard from "../components/MatchCard.jsx";

const DEFAULT_PENS = 5;

function champion({ players, matches }) {
  return bracketChampion(players, matches);
}

export function advance({ matches, rng = Math.random }) {
  return { matches: advanceBracket(matches, "pens", rng), modeState: {}, tab: "bracket" };
}

function ShootoutView({ matches, config, nameOf, champion, timerControls, actions }) {
  const pensEach = config.pensEach ?? DEFAULT_PENS;
  const { rounds, nums, roundDecided, isFinalRound } = useMemo(() => latestRoundState(matches), [matches]);
  const canAdvance = roundDecided && !isFinalRound;

  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle="Ice in the veins — shootout champion" />}

      <div className="rounded-2xl p-3.5" style={{ backgroundColor: "#FDF3D9", border: `2px solid ${C.gold}` }}>
        <p className="text-sm" style={{ color: C.sub }}>
          <b style={{ color: C.ink }}>{pensEach} pens each.</b> Tap a score for every one you put away. Still level after{" "}
          {pensEach} each? Sudden death — keep tapping until someone misses.
        </p>
      </div>

      {nums.map((rn) => (
        <div key={rn}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", color: C.pitch }}>{roundLabel(rounds[rn].length)}</span>
            <div className="flex-1 border-t border-dashed" style={{ borderColor: "#C9C2AC" }} />
          </div>
          <div className="space-y-2.5">
            {rounds[rn].map((m) => (
              <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal}
                onTogglePlayed={actions.togglePlayed} needsWinner {...timerControls(m.id)} />
            ))}
          </div>
        </div>
      ))}

      {canAdvance && (
        <button onClick={actions.advance}
          className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
          <ChevronRight size={16} /> NEXT ROUND OF SHOOTOUTS
        </button>
      )}
    </>
  );
}

export default {
  key: "penalties",
  label: "Penalty Shootout Cup",
  desc: "A knockout decided entirely on pens",
  icon: Goal,
  minPlayers: 2,
  stages: ["pens"],
  config: {
    pensEach: { type: "choice", label: "Penalties per player", options: [3, 5], default: DEFAULT_PENS },
  },
  summary: ({ players, config }) => (
    <>
      <b style={{ color: C.ink }}>{players.length} players</b> in a random bracket, every tie settled by{" "}
      <b style={{ color: C.ink }}>{config.pensEach ?? DEFAULT_PENS} pens each</b>. Every one you score counts on the
      scorer chart, so the shootout king tops the stats too.
    </>
  ),
  generateLabel: "GENERATE THE SHOOTOUTS",
  subtitle: ({ config }) => `PENALTY SHOOTOUT CUP · ${config.pensEach ?? DEFAULT_PENS} PENS EACH · SUDDEN DEATH IF LEVEL`,
  createFixtures: ({ players, rng = Math.random }) => ({
    matches: generateKnockoutRound1(players, rng).map((m) => ({ ...m, stage: "pens" })),
    modeState: {},
    initialTab: "bracket",
  }),
  champion,
  tabs: ({ matches }) => {
    const { latestRound } = latestRoundState(matches);
    return [{ key: "bracket", label: matches.length ? `Shootout · R${latestRound}` : "Shootout" }];
  },
  advance,
  views: { bracket: ShootoutView },
};
