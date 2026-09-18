import { useMemo } from "react";
import { ListOrdered, Award } from "lucide-react";
import { C } from "../lib/theme.js";
import { makeId, alternateHome, generateGroupMatches } from "../engine/match.js";
import { computeStandings } from "../engine/standings.js";
import { seriesWinner } from "../engine/series.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import MatchCard from "../components/MatchCard.jsx";
import EmptyCard from "../components/EmptyCard.jsx";
import FixturesList from "../components/FixturesList.jsx";

const DEFAULT_LEGS = 3;
// The final's length is its own setup choice (see `finalLegs` below), no
// longer inherited from the group stage's `legCount`.
const DEFAULT_FINAL_LEGS = 3;

const groupMatchesOf = (matches) => matches.filter((m) => m.stage === "group");
const finalMatchesOf = (matches) => matches.filter((m) => m.stage === "final");

function generateFinalMatches(p1, p2, legCount, rng = Math.random) {
  return alternateHome(p1, p2, legCount, rng).map(([a, b], i) => (
    { id: makeId(), stage: "final", leg: i + 1, p1: a.id, p2: b.id, s1: "0", s2: "0", played: false }
  ));
}

function champion({ players, matches }) {
  const finalMatches = finalMatchesOf(matches);
  if (finalMatches.length === 0) return null;
  const finalists = players.filter((p) => p.id === finalMatches[0].p1 || p.id === finalMatches[0].p2);
  return seriesWinner(finalists, finalMatches);
}

export function advance({ players, matches, config, rng = Math.random }) {
  const standings = computeStandings(players, groupMatchesOf(matches));
  if (standings.length < 2) return { matches, modeState: {}, tab: "standings" };
  const finalLegs = config.finalLegs ?? DEFAULT_FINAL_LEGS;
  const final = generateFinalMatches(standings[0], standings[1], finalLegs, rng);
  return { matches: [...matches.filter((m) => m.stage !== "final"), ...final], modeState: {}, tab: "final" };
}

function FixturesView({ matches, config, nameOf, timerControls, actions }) {
  return <FixturesList matches={groupMatchesOf(matches)} legCount={config.legCount ?? DEFAULT_LEGS} nameOf={nameOf} timerControls={timerControls} actions={actions} />;
}

function StandingsView({ matches, standings, actions }) {
  const gm = groupMatchesOf(matches);
  const playedCount = gm.filter((m) => m.played).length;
  const finalExists = finalMatchesOf(matches).length > 0;
  return (
    <>
      <StandingsTable standings={standings} highlightTopN={2} />
      {standings.length >= 2 && (
        <button onClick={actions.advance} className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
          <Award size={16} /> {finalExists ? "REGENERATE FINAL" : "SET UP FINAL (TOP 2)"}
        </button>
      )}
      {playedCount < gm.length && (
        <p className="text-xs text-center" style={{ color: C.mute }}>
          {gm.length - playedCount} match{gm.length - playedCount === 1 ? "" : "es"} still to play — table updates live.
        </p>
      )}
    </>
  );
}

function FinalView({ players, matches, nameOf, champion, timerControls, actions }) {
  const finalMatches = finalMatchesOf(matches);
  const finalPlayedCount = finalMatches.filter((m) => m.played).length;
  const finalists = useMemo(
    () => (finalMatches.length ? players.filter((p) => p.id === finalMatches[0].p1 || p.id === finalMatches[0].p2) : []),
    [players, finalMatches]
  );
  const finalStandings = useMemo(() => computeStandings(finalists, finalMatches), [finalists, finalMatches]);

  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle={`Won the final ${champion.pts}–${finalStandings[1].pts} on points`} />}
      {finalMatches.length === 0 && <EmptyCard>No final set up yet — head to the Table tab and tap "Set up final".</EmptyCard>}
      {finalMatches.length > 0 && finalPlayedCount === finalMatches.length && !champion && finalStandings.length === 2 && (
        <div className="rounded-2xl p-4 text-sm text-center" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}`, color: C.sub }}>
          Final is level on points — play a decider to crown a champion.
        </div>
      )}
      <div className="space-y-2.5">
        {finalMatches.map((m) => (
          <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal} onTogglePlayed={actions.togglePlayed} {...timerControls(m.id)} />
        ))}
      </div>
      {finalists.length === 2 && <StandingsTable standings={finalStandings} />}
    </>
  );
}

export default {
  key: "league",
  label: "League + Final",
  desc: "Round robin, top 2 play off",
  icon: ListOrdered,
  minPlayers: 2,
  stages: ["group", "final"],
  config: {
    legCount: { type: "choice", label: "Legs per pairing", options: [1, 2, 3, 4], default: DEFAULT_LEGS },
    finalLegs: { type: "choice", label: "The final", options: [1, 3], default: DEFAULT_FINAL_LEGS, format: (n) => `Best of ${n}` },
  },
  summary: ({ players, config }) => {
    const legCount = config.legCount ?? DEFAULT_LEGS;
    const finalLegs = config.finalLegs ?? DEFAULT_FINAL_LEGS;
    const matchCount = (players.length * (players.length - 1) * legCount) / 2;
    return (
      <>
        <b style={{ color: C.ink }}>{matchCount} matches</b> ({players.length} players × {legCount} leg{legCount > 1 ? "s" : ""}), then the top 2 play a{" "}
        <b style={{ color: C.ink }}>best-of-{finalLegs} final</b>.
      </>
    );
  },
  generateLabel: "GENERATE FIXTURES",
  subtitle: ({ config }) => {
    const legCount = config.legCount ?? DEFAULT_LEGS;
    const finalLegs = config.finalLegs ?? DEFAULT_FINAL_LEGS;
    return `${legCount} LEG${legCount > 1 ? "S" : ""} · TOP 2 · BEST-OF-${finalLegs} FINAL`;
  },
  createFixtures: ({ players, config, rng = Math.random }) => ({
    matches: generateGroupMatches(players, config.legCount ?? DEFAULT_LEGS, rng),
    modeState: {},
    initialTab: "fixtures",
  }),
  champion,
  tabs: ({ matches, config }) => {
    const gm = groupMatchesOf(matches);
    const playedCount = gm.filter((m) => m.played).length;
    const finalMatches = finalMatchesOf(matches);
    const finalPlayedCount = finalMatches.filter((m) => m.played).length;
    return [
      { key: "fixtures", label: matches.length ? `Fixtures · ${playedCount}/${gm.length}` : "Fixtures" },
      { key: "standings", label: "Table" },
      { key: "final", label: finalMatches.length ? `Final · ${finalPlayedCount}/${config.finalLegs ?? DEFAULT_FINAL_LEGS}` : "Final" },
    ];
  },
  advance,
  views: { fixtures: FixturesView, standings: StandingsView, final: FinalView },
};
