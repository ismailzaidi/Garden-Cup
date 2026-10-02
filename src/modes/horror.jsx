import { useMemo } from "react";
import { Skull } from "lucide-react";
import { C } from "../lib/theme.js";
import { generateGroupMatches } from "../engine/match.js";
import { dealHorrors, horrorOf, computeHorrorStandings } from "../engine/horror.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import MatchCard from "../components/MatchCard.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import HorrorBanner from "../components/HorrorBanner.jsx";

const DEFAULT_LEGS = 1;

const horrorMatchesOf = (matches) => matches.filter((m) => m.stage === "horror");

/* Uses the horror table, not the shell's honest one: a sealed rule can turn
   the on-pitch winner into the loser. */
function champion({ players, matches }) {
  const hm = horrorMatchesOf(matches);
  if (hm.length === 0) return null;
  if (hm.some((m) => !m.played)) return null;
  const standings = computeHorrorStandings(players, hm);
  if (standings.length === 0) return null;
  if (standings.length > 1 && standings[0].pts === standings[1].pts) return null;
  return standings[0];
}

function FixturesView({ players, matches, config, nameOf, champion, timerControls, actions }) {
  const hm = useMemo(() => horrorMatchesOf(matches), [matches]);
  const playedCount = hm.filter((m) => m.played).length;
  const legCount = config.horrorLegs ?? DEFAULT_LEGS;
  const legs = Array.from({ length: legCount }, (_, i) => i + 1).filter((l) => hm.some((m) => m.leg === l));
  // The shell's `standings` prop is the honest on-pitch table; this one applies the fates.
  const standings = useMemo(() => computeHorrorStandings(players, hm), [players, hm]);

  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle="Survived the horror" />}
      <StandingsTable standings={standings} />
      <ProgressBar value={playedCount} total={hm.length} />
      {legs.map((leg) => (
        <div key={leg}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", color: "#8B1A1A" }}>LEG {leg}</span>
            <div className="flex-1 border-t border-dashed" style={{ borderColor: "#C9C2AC" }} />
          </div>
          <div className="space-y-3">
            {hm.filter((m) => m.leg === leg).map((m) => (
              <div key={m.id}>
                <HorrorBanner twist={horrorOf(m.twist)} played={m.played} />
                <MatchCard match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal}
                  onTogglePlayed={actions.togglePlayed} {...timerControls(m.id)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {hm.length > 0 && playedCount === hm.length && !champion && (
        <p className="text-xs text-center" style={{ color: C.mute }}>
          Every match played and the top two are level on points — the curse demands a rematch. Summon the horror again.
        </p>
      )}
    </>
  );
}

export default {
  key: "horror",
  label: "Horror",
  desc: "Sealed dark rules — winning might be the worst thing you do",
  icon: Skull,
  minPlayers: 2,
  stages: ["horror"],
  config: {
    horrorLegs: { type: "choice", label: "Times each pair plays", options: [1, 2, 3, 4], default: DEFAULT_LEGS },
  },
  summary: ({ players, config }) => {
    const legCount = config.horrorLegs ?? DEFAULT_LEGS;
    const matchCount = (players.length * (players.length - 1) * legCount) / 2;
    return (
      <>
        <b style={{ color: C.ink }}>{matchCount} matches</b>, each one dealt a spooky rule. <b style={{ color: C.ink }}>Open</b> rules
        are shown to everyone to act out. <b style={{ color: C.ink }}>Secret</b> rules are sealed — only the referee can peek — and
        they <b style={{ color: C.ink }}>rewrite the result at full time</b>:
        the winner might lose, nobody might score a point, or the loser might be drained dry.
      </>
    );
  },
  generateLabel: "SUMMON THE HORROR",
  subtitle: ({ config }) => {
    const legCount = config.horrorLegs ?? DEFAULT_LEGS;
    return `HORROR · ${legCount} LEG${legCount > 1 ? "S" : ""} · SEALED RULES`;
  },
  createFixtures: ({ players, config, rng = Math.random }) => {
    const base = generateGroupMatches(players, config.horrorLegs ?? DEFAULT_LEGS, rng);
    const twists = dealHorrors(base.length, rng);
    return {
      matches: base.map((m, i) => ({ ...m, stage: "horror", twist: twists[i] })),
      modeState: {},
      initialTab: "fixtures",
    };
  },
  champion,
  tabs: ({ matches }) => {
    const hm = horrorMatchesOf(matches);
    const playedCount = hm.filter((m) => m.played).length;
    return [{ key: "fixtures", label: hm.length ? `Horror · ${playedCount}/${hm.length}` : "Horror" }];
  },
  views: { fixtures: FixturesView },
};
