import { RotateCcw } from "lucide-react";
import { C, FONT_IMPORT } from "./lib/theme.js";
import { useTournament } from "./engine/useTournament.js";
import SetupView from "./views/SetupView.jsx";
import StatsView from "./views/StatsView.jsx";
import HistoryView from "./views/HistoryView.jsx";

export default function GardenCup() {
  const {
    players, nameInput, mode, config, matches, goals, modeState, tab, history,
    activeMode, standings, champion, nameOf, topScorers, minuteData, quickestGoal, lastGasp,
    timerControls, actions,
  } = useTournament();

  const tabs = [
    { key: "setup", label: "Players" },
    ...activeMode.tabs({ matches, config, modeState }),
    { key: "stats", label: "Stats" },
    { key: "history", label: history.length ? `History · ${history.length}` : "History" },
  ];

  const subtitle = activeMode.subtitle({ config });
  const ModeView = activeMode.views[tab];

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: C.chalk, fontFamily: "'Inter', sans-serif" }}>
      <style>{FONT_IMPORT}</style>

      {/* Hero */}
      <div className="relative px-5 pt-8 pb-5"
        style={{ background: `repeating-linear-gradient(90deg, ${C.pitch} 0px, ${C.pitch} 40px, ${C.pitchLight} 40px, ${C.pitchLight} 80px)` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.6rem", color: "#F7F5EE", letterSpacing: "0.03em", lineHeight: 1 }}>GARDEN CUP</h1>
            <p className="mt-1.5 text-[10px] font-bold tracking-wider" style={{ color: "#E4D9A8" }}>{subtitle}</p>
          </div>
          {matches.length > 0 && (
            <button onClick={actions.resetAll} className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-full active:scale-95 transition-transform flex-shrink-0"
              style={{ backgroundColor: "rgba(0,0,0,0.28)", color: "#F7F5EE" }}>
              <RotateCcw size={13} /> New
            </button>
          )}
        </div>
        {matches.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
            <activeMode.icon size={12} color={C.gold} />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#F7F5EE" }}>{activeMode.label}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 px-3 py-3" style={{ backgroundColor: C.chalk, borderBottom: `1px solid ${C.line}` }}>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => actions.setTab(t.key)}
              disabled={t.key !== "setup" && t.key !== "history" && matches.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors disabled:opacity-40"
              style={{ backgroundColor: tab === t.key ? C.pitch : "#EAE6D9", color: tab === t.key ? "#F7F5EE" : C.ink }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 pb-20 space-y-5">
        {tab === "setup" && (
          <SetupView players={players} nameInput={nameInput} mode={mode} config={config} matches={matches} activeMode={activeMode} actions={actions} />
        )}

        {tab === "stats" && (
          <StatsView topScorers={topScorers} minuteData={minuteData} quickestGoal={quickestGoal} lastGasp={lastGasp} nameOf={nameOf} />
        )}

        {tab === "history" && <HistoryView history={history} actions={actions} />}

        {ModeView && (
          <ModeView
            players={players} matches={matches} goals={goals} config={config} modeState={modeState}
            nameOf={nameOf} standings={standings} champion={champion} timerControls={timerControls} actions={actions}
          />
        )}
      </div>
    </div>
  );
}
