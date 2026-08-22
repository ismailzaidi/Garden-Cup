import { Dices } from "lucide-react";
import { C } from "../lib/theme.js";
import { generateGroupMatches, shuffle } from "../engine/match.js";
import { computeStandings } from "../engine/standings.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import MatchCard from "../components/MatchCard.jsx";
import ProgressBar from "../components/ProgressBar.jsx";

const DEFAULT_LEGS = 1;

/* Twists are real-world rules for the players, never scoring rules for the
   app — a twist must never change how a goal counts, or the generic
   standings stop being valid for this mode. */
export const TWISTS = [
  { key: "weak-foot", emoji: "🦶", label: "Weak foot only", detail: "Every shot has to come off your wrong foot." },
  { key: "one-touch", emoji: "🕐", label: "One touch", detail: "One touch to shoot — no dribbling at all." },
  { key: "sitting-keeper", emoji: "🧎", label: "Sitting keeper", detail: "Keepers must stay sat on the ground." },
  { key: "silent", emoji: "🤫", label: "Silent match", detail: "Talk or celebrate out loud and the goal doesn't count." },
  { key: "slow-mo", emoji: "🐢", label: "Slow-mo celebrations", detail: "Every goal gets a slow-motion replay celebration." },
  { key: "swap-ends", emoji: "🔁", label: "Swap ends", detail: "Attack the other goal after every goal scored." },
  { key: "long-range", emoji: "🎯", label: "Long range only", detail: "Goals only count from outside the box or past the cone line." },
  { key: "hop-start", emoji: "🐸", label: "Hop start", detail: "Restart hopping on one leg until you touch the ball." },
  { key: "no-looking", emoji: "🙈", label: "No looking", detail: "The taker looks away as they shoot — the keeper picks when." },
  { key: "commentator", emoji: "👑", label: "Commentator match", detail: "Commentate your own play, in the third person." },
];

const chaosMatchesOf = (matches) => matches.filter((m) => m.stage === "chaos");

export const twistOf = (key) => TWISTS.find((t) => t.key === key) ?? null;

/* Deal without repeats until the deck runs dry, then reshuffle — so a
   tournament of ten or fewer matches never sees the same twist twice. */
export function dealTwists(count, rng = Math.random) {
  const dealt = [];
  let deck = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) deck = shuffle(TWISTS, rng);
    dealt.push(deck.shift().key);
  }
  return dealt;
}

function champion({ players, matches }) {
  const cm = chaosMatchesOf(matches);
  if (cm.length === 0) return null;
  if (cm.some((m) => !m.played)) return null;
  const standings = computeStandings(players, cm);
  if (standings.length === 0) return null;
  if (standings.length > 1 && standings[0].pts === standings[1].pts) return null;
  return standings[0];
}

function TwistBanner({ twist }) {
  if (!twist) return null;
  return (
    <div className="rounded-t-2xl px-4 py-2.5 flex items-center gap-3" style={{ backgroundColor: "#FDF3D9", border: `2px solid ${C.gold}`, borderBottom: "none" }}>
      <span className="text-2xl flex-shrink-0" aria-hidden="true">{twist.emoji}</span>
      <div className="min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: C.ink }}>{twist.label}</p>
        <p className="text-[11px]" style={{ color: C.sub }}>{twist.detail}</p>
      </div>
    </div>
  );
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
