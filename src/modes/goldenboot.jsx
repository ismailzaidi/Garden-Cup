import { Target, Crown, ChevronRight } from "lucide-react";
import { C } from "../lib/theme.js";
import { generateGroupMatches } from "../engine/match.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import MatchCard from "../components/MatchCard.jsx";
import SectionLabel from "../components/SectionLabel.jsx";
import ProgressBar from "../components/ProgressBar.jsx";

const DEFAULT_TARGET = 10;

const bootMatchesOf = (matches) => matches.filter((m) => m.stage === "goldenboot");

/* Goals scored, from match scores rather than the goal log — champion rules
   never receive the log, and the scores are the source of truth anyway. */
export function computeGoalTotals(players, matches) {
  const totals = {};
  players.forEach((p) => { totals[p.id] = { id: p.id, name: p.name, goals: 0 }; });
  matches.forEach((m) => {
    if (!m.played || m.bye) return;
    const a = totals[m.p1];
    const b = totals[m.p2];
    if (!a || !b) return;
    a.goals += Number(m.s1 || 0);
    b.goals += Number(m.s2 || 0);
  });
  return Object.values(totals).sort((x, y) => y.goals - x.goals || x.name.localeCompare(y.name));
}

/* The leaders and whether the race is settled — shared by the champion rule,
   the advance transition, and the view, so all three agree. */
function raceState(players, matches, target) {
  const totals = computeGoalTotals(players, bootMatchesOf(matches));
  const max = totals.length ? totals[0].goals : 0;
  const leaders = totals.filter((t) => t.goals === max);
  return { totals, max, leaders, settled: max >= target && leaders.length === 1 };
}

function champion({ players, matches, config }) {
  if (bootMatchesOf(matches).length === 0) return null;
  const { leaders, settled } = raceState(players, matches, config.bootTarget ?? DEFAULT_TARGET);
  return settled ? players.find((p) => p.id === leaders[0].id) ?? null : null;
}

export function advance({ players, matches, config, modeState, rng = Math.random }) {
  const unchanged = { matches, modeState, tab: "race" };
  const gm = bootMatchesOf(matches);
  if (gm.length === 0 || gm.some((m) => !m.played)) return unchanged;

  const target = config.bootTarget ?? DEFAULT_TARGET;
  const { max, leaders } = raceState(players, matches, target);
  if (max >= target && leaders.length === 1) return unchanged; // already won

  // Level at the top with the target reached? Only the tied players replay.
  // Nobody there yet? Everyone goes again.
  const field = max >= target
    ? players.filter((p) => leaders.some((l) => l.id === p.id))
    : players;
  if (field.length < 2) return unchanged;

  const nextLeg = gm.reduce((a, m) => Math.max(a, m.leg || 0), 0) + 1;
  const extra = generateGroupMatches(field, 1, rng).map((m) => ({ ...m, stage: "goldenboot", leg: nextLeg }));
  return { matches: [...matches, ...extra], modeState, tab: "race" };
}

function RaceBoard({ totals, max, target }) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
      {totals.map((t) => {
        const leading = max > 0 && t.goals === max;
        const pct = target > 0 ? Math.min(100, Math.round((t.goals / target) * 100)) : 0;
        return (
          <div key={t.id}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="flex items-center gap-1.5 min-w-0">
                {leading && <Crown size={14} color={C.gold} fill={C.gold} className="flex-shrink-0" />}
                <span className="font-semibold truncate" style={{ color: C.ink }}>{t.name}</span>
              </span>
              <span className="flex-shrink-0 font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: leading ? C.pitch : C.sub }}>
                {t.goals}<span className="text-[11px]" style={{ color: C.mute }}>/{target}</span>
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: C.line }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: leading ? C.gold : C.pitch }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RaceView({ players, matches, config, nameOf, champion, timerControls, actions }) {
  const target = config.bootTarget ?? DEFAULT_TARGET;
  const gm = bootMatchesOf(matches);
  const playedCount = gm.filter((m) => m.played).length;
  const { totals, max } = raceState(players, matches, target);
  const allPlayed = gm.length > 0 && playedCount === gm.length;
  const canAdvance = allPlayed && !champion;
  const legs = [...new Set(gm.map((m) => m.leg || 1))].sort((a, b) => a - b);

  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle={`Golden Boot winner — first to ${target}`} />}

      <SectionLabel right={<span className="text-[11px] font-bold" style={{ color: C.mute }}>RACE TO {target}</span>}>
        The race
      </SectionLabel>
      <RaceBoard totals={totals} max={max} target={target} />

      {canAdvance && (
        <div>
          <button onClick={actions.advance}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
            <ChevronRight size={16} /> EXTRA ROUND — RACE ISN'T OVER
          </button>
          <p className="text-[10px] text-center mt-1.5" style={{ color: C.mute }}>
            {max >= target ? "Level at the top — only the tied players go again." : `Nobody has hit ${target} yet — everyone plays another round.`}
          </p>
        </div>
      )}

      <ProgressBar value={playedCount} total={gm.length} />

      {legs.map((leg) => (
        <div key={leg}>
          <SectionLabel>Round {leg}</SectionLabel>
          <div className="space-y-2.5">
            {gm.filter((m) => (m.leg || 1) === leg).map((m) => (
              <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal}
                onTogglePlayed={actions.togglePlayed} {...timerControls(m.id)} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default {
  key: "goldenboot",
  label: "Golden Boot Race",
  desc: "First to score N goals in total wins",
  icon: Target,
  minPlayers: 2,
  stages: ["goldenboot"],
  config: {
    bootTarget: { type: "choice", label: "Goals to win the Golden Boot", options: [5, 10, 15], default: DEFAULT_TARGET },
  },
  summary: ({ players, config }) => (
    <>
      <b style={{ color: C.ink }}>{players.length} players</b> chase{" "}
      <b style={{ color: C.ink }}>{config.bootTarget ?? DEFAULT_TARGET} goals</b>. Winning and losing don't matter — only
      the goals you score, added up across every match.
    </>
  ),
  generateLabel: "START THE RACE",
  subtitle: ({ config }) => `GOLDEN BOOT RACE · FIRST TO ${config.bootTarget ?? DEFAULT_TARGET} GOALS`,
  createFixtures: ({ players, rng = Math.random }) => ({
    matches: generateGroupMatches(players, 1, rng).map((m) => ({ ...m, stage: "goldenboot" })),
    modeState: {},
    initialTab: "race",
  }),
  champion,
  tabs: ({ matches }) => {
    const gm = bootMatchesOf(matches);
    const playedCount = gm.filter((m) => m.played).length;
    return [{ key: "race", label: gm.length ? `Race · ${playedCount}/${gm.length}` : "Race" }];
  },
  advance,
  views: { race: RaceView },
};
