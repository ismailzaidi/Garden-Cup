import { C } from "../lib/theme.js";
import { tierName } from "../engine/tiers.js";

// Sits directly on top of a MatchCard, so it rounds only its own top corners
// and drops its bottom border to read as one card with the match below it.
export default function TwistBanner({ twist, tier, tip }) {
  if (!twist) return null;
  return (
    <div className="rounded-t-2xl px-4 py-2.5 flex items-center gap-3" style={{ backgroundColor: "#FDF3D9", border: `2px solid ${C.gold}`, borderBottom: "none" }}>
      <span className="text-2xl flex-shrink-0" aria-hidden="true">{twist.emoji}</span>
      <div className="min-w-0">
        {tier && <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.pitch }}>{tierName(tier)}</p>}
        <p className="font-bold text-sm truncate" style={{ color: C.ink }}>{twist.label}</p>
        <p className="text-[11px]" style={{ color: C.sub }}>{twist.detail}</p>
        {tip && <p className="text-[11px] mt-1 italic" style={{ color: C.sub }}>How: {tip}</p>}
      </div>
    </div>
  );
}
