import { C } from "../lib/theme.js";

// Sits directly on top of a MatchCard, so it rounds only its own top corners
// and drops its bottom border to read as one card with the match below it.
export default function TwistBanner({ twist }) {
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
