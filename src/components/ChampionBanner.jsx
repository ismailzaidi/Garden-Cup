import { Trophy } from "lucide-react";
import { C } from "../lib/theme.js";

export default function ChampionBanner({ name, subtitle }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${C.gold} 0%, #E8A62B 100%)`, border: `2px solid ${C.ink}` }}>
      <Trophy size={34} color={C.ink} fill={C.ink} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.ink }}>Champion</p>
        <p className="truncate" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.9rem", color: C.ink, lineHeight: 1.05 }}>{name}</p>
        {subtitle && <p className="text-[11px] font-semibold mt-0.5" style={{ color: "#4A3C10" }}>{subtitle}</p>}
      </div>
    </div>
  );
}
