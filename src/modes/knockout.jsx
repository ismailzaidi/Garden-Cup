import { useMemo } from "react";
import { Swords, ChevronRight } from "lucide-react";
import { C } from "../lib/theme.js";
import { makeId, shuffle, randomOrder, matchWinner, roundLabel } from "../engine/match.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import MatchCard from "../components/MatchCard.jsx";

export function generateKnockoutRound1(players, rng = Math.random) {
  const shuffled = shuffle(players, rng);
  let size = 1;
  while (size < shuffled.length) size *= 2;
  const slots = [...shuffled];
  while (slots.length < size) slots.push(null);
  const round = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    if (a && b) {
      round.push({ id: makeId(), stage: "knockout", round: 1, p1: a.id, p2: b.id, s1: "0", s2: "0", played: false, bye: false });
    } else if (a || b) {
      round.push({ id: makeId(), stage: "knockout", round: 1, p1: (a || b).id, p2: null, s1: "0", s2: "0", played: true, bye: true });
    }
  }
  return round;
}

function groupByRound(matches) {
  const rounds = {};
  matches.forEach((m) => { (rounds[m.round] = rounds[m.round] || []).push(m); });
  const nums = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  return { rounds, nums };
}

function latestRoundState(matches) {
  const { rounds, nums } = groupByRound(matches);
  const latestRound = nums[nums.length - 1];
  const latestMatches = rounds[latestRound] || [];
  const winners = latestMatches.map(matchWinner);
  const roundDecided = latestMatches.length > 0 && winners.every(Boolean);
  const isFinalRound = latestMatches.length === 1;
  return { rounds, nums, latestRound, latestMatches, winners, roundDecided, isFinalRound };
}

function champion({ players, matches }) {
  const { roundDecided, isFinalRound, winners } = latestRoundState(matches);
  const championId = isFinalRound && roundDecided ? winners[0] : null;
  return championId ? players.find((p) => p.id === championId) ?? null : null;
}

export function advance({ matches, rng = Math.random }) {
  const { latestRound, winners, roundDecided, isFinalRound } = latestRoundState(matches);
  if (!roundDecided || isFinalRound) return { matches, modeState: {}, tab: "bracket" };
  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    const [a, b] = randomOrder(winners[i], winners[i + 1], rng);
    next.push({ id: makeId(), stage: "knockout", round: latestRound + 1, p1: a, p2: b, s1: "0", s2: "0", played: false, bye: false });
  }
  return { matches: [...matches, ...next], modeState: {}, tab: "bracket" };
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
