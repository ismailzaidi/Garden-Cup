import { Trophy } from "lucide-react";
import { C } from "../lib/theme.js";

export default function StandingsTable({ standings, highlightTopN = 0, qualifyLabel = "FINAL" }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
      <div className="overflow-x-auto">
        <table className="text-sm" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%" }}>
          <thead>
            <tr style={{ backgroundColor: C.ink, color: "#F7F5EE" }}>
              <th className="py-2.5 pl-3 pr-1 text-left font-bold text-xs sticky left-0 z-10" style={{ backgroundColor: C.ink }}>#</th>
              <th className="py-2.5 px-2 text-left font-bold text-xs sticky z-10" style={{ backgroundColor: C.ink, left: "34px", minWidth: "110px" }}>Player</th>
              {["P", "W", "D", "L", "GF", "GA", "G/D"].map((h) => (
                <th key={h} className="py-2.5 px-2 text-center font-bold text-xs whitespace-nowrap">{h}</th>
              ))}
              <th className="py-2.5 pl-2 pr-3 text-center font-bold text-xs">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const q = highlightTopN > 0 && i < highlightTopN;
              const bg = q ? "#FDF3D9" : "#fff";
              const gd = s.gf - s.ga;
              return (
                <tr key={s.id} style={{ backgroundColor: bg, borderBottom: `1px solid #F0EDE2` }}>
                  <td className="py-2.5 pl-3 pr-1 font-bold sticky left-0 z-10"
                    style={{ color: C.mute, backgroundColor: bg, borderLeft: `4px solid ${q ? C.gold : "transparent"}` }}>
                    {i + 1}
                  </td>
                  <td className="py-2.5 px-2 font-semibold sticky z-10" style={{ color: C.ink, backgroundColor: bg, left: "34px", minWidth: "110px" }}>
                    <div className="flex items-center gap-1.5">
                      {i === 0 && s.played > 0 && <Trophy size={13} color={C.gold} fill={C.gold} className="flex-shrink-0" />}
                      <span className="truncate max-w-[130px]">{s.name}</span>
                      {q && <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>{qualifyLabel}</span>}
                    </div>
                  </td>
                  {[s.played, s.w, s.d, s.l, s.gf, s.ga].map((v, k) => (
                    <td key={k} className="py-2.5 px-2 text-center whitespace-nowrap" style={{ color: C.sub }}>{v}</td>
                  ))}
                  <td className="py-2.5 px-2 text-center whitespace-nowrap font-semibold" style={{ color: C.sub }}>{gd > 0 ? `+${gd}` : gd}</td>
                  <td className="py-2.5 pl-2 pr-3 text-center font-extrabold" style={{ color: C.pitch, fontFamily: "'JetBrains Mono', monospace" }}>{s.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
