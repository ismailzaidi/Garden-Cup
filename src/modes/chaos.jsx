import { Dices } from "lucide-react";
import { C } from "../lib/theme.js";
import { generateGroupMatches } from "../engine/match.js";
import { dealTwists, twistOf } from "../engine/twists.js";
import { computeStandings } from "../engine/standings.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import MatchCard from "../components/MatchCard.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import TwistBanner from "../components/TwistBanner.jsx";

const DEFAULT_LEGS = 1;

const chaosMatchesOf = (matches) => matches.filter((m) => m.stage === "chaos");

function champion({ players, matches }) {
  const cm = chaosMatchesOf(matches);
  if (cm.length === 0) return null;
  if (cm.some((m) => !m.played)) return null;
  const standings = computeStandings(players, cm);
  if (standings.length === 0) return null;
  if (standings.length > 1 && standings[0].pts === standings[1].pts) return null;
  return standings[0];
}

function FixturesView({ matches, config, nameOf, champion, standings, timerControls, actions }) {
  const cm = chaosMatchesOf(matches);
  const playedCount = cm.filter((m) => m.played).length;
  const legCount = config.chaosLegs ?? DEFAULT_LEGS;
  const legs = Array.from({ length: legCount }, (_, i) => i + 1).filter((l) => cm.some((m) => m.leg === l));

  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle="Survived the chaos" />}
      <StandingsTable standings={standings} />
      <ProgressBar value={playedCount} total={cm.length} />
      {legs.map((leg) => (
        <div key={leg}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", color: C.pitch }}>LEG {leg}</span>
            <div className="flex-1 border-t border-dashed" style={{ borderColor: "#C9C2AC" }} />
          </div>
          <div className="space-y-3">
            {cm.filter((m) => m.leg === leg).map((m) => (
              <div key={m.id}>
                <TwistBanner twist={twistOf(m.twist)} />
                <MatchCard match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal}
                  onTogglePlayed={actions.togglePlayed} {...timerControls(m.id)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {cm.length > 0 && playedCount === cm.length && !champion && (
        <p className="text-xs text-center" style={{ color: C.mute }}>
          Every match played and the top two are level on points — no champion. Deal the chaos again to settle it.
        </p>
      )}
    </>
  );
}

export default {
  key: "chaos",
  label: "Chaos Cup",
  desc: "Every match has a random silly rule",
  icon: Dices,
  minPlayers: 2,
  stages: ["chaos"],
  config: {
    chaosLegs: { type: "choice", label: "Times each pair plays", options: [1, 2], default: DEFAULT_LEGS },
  },
  summary: ({ players, config }) => {
    const legCount = config.chaosLegs ?? DEFAULT_LEGS;
    const matchCount = (players.length * (players.length - 1) * legCount) / 2;
    return (
      <>
        <b style={{ color: C.ink }}>{matchCount} matches</b>, each one dealt a random silly rule the players have to obey.
        Normal scoring — top of the table wins.
      </>
    );
  },
  generateLabel: "DEAL THE CHAOS",
  subtitle: ({ config }) => {
    const legCount = config.chaosLegs ?? DEFAULT_LEGS;
    return `CHAOS CUP · ${legCount} LEG${legCount > 1 ? "S" : ""} · A RANDOM RULE EVERY MATCH`;
  },
  createFixtures: ({ players, config, rng = Math.random }) => {
    const base = generateGroupMatches(players, config.chaosLegs ?? DEFAULT_LEGS, rng);
    const twists = dealTwists(base.length, rng);
    return {
      matches: base.map((m, i) => ({ ...m, stage: "chaos", twist: twists[i] })),
      modeState: {},
      initialTab: "fixtures",
    };
  },
  champion,
  tabs: ({ matches }) => {
    const cm = chaosMatchesOf(matches);
    const playedCount = cm.filter((m) => m.played).length;
    return [{ key: "fixtures", label: cm.length ? `Chaos · ${playedCount}/${cm.length}` : "Chaos" }];
  },
  views: { fixtures: FixturesView },
};
