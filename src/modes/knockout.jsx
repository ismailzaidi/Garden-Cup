import { useMemo } from "react";
import { Swords, ChevronRight } from "lucide-react";
import { C } from "../lib/theme.js";
import { roundLabel } from "../engine/match.js";
import { generateKnockoutRound1, latestRoundState, bracketChampion, advanceBracket } from "../engine/bracket.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import MatchCard from "../components/MatchCard.jsx";

function champion({ players, matches }) {
  return bracketChampion(players, matches);
}

export function advance({ matches, rng = Math.random }) {
  return { matches: advanceBracket(matches, "knockout", rng), modeState: {}, tab: "bracket" };
}

function BracketView({ matches, nameOf, champion, timerControls, actions }) {
  const { rounds, nums, roundDecided, isFinalRound } = useMemo(() => latestRoundState(matches), [matches]);
  const canAdvance = roundDecided && !isFinalRound;

  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle="Unbeaten through the bracket" />}
      {nums.map((rn) => (
        <div key={rn}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", color: C.pitch }}>{roundLabel(rounds[rn].length)}</span>
            <div className="flex-1 border-t border-dashed" style={{ borderColor: "#C9C2AC" }} />
          </div>
          <div className="space-y-2.5">
            {rounds[rn].map((m) => (
              <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal} onTogglePlayed={actions.togglePlayed} needsWinner {...timerControls(m.id)} />
            ))}
          </div>
        </div>
      ))}
      {canAdvance && (
        <button onClick={actions.advance} className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
          <ChevronRight size={16} /> ADVANCE TO NEXT ROUND
        </button>
      )}
    </>
  );
}

export default {
  key: "knockout",
  label: "Knockout",
  desc: "Single elimination bracket",
  icon: Swords,
  minPlayers: 2,
  stages: ["knockout"],
  config: {},
  summary: ({ players }) => (
    <><b style={{ color: C.ink }}>{players.length} players</b> shuffled into a random bracket — byes handed out automatically.</>
  ),
  generateLabel: "GENERATE BRACKET",
  subtitle: () => "SINGLE ELIMINATION · WINNER TAKES ALL",
  createFixtures: ({ players, rng = Math.random }) => ({
    matches: generateKnockoutRound1(players, rng),
    modeState: {},
    initialTab: "bracket",
  }),
  champion,
  tabs: ({ matches }) => {
    const { latestRound } = latestRoundState(matches);
    return [{ key: "bracket", label: matches.length ? `Bracket · R${latestRound}` : "Bracket" }];
  },
  advance,
  views: { bracket: BracketView },
};
