import { useState } from "react";
import { FATE_VERDICT, isSecret } from "../engine/horror.js";
import { tierName } from "../engine/tiers.js";

const INK = "#F3E9E9";
const SUB = "#C9B8B8";
const RED = "#8B1A1A";
const ALERT = "#FF6B6B";

// Sits on top of a MatchCard like TwistBanner. An OPEN rule is shown to
// everyone from the start — the players have to act it out. A SECRET rule
// stays sealed until the match is played; before that the referee can only
// see it while holding the peek button down, so it can't be read over their
// shoulder.
export default function HorrorBanner({ twist, played, tier, tip }) {
  const [peeking, setPeeking] = useState(false);
  if (!twist) return null;
  const secret = isSecret(twist);
  const shown = !secret || played || peeking;
  const stop = () => setPeeking(false);

  return (
    <div className="rounded-t-2xl px-4 py-2.5 flex items-center gap-3 select-none"
      style={{ backgroundColor: "#1A1214", border: `2px solid ${RED}`, borderBottom: "none", color: INK }}>
      <span className="text-2xl flex-shrink-0" aria-hidden="true">{shown ? twist.emoji : "🕯️"}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: ALERT }}>
          {tier ? `${tierName(tier)} · ` : ""}{secret ? "🤫 Secret rule · referee only" : "📣 Open rule · everyone knows"}
        </p>
        {shown ? (
          <>
            <p className="font-bold text-sm truncate">{twist.label}</p>
            <p className="text-[11px]" style={{ color: SUB }}>{twist.detail}</p>
            {tip && <p className="text-[11px] mt-1 italic" style={{ color: SUB }}>How: {tip}</p>}
            {secret && played && <p className="text-[11px] font-bold mt-1" style={{ color: ALERT }}>{FATE_VERDICT[twist.fate]}</p>}
          </>
        ) : (
          <>
            <p className="font-bold text-sm">Sealed</p>
            <p className="text-[11px]" style={{ color: SUB }}>Revealed at full time. It might change the result…</p>
          </>
        )}
      </div>
      {secret && !played && (
        <button type="button" onPointerDown={() => setPeeking(true)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
          onContextMenu={(e) => e.preventDefault()}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{ backgroundColor: RED, color: INK, touchAction: "none" }}>
          HOLD TO PEEK
        </button>
      )}
    </div>
  );
}
