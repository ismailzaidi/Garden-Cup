import { Flame, ChevronRight } from "lucide-react";
import { C } from "../lib/theme.js";
import { generateGroupMatches } from "../engine/match.js";
import { computeStandings } from "../engine/standings.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import MatchCard from "../components/MatchCard.jsx";
import SectionLabel from "../components/SectionLabel.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import EmptyCard from "../components/EmptyCard.jsx";

const survivorMatchesOf = (matches) => matches.filter((m) => m.stage === "survivor");

const currentRoundOf = (survivorMatches) => survivorMatches.reduce((a, m) => Math.max(a, m.round || 1), 1);

/* Who is still in, read off the round's own fixtures rather than modeState —
   the two always agree, and this keeps the round table right even for a
   state restored from an older save. */
function roundPlayers(players, roundMatches) {
  const ids = new Set(roundMatches.flatMap((m) => [m.p1, m.p2]).filter(Boolean));
  return players.filter((p) => ids.has(p.id));
}

/* The live table for one round only — the bottom row is the player about to
   go out. Order is computeStandings' own (points, goal difference, goals
   scored, name); there is deliberately no survivor-specific tiebreaker. */
export function roundTable(players, matches, round) {
  const roundMatches = survivorMatchesOf(matches).filter((m) => (m.round || 1) === round);
  return computeStandings(roundPlayers(players, roundMatches), roundMatches);
}

function champion({ players, modeState }) {
  const alive = modeState.alive || [];
  return alive.length === 1 ? players.find((p) => p.id === alive[0]) ?? null : null;
}

export function advance({ players, matches, modeState, rng = Math.random }) {
  const unchanged = { matches, modeState, tab: "rounds" };
  const sm = survivorMatchesOf(matches);
  if (sm.length === 0) return unchanged;

  const round = currentRoundOf(sm);
  const roundMatches = sm.filter((m) => (m.round || 1) === round);
  if (roundMatches.some((m) => !m.played)) return unchanged;

  const contenders = roundPlayers(players, roundMatches);
  if (contenders.length < 2) return unchanged;

  const table = computeStandings(contenders, roundMatches);
  const out = table[table.length - 1];
  const alive = contenders.filter((p) => p.id !== out.id);
  const nextModeState = {
    alive: alive.map((p) => p.id),
    eliminated: [...(modeState.eliminated || []), { id: out.id, round }],
  };

  // One left is the champion — no more fixtures to generate.
  if (alive.length < 2) return { matches, modeState: nextModeState, tab: "rounds" };

  const next = generateGroupMatches(alive, 1, rng).map((m) => ({ ...m, stage: "survivor", round: round + 1 }));
  return { matches: [...matches, ...next], modeState: nextModeState, tab: "rounds" };
}

function DropZone({ name, live }) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.loss}` }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FBE9E7" }}>
        <Flame size={18} color={C.loss} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.loss }}>In the drop zone</p>
        <p className="font-bold truncate" style={{ color: C.ink }}>{name}</p>
        <p className="text-[10px]" style={{ color: C.mute }}>
          {live ? "Bottom of the round table — win a match to climb out." : "Last place — knocked out when you confirm."}
        </p>
      </div>
    </div>
  );
}

function ArenaView({ players, matches, modeState, nameOf, champion, timerControls, actions }) {
  const sm = survivorMatchesOf(matches);
  const round = currentRoundOf(sm);
  const roundMatches = sm.filter((m) => (m.round || 1) === round);
  const table = roundTable(players, matches, round);
  const roundDone = roundMatches.length > 0 && roundMatches.every((m) => m.played);
  const eliminated = [...(modeState.eliminated || [])].reverse();
  const aliveCount = (modeState.alive || []).length;
  const bottom = table.length ? table[table.length - 1] : null;

  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle="Last one standing" />}

      {!champion && bottom && <DropZone name={bottom.name} live={!roundDone} />}

      {!champion && roundMatches.length > 0 && (
        <div>
          <SectionLabel right={<span className="text-[11px] font-bold" style={{ color: C.mute }}>{aliveCount} LEFT</span>}>
            Round {round}
          </SectionLabel>
          <div className="space-y-2.5">
            {roundMatches.map((m) => (
              <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal}
                onTogglePlayed={actions.togglePlayed} {...timerControls(m.id)} />
            ))}
          </div>
          {roundDone && (
            <>
              <button onClick={actions.advance}
                className="w-full mt-2.5 py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
                <ChevronRight size={16} /> KNOCK OUT THE LAST PLACE
              </button>
              <p className="text-[10px] text-center mt-1.5" style={{ color: C.mute }}>
                Level on points? Goal difference splits it, then goals scored.
              </p>
            </>
          )}
        </div>
      )}

      {table.length > 0 && (
        <div>
          <SectionLabel>Round {round} table</SectionLabel>
          <StandingsTable standings={table} />
        </div>
      )}

      {eliminated.length > 0 && (
        <div>
          <SectionLabel>Out of the garden</SectionLabel>
          <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
            {eliminated.map((e, i) => (
              <div key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5"
                style={{ backgroundColor: "#fff", borderBottom: i < eliminated.length - 1 ? `1px solid #F0EDE2` : "none" }}>
                <span className="font-semibold truncate" style={{ color: C.mute, textDecoration: "line-through" }}>{nameOf(e.id)}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide flex-shrink-0" style={{ color: C.loss }}>Round {e.round}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function TableView({ matches, champion, standings }) {
  const sm = survivorMatchesOf(matches);
  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle="Last one standing" />}
      {sm.length === 0 ? <EmptyCard>No matches yet.</EmptyCard> : <StandingsTable standings={standings} />}
      <p className="text-xs text-center" style={{ color: C.mute }}>Every round played so far, added together.</p>
    </>
  );
}

export default {
  key: "survivor",
  label: "Last One Standing",
  desc: "Lowest scorer is knocked out every round",
  icon: Flame,
  minPlayers: 3,
  stages: ["survivor"],
  config: {},
  summary: ({ players }) => (
    <>
      <b style={{ color: C.ink }}>{players.length} players</b> all play each other. Bottom of the table is knocked out,
      then the survivors go again — until one is left standing.
    </>
  ),
  generateLabel: "START ROUND 1",
  subtitle: () => "LAST ONE STANDING · BOTTOM OF THE TABLE GOES OUT",
  createFixtures: ({ players, rng = Math.random }) => ({
    matches: generateGroupMatches(players, 1, rng).map((m) => ({ ...m, stage: "survivor", round: 1 })),
    modeState: { alive: players.map((p) => p.id), eliminated: [] },
    initialTab: "rounds",
  }),
  champion,
  tabs: ({ matches }) => {
    const sm = survivorMatchesOf(matches);
    return [
      { key: "rounds", label: sm.length ? `Arena · R${currentRoundOf(sm)}` : "Arena" },
      { key: "table", label: "Table" },
    ];
  },
  advance,
  views: { rounds: ArenaView, table: TableView },
};
