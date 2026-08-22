import { Minus } from "lucide-react";
import { C } from "../lib/theme.js";

export default function GoalPanel({ score, onAdd, onUndo }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <button
        onClick={onAdd}
        className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
        style={{ backgroundColor: "#0F1C12", border: `2px solid ${C.pitchLight}` }}
        aria-label="Add goal"
      >
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "1.6rem", color: C.gold }}>{score}</span>
      </button>
      <button onClick={onUndo} className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ backgroundColor: "#33452F" }} aria-label="Undo goal">
        <Minus size={12} color="#9AAE94" strokeWidth={3} />
      </button>
    </div>
  );
}
