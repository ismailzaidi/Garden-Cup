import { Globe, ChevronRight } from "lucide-react";
import { C } from "../lib/theme.js";
import { makeId, randomOrder, matchWinner, generateGroupMatches, shuffle } from "../engine/match.js";
import { computeStandings } from "../engine/standings.js";
import ChampionBanner from "../components/ChampionBanner.jsx";
import MatchCard from "../components/MatchCard.jsx";
import SectionLabel from "../components/SectionLabel.jsx";
import StandingsTable from "../components/StandingsTable.jsx";

const DEFAULT_LEGS = 1;
const GROUP_KEYS = ["A", "B"];

const groupMatchesOf = (matches) => matches.filter((m) => m.stage === "wcgroup");
const koMatchesOf = (matches) => matches.filter((m) => m.stage === "wcko");
const finalOf = (matches) => koMatchesOf(matches).find((m) => m.round === 2 && !m.thirdPlace) ?? null;
const thirdPlaceOf = (matches) => koMatchesOf(matches).find((m) => m.round === 2 && m.thirdPlace) ?? null;

function makeKoMatch(round, x, y, rng, extra = {}) {
  const [p1, p2] = randomOrder(x, y, rng);
  return { id: makeId(), stage: "wcko", round, p1, p2, s1: "0", s2: "0", played: false, thirdPlace: false, ...extra };
}

/* One group's own table. The shell's generic `standings` prop covers every
   group match at once, which is the wrong shape here — each group needs
   its own, so the mode computes them locally. */
export function groupStandings(players, matches, modeState, key) {
  const gm = groupMatchesOf(matches).filter((m) => m.group === key);
  const declared = modeState?.groups?.[key];
  const ids = new Set(declared ?? gm.flatMap((m) => [m.p1, m.p2]).filter(Boolean));
  return computeStandings(players.filter((p) => ids.has(p.id)), gm);
}

const groupStageComplete = (matches) => {
  const gm = groupMatchesOf(matches);
  return gm.length > 0 && gm.every((m) => m.played);
};

function semiState(matches) {
  const semis = koMatchesOf(matches).filter((m) => m.round === 1);
  const winners = semis.map(matchWinner);
  return { semis, winners, decided: semis.length === 2 && winners.every(Boolean) };
}

function champion({ players, matches }) {
  const final = finalOf(matches);
  if (!final) return null;
  const winner = matchWinner(final);
  return winner ? players.find((p) => p.id === winner) ?? null : null;
}

export function advance({ players, matches, modeState, rng = Math.random }) {
  const ko = koMatchesOf(matches);

  /* group stage -> semi-finals: winners cross over, A1 v B2 and B1 v A2 */
  if (ko.length === 0) {
    if (!groupStageComplete(matches)) return { matches, modeState, tab: "groups" };
    const [a, b] = GROUP_KEYS.map((k) => groupStandings(players, matches, modeState, k));
    if (a.length < 2 || b.length < 2) return { matches, modeState, tab: "groups" };
    const semis = [
      makeKoMatch(1, a[0].id, b[1].id, rng),
      makeKoMatch(1, b[0].id, a[1].id, rng),
    ];
    return { matches: [...matches, ...semis], modeState, tab: "knockout" };
  }

  /* semi-finals -> the final, plus a third-place match for the losers */
  if (ko.some((m) => m.round === 2)) return { matches, modeState, tab: "knockout" };
  const { semis, winners, decided } = semiState(matches);
  if (!decided) return { matches, modeState, tab: "knockout" };
  const losers = semis.map((m) => (matchWinner(m) === m.p1 ? m.p2 : m.p1));
  return {
    matches: [
      ...matches,
      makeKoMatch(2, winners[0], winners[1], rng),
      makeKoMatch(2, losers[0], losers[1], rng, { thirdPlace: true }),
    ],
    modeState,
    tab: "knockout",
  };
}

function GroupsView({ players, matches, modeState, nameOf, timerControls, actions }) {
  const ready = groupStageComplete(matches) && koMatchesOf(matches).length === 0;

  return (
    <>
      {GROUP_KEYS.map((key) => {
        const gm = groupMatchesOf(matches).filter((m) => m.group === key);
        if (gm.length === 0) return null;
        return (
          <div key={key} className="space-y-2.5">
            <SectionLabel right={<span className="text-[11px] font-bold" style={{ color: C.mute }}>TOP 2 GO THROUGH</span>}>
              Group {key}
            </SectionLabel>
            <StandingsTable standings={groupStandings(players, matches, modeState, key)} highlightTopN={2} qualifyLabel="SEMI" />
            <div className="space-y-2.5">
              {gm.map((m) => (
                <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal}
                  onTogglePlayed={actions.togglePlayed} {...timerControls(m.id)} />
              ))}
            </div>
          </div>
        );
      })}

      {ready && (
        <div>
          <button onClick={actions.advance}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
            <ChevronRight size={16} /> KICK OFF THE SEMI-FINALS
          </button>
          <p className="text-[10px] text-center mt-1.5" style={{ color: C.mute }}>
            Winners cross over: A1 plays B2, B1 plays A2.
          </p>
        </div>
      )}
    </>
  );
}

