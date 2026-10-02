import { useState } from "react";
import { FATE_VERDICT } from "../engine/horror.js";

const INK = "#F3E9E9";
const BLOOD = "#8B1A1A";

// Sits on top of a MatchCard like TwistBanner. The rule stays sealed until
// the match is played; before that the referee can only see it while holding
// the peek button down, so it can't be read over their shoulder.
export default function HorrorBanner({ twist, played }) {
  const [peeking, setPeeking] = useState(false);
  if (!twist) return null;
  const secret = twist.fate !== "normal";
  const shown = played || peeking;
  const stop = () => setPeeking(false);

  return (
    <div className="rounded-t-2xl px-4 py-2.5 flex items-center gap-3 select-none"
      style={{ backgroundColor: "#1A1214", border: `2px solid ${BLOOD}`, borderBottom: "none", color: INK }}>
      <span className="text-2xl flex-shrink-0" aria-hidden="true">{shown ? twist.emoji : "🕯️"}</span>
      <div className="min-w-0 flex-1">
        {shown ? (
          <>
            <p className="font-bold text-sm truncate">{twist.label}</p>
            <p className="text-[11px]" style={{ color: "#C9B8B8" }}>{twist.detail}</p>
            {played && secret && <p className="text-[11px] font-bold mt-1" style={{ color: "#FF6B6B" }}>{FATE_VERDICT[twist.fate]}</p>}
            {!played && (
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "#FF6B6B" }}>
                {secret ? "🤫 Keep this secret until full time" : "📣 Read this out at kick-off"}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-bold text-sm">Sealed rule</p>
            <p className="text-[11px]" style={{ color: "#C9B8B8" }}>Referee only. Revealed at full time.</p>
          </>
        )}
      </div>
      {!played && (
        <button type="button" onPointerDown={() => setPeeking(true)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
          onContextMenu={(e) => e.preventDefault()}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{ backgroundColor: BLOOD, color: INK, touchAction: "none" }}>
          HOLD TO PEEK
        </button>
      )}
    </div>
  );
}
