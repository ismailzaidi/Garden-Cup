import { Users } from "lucide-react";
import { C } from "../lib/theme.js";
import { generateGroupMatches } from "../engine/match.js";
import { computeStandings } from "../engine/standings.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import FixturesList from "../components/FixturesList.jsx";

const DEFAULT_LEGS = 3;

const groupMatchesOf = (matches) => matches.filter((m) => m.stage === "group");

function champion({ players, matches }) {
  const gm = groupMatchesOf(matches);
  if (gm.length === 0) return null;
  const playedCount = gm.filter((m) => m.played).length;
  if (playedCount !== gm.length) return null;
  const standings = computeStandings(players, gm);
  if (standings.length === 0) return null;
  if (standings.length > 1 && standings[0].pts === standings[1].pts) return null;
  return standings[0];
}

function FixturesView({ matches, config, nameOf, timerControls, actions }) {
  return <FixturesList matches={groupMatchesOf(matches)} legCount={config.legCount ?? DEFAULT_LEGS} nameOf={nameOf} timerControls={timerControls} actions={actions} />;
}

function StandingsView({ matches, champion, standings }) {
  const gm = groupMatchesOf(matches);
  const playedCount = gm.filter((m) => m.played).length;
  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle={`${champion.pts} pts · ${champion.w}W ${champion.d}D ${champion.l}L`} />}
      <StandingsTable standings={standings} />
      {playedCount < gm.length && (
        <p className="text-xs text-center" style={{ color: C.mute }}>
          {gm.length - playedCount} match{gm.length - playedCount === 1 ? "" : "es"} still to play — table updates live.
        </p>
      )}
    </>
  );
}

export default {
  key: "roundrobin",
  label: "Pure League",
  desc: "Round robin, no final — top of table wins",
  icon: Users,
  minPlayers: 2,
  stages: ["group"],
  config: {
    legCount: { type: "choice", label: "Legs per pairing", options: [1, 2, 3, 4], default: DEFAULT_LEGS },
  },
  summary: ({ players, config }) => {
    const legCount = config.legCount ?? DEFAULT_LEGS;
    const matchCount = (players.length * (players.length - 1) * legCount) / 2;
    return (
      <>
        <b style={{ color: C.ink }}>{matchCount} matches</b> ({players.length} players × {legCount} leg{legCount > 1 ? "s" : ""}). Top of the table wins.
      </>
    );
  },
  generateLabel: "GENERATE FIXTURES",
  subtitle: ({ config }) => {
    const legCount = config.legCount ?? DEFAULT_LEGS;
    return `ROUND ROBIN · ${legCount} LEG${legCount > 1 ? "S" : ""} · TOP OF TABLE WINS`;
  },
  createFixtures: ({ players, config, rng = Math.random }) => ({
    matches: generateGroupMatches(players, config.legCount ?? DEFAULT_LEGS, rng),
    modeState: {},
    initialTab: "fixtures",
  }),
  champion,
  tabs: ({ matches }) => {
    const gm = groupMatchesOf(matches);
    const playedCount = gm.filter((m) => m.played).length;
    return [
      { key: "fixtures", label: matches.length ? `Fixtures · ${playedCount}/${gm.length}` : "Fixtures" },
      { key: "standings", label: "Table" },
    ];
  },
  views: { fixtures: FixturesView, standings: StandingsView },
};
