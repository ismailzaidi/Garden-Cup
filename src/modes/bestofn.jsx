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
