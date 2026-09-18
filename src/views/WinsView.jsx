import { Medal } from "lucide-react";
import { C, MEDAL_COLORS } from "../lib/theme.js";
import SectionLabel from "../components/SectionLabel.jsx";
import EmptyCard from "../components/EmptyCard.jsx";

// Own table markup rather than StandingsTable — that one's columns are a
// league table's (P/W/D/L/GF/GA/G/D/Pts) and shouldn't grow a mode-agnostic
// third meaning. The first two columns stay sticky the same way so the row
// still scrolls sideways on a narrow phone.
export default function WinsView({ winsTable }) {
  return (
    <div>
      <SectionLabel>All-time</SectionLabel>
      {winsTable.length === 0 ? (
        <EmptyCard>No finished tournaments yet — the first champion starts the all-time table.</EmptyCard>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%" }}>
                <thead>
                  <tr style={{ backgroundColor: C.ink, color: "#F7F5EE" }}>
                    <th className="py-2.5 pl-3 pr-1 text-left font-bold text-xs sticky left-0 z-10" style={{ backgroundColor: C.ink }}>#</th>
                    <th className="py-2.5 px-2 text-left font-bold text-xs sticky z-10" style={{ backgroundColor: C.ink, left: "34px", minWidth: "110px" }}>Player</th>
                    {["Titles", "Played", "W", "Win %"].map((h) => (
                      <th key={h} className="py-2.5 px-2 text-center font-bold text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {winsTable.map((row, i) => {
                    const bg = i === 0 ? "#FDF3D9" : "#fff";
                    const winPct = row.entered > 0 ? `${Math.round((row.titles / row.entered) * 100)}%` : "—";
                    return (
                      <tr key={row.key} style={{ backgroundColor: bg, borderBottom: `1px solid #F0EDE2` }}>
                        <td className="py-2.5 pl-3 pr-1 font-bold sticky left-0 z-10" style={{ backgroundColor: bg }}>
                          {i < 3
                            ? <Medal size={15} color={MEDAL_COLORS[i]} fill={MEDAL_COLORS[i]} />
                            : <span style={{ color: C.mute }}>{i + 1}</span>}
                        </td>
                        <td className="py-2.5 px-2 font-semibold sticky z-10" style={{ color: C.ink, backgroundColor: bg, left: "34px", minWidth: "110px" }}>
                          <span className="truncate max-w-[130px] block">{row.name}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-extrabold whitespace-nowrap" style={{ color: C.pitch, fontFamily: "'JetBrains Mono', monospace" }}>{row.titles}</td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap" style={{ color: C.sub }}>{row.entered}</td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap" style={{ color: C.sub }}>{row.hasResults ? row.w : "—"}</td>
                        <td className="py-2.5 pl-2 pr-3 text-center whitespace-nowrap" style={{ color: C.sub }}>{winPct}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[10px] mt-2" style={{ color: C.mute }}>
            Built from History — delete a tournament there and its wins go with it. Match wins count tournaments finished after the Wins tab was added.
          </p>
        </>
      )}
    </div>
  );
}
