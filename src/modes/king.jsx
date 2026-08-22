import { Crown, ChevronRight } from "lucide-react";
import { C } from "../lib/theme.js";
import { makeId, shuffle, matchWinner } from "../engine/match.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import MatchCard from "../components/MatchCard.jsx";
import SectionLabel from "../components/SectionLabel.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import EmptyCard from "../components/EmptyCard.jsx";

const DEFAULT_TARGET = 3;

function makeKingMatch(seq, kingId, challengerId) {
  return { id: makeId(), stage: "king", seq, p1: kingId, p2: challengerId, s1: "0", s2: "0", played: false };
}

function kingMatchesOf(matches) {
  return matches.filter((m) => m.stage === "king");
}

export function computeKingStreaks(kingMatches) {
  const best = {};
  let currentId = null;
  let run = 0;
  kingMatches.filter((m) => m.played).sort((a, b) => a.seq - b.seq).forEach((m) => {
    const w = matchWinner(m) || m.p1; // draw = king defends
    if (w === currentId) run += 1; else { currentId = w; run = 1; }
    best[w] = Math.max(best[w] || 0, run);
  });
  return { best, currentId, run };
}

function champion({ players, matches, config }) {
  const target = config.kingTarget ?? DEFAULT_TARGET;
  const streaks = computeKingStreaks(kingMatchesOf(matches));
  const championId = streaks.run >= target ? streaks.currentId : null;
  return championId ? players.find((p) => p.id === championId) ?? null : null;
}

export function advance({ matches, modeState, config }) {
  const kingMatches = kingMatchesOf(matches);
  const last = kingMatches.length ? kingMatches.reduce((a, b) => (b.seq > a.seq ? b : a)) : null;
  if (!last) return { matches, modeState, tab: "arena" };

  const target = config.kingTarget ?? DEFAULT_TARGET;
  const s1 = Number(last.s1 || 0);
  const s2 = Number(last.s2 || 0);
  const winner = s1 >= s2 ? last.p1 : last.p2; // draw = king defends
  const loser = winner === last.p1 ? last.p2 : last.p1;

  const queue = [...(modeState.queue || []), loser];
  const challenger = queue.shift();

  const marked = matches.map((x) => (x.id === last.id ? { ...x, played: true } : x));
  const streakAfter = computeKingStreaks(kingMatchesOf(marked));
  if (streakAfter.run >= target) return { matches: marked, modeState: { queue }, tab: "arena" };
  if (!challenger) return { matches: marked, modeState: { queue }, tab: "arena" };
  return { matches: [...marked, makeKingMatch(last.seq + 1, winner, challenger)], modeState: { queue }, tab: "arena" };
}

