import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Medal, Zap, Flame } from "lucide-react";
import { C, MEDAL_COLORS } from "../lib/theme.js";
import { formatTime } from "../engine/format.js";
import SectionLabel from "../components/SectionLabel.jsx";
import EmptyCard from "../components/EmptyCard.jsx";

export default function StatsView({ topScorers, minuteData, quickestGoal, lastGasp, nameOf }) {
  return (
    <>
      <div>
        <SectionLabel>Top scorers</SectionLabel>
        {topScorers.length === 0 ? (
          <EmptyCard>No goals logged yet — tap a score box during a match to log one.</EmptyCard>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
            {topScorers.slice(0, 8).map((s, i, arr) => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-3"
                style={{ backgroundColor: i === 0 ? "#FDF3D9" : "#fff", borderBottom: i < arr.length - 1 ? `1px solid #F0EDE2` : "none" }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {i < 3 ? <Medal size={17} color={MEDAL_COLORS[i]} fill={MEDAL_COLORS[i]} className="flex-shrink-0" />
                    : <span className="w-[17px] text-center text-xs font-bold flex-shrink-0" style={{ color: C.mute }}>{i + 1}</span>}
                  <span className="font-semibold truncate" style={{ color: C.ink }}>{s.name}</span>
                </div>
                <span className="font-extrabold flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", color: C.pitch }}>{s.goals}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {minuteData.length > 0 && (
        <div>
          <SectionLabel>Goals by minute</SectionLabel>
          <div className="rounded-2xl p-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={minuteData} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE6D9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.mute }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.mute }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="goals" fill={C.pitch} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(quickestGoal || lastGasp) && (
        <div>
          <SectionLabel>Highlights</SectionLabel>
          <div className="space-y-2.5">
            {quickestGoal && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FDF3D9" }}>
                  <Zap size={18} color={C.gold} fill={C.gold} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.mute }}>Quickest goal</p>
                  <p className="text-sm font-semibold truncate" style={{ color: C.ink }}>{nameOf(quickestGoal.playerId)} — {formatTime(quickestGoal.second)}</p>
                </div>
              </div>
            )}
            {lastGasp && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FBE3DE" }}>
                  <Flame size={18} color={C.loss} fill={C.loss} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.mute }}>Last-gasp goal</p>
                  <p className="text-sm font-semibold truncate" style={{ color: C.ink }}>{nameOf(lastGasp.playerId)} — {lastGasp.duration - lastGasp.second}s left</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
