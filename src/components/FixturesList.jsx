import { useState } from "react";
import { C } from "../lib/theme.js";
import EmptyCard from "./EmptyCard.jsx";
import MatchCard from "./MatchCard.jsx";
import ProgressBar from "./ProgressBar.jsx";

const FILTERS = [{ k: "all", l: "All" }, { k: "remaining", l: "Remaining" }, { k: "played", l: "Played" }];

// Shared by every mode with a group stage (league, roundrobin) — identical
// fixtures-by-leg list with an all/remaining/played filter.
export default function FixturesList({ matches, legCount, nameOf, timerControls, actions }) {
  const [filter, setFilter] = useState("all");
  const playedCount = matches.filter((m) => m.played).length;
  const visible = matches.filter((m) => {
    if (filter === "played") return m.played;
    if (filter === "remaining") return !m.played;
    return true;
  });
  const legs = Array.from({ length: legCount }, (_, i) => i + 1).filter((l) => visible.some((m) => m.leg === l));

  return (
    <>
      <ProgressBar value={playedCount} total={matches.length} />
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)} className="px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ backgroundColor: filter === f.k ? C.ink : "#EAE6D9", color: filter === f.k ? "#F7F5EE" : C.ink }}>
            {f.l}
          </button>
        ))}
      </div>
      {legs.length === 0 && <EmptyCard>No matches in this view.</EmptyCard>}
      {legs.map((leg) => (
        <div key={leg}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", color: C.pitch }}>LEG {leg}</span>
            <div className="flex-1 border-t border-dashed" style={{ borderColor: "#C9C2AC" }} />
          </div>
          <div className="space-y-2.5">
            {visible.filter((m) => m.leg === leg).map((m) => (
              <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={actions.addGoal} onUndoGoal={actions.undoGoal} onTogglePlayed={actions.togglePlayed} {...timerControls(m.id)} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