function ArenaView({ players, matches, modeState, config, nameOf, champion, timerControls, actions }) {
  const target = config.kingTarget ?? DEFAULT_TARGET;
  const kingMatches = kingMatchesOf(matches);
  const streaks = computeKingStreaks(kingMatches);
  const queue = modeState.queue || [];
  const last = kingMatches.length ? kingMatches.reduce((a, b) => (b.seq > a.seq ? b : a)) : null;
  const currentMatch = last && !last.played ? last : null;
  // Recovery: newest match got marked played without confirming, so no next fixture exists.
  const needsNext = !!last && last.played && !champion && players.length >= 2;
  const played = kingMatches.filter((m) => m.played);

  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle={`${target} straight wins — crown taken`} />}

      {streaks.currentId && !champion && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FDF3D9" }}>
            <Crown size={18} color={C.gold} fill={C.gold} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.mute }}>Current king</p>
            <p className="font-bold truncate" style={{ color: C.ink }}>{nameOf(streaks.currentId)}</p>
            <div className="flex gap-1 mt-1.5">
              {Array.from({ length: target }, (_, i) => (
                <span key={i} className="h-1.5 w-6 rounded-full" style={{ backgroundColor: i < streaks.run ? C.gold : C.line }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {currentMatch && !champion && (
        <div>
          <SectionLabel>Match {currentMatch.seq}</SectionLabel>
          <MatchCard match={currentMatch} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal} onTogglePlayed={actions.togglePlayed}
            homeTag="KING" awayTag="CHALLENGER" hideToggle {...timerControls(currentMatch.id)} />
          <button onClick={actions.advance}
            className="w-full mt-2.5 py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
            <ChevronRight size={16} /> CONFIRM RESULT & NEXT UP
          </button>
          <p className="text-[10px] text-center mt-1.5" style={{ color: C.mute }}>A draw means the king keeps the pitch.</p>
        </div>
      )}

      {needsNext && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "#fff", border: `2px solid ${C.gold}` }}>
          <p className="text-sm mb-3" style={{ color: C.sub }}>
            Last match was closed without setting up the next one. Tap below to bring on the next challenger.
          </p>
          <button onClick={actions.advance}
            className="w-full py-3 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
            <ChevronRight size={16} /> NEXT MATCH
          </button>
        </div>
      )}

      {queue.length > 0 && !champion && (
        <div>
          <SectionLabel>Queue</SectionLabel>
          <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
            {queue.map((id, i) => (
              <div key={id} className="flex items-center gap-2.5 px-4 py-2.5" style={{ backgroundColor: "#fff", borderBottom: i < queue.length - 1 ? `1px solid #F0EDE2` : "none" }}>
                <span className="text-xs font-bold w-4 flex-shrink-0" style={{ color: C.mute }}>{i + 1}</span>
                <span className="font-semibold truncate" style={{ color: C.ink }}>{nameOf(id)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {played.length > 0 && (
        <div>
          <SectionLabel>Results</SectionLabel>
          <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
            {played.slice().sort((a, b) => b.seq - a.seq).map((m, i, arr) => (
              <div key={m.id} className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: "#fff", borderBottom: i < arr.length - 1 ? `1px solid #F0EDE2` : "none" }}>
                <span className="text-[10px] font-bold w-5 flex-shrink-0" style={{ color: C.mute }}>#{m.seq}</span>
                <span className="flex-1 min-w-0 text-right text-sm font-semibold truncate" style={{ color: C.ink }}>{nameOf(m.p1)}</span>
                <span className="px-2 py-0.5 rounded font-bold text-sm flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", backgroundColor: "#EAE6D9", color: C.ink }}>
                  {m.s1}–{m.s2}
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: C.ink }}>{nameOf(m.p2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function KingTableView({ matches, nameOf, standings }) {
  const streaks = computeKingStreaks(kingMatchesOf(matches));
  const entries = Object.entries(streaks.best).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <StandingsTable standings={standings} />
      <div>
        <SectionLabel>Best win streaks</SectionLabel>
        {entries.length === 0 ? (
          <EmptyCard>No matches confirmed yet.</EmptyCard>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
            {entries.map(([id, run], i, arr) => (
              <div key={id} className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ backgroundColor: "#fff", borderBottom: i < arr.length - 1 ? `1px solid #F0EDE2` : "none" }}>
                <span className="font-semibold truncate" style={{ color: C.ink }}>{nameOf(id)}</span>
                <span className="flex items-center gap-1 flex-shrink-0 font-bold" style={{ color: C.pitch, fontFamily: "'JetBrains Mono', monospace" }}>
                  <Crown size={13} color={C.gold} fill={C.gold} /> {run}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default {
  key: "king",
  label: "Winner Stays On",
  desc: "Beat the king, queue to challenge",
  icon: Crown,
  minPlayers: 2,
  stages: ["king"],
  config: {
    kingTarget: {
      type: "choice",
      label: "Wins in a row to take the crown",
      options: [2, 3, 4, 5],
      default: DEFAULT_TARGET,
    },
  },
  summary: ({ players, config }) => (
    <>
      <b style={{ color: C.ink }}>{players.length} players</b> queue up. Winner stays on; first to{" "}
      <b style={{ color: C.ink }}>{config.kingTarget ?? DEFAULT_TARGET} in a row</b> takes the crown. A draw means the king defends.
    </>
  ),
  generateLabel: "START THE ARENA",
  subtitle: ({ config }) => `WINNER STAYS ON · FIRST TO ${config.kingTarget ?? DEFAULT_TARGET} IN A ROW`,
  createFixtures: ({ players, rng = Math.random }) => {
    const order = shuffle(players, rng);
    return {
      matches: [makeKingMatch(1, order[0].id, order[1].id)],
      modeState: { queue: order.slice(2).map((p) => p.id) },
      initialTab: "arena",
    };
  },
  champion,
  tabs: () => [{ key: "arena", label: "Arena" }, { key: "kingtable", label: "Table" }],
  advance,
  views: { arena: ArenaView, kingtable: KingTableView },
};
