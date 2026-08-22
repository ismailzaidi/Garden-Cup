import { Trophy, Trash2, X } from "lucide-react";
import { C } from "../lib/theme.js";
import { formatDate } from "../engine/format.js";
import { MODES } from "../modes/index.js";
import EmptyCard from "../components/EmptyCard.jsx";

export default function HistoryView({ history, actions }) {
  if (history.length === 0) {
    return <EmptyCard>No completed tournaments yet — finish one and it'll be saved here automatically.</EmptyCard>;
  }

  return (
    <>
      <div className="flex justify-end">
        <button onClick={actions.clearHistory} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#FBE3DE", color: C.loss }}>
          <Trash2 size={12} /> Clear all
        </button>
      </div>
      <div className="space-y-2.5">
        {history.map((h) => {
          const meta = MODES.find((m) => m.key === h.mode);
          return (
            <div key={h.id} className="rounded-2xl p-4" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase" style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
                      {meta ? meta.label : h.mode}
                    </span>
                    <span className="text-[10px]" style={{ color: C.mute }}>{formatDate(h.date)}</span>
                  </div>
                  <p className="flex items-center gap-1.5" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.35rem", color: C.ink, lineHeight: 1.1 }}>
                    <Trophy size={15} color={C.gold} fill={C.gold} className="flex-shrink-0" />
                    <span className="truncate">{h.champion}</span>
                  </p>
                  <p className="text-xs mt-1.5 truncate" style={{ color: C.sub }}>{h.players.join(", ")}</p>
                  {h.topScorer && (
                    <p className="text-xs mt-1 truncate" style={{ color: C.sub }}>
                      Top scorer: <b style={{ color: C.ink }}>{h.topScorer.name}</b> ({h.topScorer.goals}) · {h.totalGoals} goals total
                    </p>
                  )}
                </div>
                <button onClick={() => actions.deleteHistoryEntry(h.id)} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EAE6D9" }}>
                  <X size={13} strokeWidth={3} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
