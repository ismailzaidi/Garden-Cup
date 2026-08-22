import { C } from "../lib/theme.js";

export default function ProgressBar({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.sub }}>Progress</span>
        <span className="text-[11px] font-bold" style={{ color: C.sub, fontFamily: "'JetBrains Mono', monospace" }}>{value}/{total}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: C.line }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: C.pitch }} />
      </div>
    </div>
  );
}
