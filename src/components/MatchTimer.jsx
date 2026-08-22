import { Play, Pause, RotateCcw, Timer as TimerIcon } from "lucide-react";
import { C } from "../lib/theme.js";
import { DURATION_PRESETS } from "../lib/theme.js";
import { formatTime } from "../engine/format.js";

export default function MatchTimer({ timer, onStart, onPause, onReset, onSetDuration }) {
  const { remaining, running, duration } = timer;
  const finished = remaining <= 0;
  const untouched = !running && remaining === duration;
  const urgent = running && remaining > 0 && remaining <= 10;
  const pct = duration ? (remaining / duration) * 100 : 0;

  const accent = finished ? "#E2685B" : urgent ? "#F2A33D" : running ? C.gold : "#F7F5EE";

  return (
    <div className={`rounded-xl px-3 py-2.5 mb-3 ${urgent ? "animate-pulse" : ""}`}
      style={{ backgroundColor: finished ? "#3A1A16" : urgent ? "#3D2A0F" : "#0F1C12", border: `1px solid ${finished ? "#6B2A22" : urgent ? "#8A5A1A" : "#243A20"}` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <TimerIcon size={14} color={accent} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "1.15rem", color: accent }}>{formatTime(remaining)}</span>
          {finished && <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: "#E2685B" }}>Time!</span>}
          {urgent && <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: "#F2A33D" }}>Final 10</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!running ? (
            <button onClick={onStart} disabled={finished} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30" style={{ backgroundColor: C.pitchLight }} aria-label="Start">
              <Play size={14} color="#F7F5EE" fill="#F7F5EE" />
            </button>
          ) : (
            <button onClick={onPause} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ backgroundColor: C.gold }} aria-label="Pause">
              <Pause size={14} color={C.ink} fill={C.ink} />
            </button>
          )}
          <button onClick={onReset} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ backgroundColor: "#33452F" }} aria-label="Reset">
            <RotateCcw size={13} color="#F7F5EE" />
          </button>
        </div>
      </div>

      <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: "#22331E" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent, transition: "width 1s linear" }} />
      </div>

      {untouched && (
        <div className="flex gap-1.5 mt-2">
          {DURATION_PRESETS.map((secs) => (
            <button key={secs} onClick={() => onSetDuration(secs)} className="flex-1 py-1 rounded-lg text-[11px] font-bold"
              style={{ backgroundColor: duration === secs ? C.pitchLight : "#1B2B18", color: duration === secs ? "#F7F5EE" : "#7C8C77" }}>
              {secs / 60}m
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
