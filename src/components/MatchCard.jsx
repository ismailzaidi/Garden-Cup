import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { C } from "../lib/theme.js";
import MatchTimer from "./MatchTimer.jsx";
import GoalPanel from "./GoalPanel.jsx";

const CARD_YELLOW = "#F5D90A";
const CARD_RED = "#D8362B";

/* One of the referee's cards (engine/cards.js): the yellow slow-play card or
   the red. Two taps on purpose: a card changes the score or the table, and a
   thumb aiming for the goal button mustn't cost anyone a goal. The first tap
   arms it, the second shows the card, and it disarms by itself if nobody
   follows through. */
function CardButton({ name, count, onCard, kind, color }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  const tap = () => {
    if (!armed) { setArmed(true); return; }
    setArmed(false);
    onCard();
  };

  return (
    <button onClick={tap}
      aria-label={armed ? `Confirm ${kind} for ${name}` : `${kind[0].toUpperCase()}${kind.slice(1)} for ${name}`}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide whitespace-nowrap active:scale-95 transition-transform"
      style={{ backgroundColor: armed ? color : "#33452F", color: armed ? (color === CARD_RED ? "#F7F5EE" : C.ink) : "#9AAE94" }}>
      <span className="rounded-sm flex-shrink-0" style={{ width: 7, height: 10, backgroundColor: armed ? (color === CARD_RED ? "#F7F5EE" : C.ink) : color }} />
      {armed ? "Sure?" : count > 0 ? `×${count}` : null}
    </button>
  );
}

/* Both cards for one side of a match, plus a way back from a red — a red
   docks points, which no goal button can put right. */
function Cards({ match, side, name, align, onCard, onRedCard, onUndoRedCard }) {
  const n = side === "s1" ? 1 : 2;
  const reds = Number(match[`r${n}`] || 0);
  return (
    <div className={`mt-1.5 flex flex-wrap items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {onCard && <CardButton kind="slow play card" color={CARD_YELLOW} name={name} count={Number(match[`c${n}`] || 0)} onCard={() => onCard(match.id, side)} />}
      {onRedCard && <CardButton kind="red card" color={CARD_RED} name={name} count={reds} onCard={() => onRedCard(match.id, side)} />}
      {onUndoRedCard && reds > 0 && (
        <button onClick={() => onUndoRedCard(match.id, side)} aria-label={`Undo red card for ${name}`}
          className="text-[9px] font-bold uppercase tracking-wide underline" style={{ color: "#9AAE94" }}>
          Undo red
        </button>
      )}
    </div>
  );
}

export default function MatchCard({ match, nameOf, onAddGoal, onUndoGoal, onCard, onRedCard, onUndoRedCard, onTogglePlayed, timer, onStart, onPause, onReset, onSetDuration, needsWinner, homeTag, awayTag, hideToggle }) {
  if (match.bye) {
    return (
      <div className="rounded-2xl p-4 flex items-center justify-between gap-2" style={{ backgroundColor: "#EAE6D9", border: `2px dashed #C9C2AC` }}>
        <p className="font-semibold truncate" style={{ color: C.ink }}>{nameOf(match.p1)}</p>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>Bye</span>
      </div>
    );
  }

  const s1 = Number(match.s1 || 0);
  const s2 = Number(match.s2 || 0);
  const played = match.played;
  const tied = played && s1 === s2;

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: C.ink, border: `1px solid ${played ? C.pitchLight : "#2C3B27"}` }}>
      <MatchTimer timer={timer} onStart={onStart} onPause={onPause} onReset={onReset} onSetDuration={onSetDuration} />

      <div className="flex items-center justify-between mb-3 gap-2">
        {hideToggle ? <span /> : (
          <button onClick={() => onTogglePlayed(match.id)}
            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide active:scale-95 transition-transform flex-shrink-0"
            style={{ backgroundColor: played ? C.pitchLight : "#33452F", color: played ? "#F7F5EE" : "#9AAE94" }}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: played ? "#F7F5EE" : "transparent", border: played ? "none" : "1.5px solid #9AAE94" }}>
              {played && <Check size={11} strokeWidth={4} color={C.pitch} />}
            </span>
            {played ? "Played" : "Mark played"}
          </button>
        )}
        {played && (
          <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: tied ? C.draw : C.pitchLight, color: "#F7F5EE" }}>
            {tied ? (needsWinner ? "Tied" : "Draw") : "Full time"}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 text-right">
          {homeTag && <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.gold }}>{homeTag}</p>}
          <p className="truncate font-semibold" style={{ color: "#F7F5EE" }}>{nameOf(match.p1)}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#5C6B57" }}>Home</p>
          <Cards match={match} side="s1" name={nameOf(match.p1)} align="right" onCard={onCard} onRedCard={onRedCard} onUndoRedCard={onUndoRedCard} />
        </div>
        <GoalPanel score={s1} onAdd={() => onAddGoal(match.id, "s1")} onUndo={() => onUndoGoal(match.id, "s1")} />
        <span className="flex-shrink-0" style={{ color: "#5C6B57", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem" }}>VS</span>
        <GoalPanel score={s2} onAdd={() => onAddGoal(match.id, "s2")} onUndo={() => onUndoGoal(match.id, "s2")} />
        <div className="flex-1 min-w-0 text-left">
          {awayTag && <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.gold }}>{awayTag}</p>}
          <p className="truncate font-semibold" style={{ color: "#F7F5EE" }}>{nameOf(match.p2)}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#5C6B57" }}>Away</p>
          <Cards match={match} side="s2" name={nameOf(match.p2)} align="left" onCard={onCard} onRedCard={onRedCard} onUndoRedCard={onUndoRedCard} />
        </div>
      </div>

      {tied && needsWinner && (
        <p className="text-[10px] text-center mt-2.5 font-semibold" style={{ color: "#E2685B" }}>
          Needs a winner — keep playing until someone's ahead.
        </p>
      )}
    </div>
  );
}