function KnockoutSection({ title, matches, nameOf, timerControls, actions }) {
  if (matches.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", color: C.pitch }}>{title}</span>
        <div className="flex-1 border-t border-dashed" style={{ borderColor: "#C9C2AC" }} />
      </div>
      <div className="space-y-2.5">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal}
            onTogglePlayed={actions.togglePlayed} needsWinner {...timerControls(m.id)} />
        ))}
      </div>
    </div>
  );
}

function FinalsView({ matches, nameOf, champion, timerControls, actions }) {
  const { semis, decided } = semiState(matches);
  const final = finalOf(matches);
  const third = thirdPlaceOf(matches);
  const canAdvance = decided && !final;
  const bronze = third && matchWinner(third);

  return (
    <>
      {champion && <ChampionBanner name={champion.name} subtitle="Garden World Cup winner" />}

      <KnockoutSection title="SEMI-FINALS" matches={semis} nameOf={nameOf} timerControls={timerControls} actions={actions} />

      {canAdvance && (
        <div>
          <button onClick={actions.advance}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
            <ChevronRight size={16} /> SET UP THE FINAL
          </button>
          <p className="text-[10px] text-center mt-1.5" style={{ color: C.mute }}>
            The beaten semi-finalists play off for third.
          </p>
        </div>
      )}

      <KnockoutSection title="THIRD PLACE" matches={third ? [third] : []} nameOf={nameOf} timerControls={timerControls} actions={actions} />
      {bronze && (
        <p className="text-xs text-center" style={{ color: C.sub }}>
          🥉 <b style={{ color: C.ink }}>{nameOf(bronze)}</b> takes the bronze.
        </p>
      )}

      <KnockoutSection title="THE FINAL" matches={final ? [final] : []} nameOf={nameOf} timerControls={timerControls} actions={actions} />

      {semis.length > 0 && !decided && (
        <p className="text-xs text-center" style={{ color: C.mute }}>
          Both semi-finals need a winner — no draws from here on in.
        </p>
      )}
    </>
  );
}

export default {
  key: "worldcup",
  label: "Garden World Cup",
  desc: "Group stage, semi-finals, then the final",
  icon: Globe,
  minPlayers: 4,
  stages: ["wcgroup", "wcko"],
  config: {
    groupLegs: { type: "choice", label: "Group games between each pair", options: [1, 2], default: DEFAULT_LEGS },
  },
  summary: ({ players, config }) => {
    const legs = config.groupLegs ?? DEFAULT_LEGS;
    const a = Math.ceil(players.length / 2);
    const b = players.length - a;
    const count = ((a * (a - 1)) / 2 + (b * (b - 1)) / 2) * legs;
    return (
      <>
        <b style={{ color: C.ink }}>{players.length} players</b> split into two groups ({a} and {b}) for{" "}
        <b style={{ color: C.ink }}>{count} group matches</b>. Top two of each go through to the semis, then the final —
        and the losers play off for third.
      </>
    );
  },
  generateLabel: "KICK OFF THE GROUP STAGE",
  subtitle: ({ config }) => {
    const legs = config.groupLegs ?? DEFAULT_LEGS;
    return `GARDEN WORLD CUP · TWO GROUPS · ${legs} GAME${legs > 1 ? "S" : ""} EACH · SEMIS & FINAL`;
  },
  createFixtures: ({ players, config, rng = Math.random }) => {
    const legs = config.groupLegs ?? DEFAULT_LEGS;
    const order = shuffle(players, rng);
    const groups = { A: order.filter((_, i) => i % 2 === 0), B: order.filter((_, i) => i % 2 === 1) };
    const matches = GROUP_KEYS.flatMap((key) =>
      generateGroupMatches(groups[key], legs, rng).map((m) => ({ ...m, stage: "wcgroup", group: key }))
    );
    return {
      matches,
      modeState: { groups: { A: groups.A.map((p) => p.id), B: groups.B.map((p) => p.id) } },
      initialTab: "groups",
    };
  },
  champion,
  tabs: ({ matches }) => {
    const gm = groupMatchesOf(matches);
    const played = gm.filter((m) => m.played).length;
    const tabs = [{ key: "groups", label: gm.length ? `Groups · ${played}/${gm.length}` : "Groups" }];
    if (koMatchesOf(matches).length > 0) tabs.push({ key: "knockout", label: "Finals" });
    return tabs;
  },
  advance,
  views: { groups: GroupsView, knockout: FinalsView },
};
