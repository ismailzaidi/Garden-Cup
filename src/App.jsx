import { useRef, useState } from "react";
import { RotateCcw, Download, Upload, LogOut } from "lucide-react";
import { C } from "./lib/theme.js";
import { useTournament } from "./engine/useTournament.js";
import SetupView from "./views/SetupView.jsx";
import StatsView from "./views/StatsView.jsx";
import HistoryView from "./views/HistoryView.jsx";
import SyncIndicator from "./components/SyncIndicator.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import LoginScreen from "./auth/LoginScreen.jsx";
import { exportData, importData } from "./lib/exportImport.js";
import { useCloudReconciliation } from "./lib/reconcile.js";
import { REMOTE_UPDATE_EVENT } from "./lib/syncEngine.js";

export default function GardenCup() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { mode, ready, user } = useAuth();

  if (mode === "cloud" && !ready) {
    return <div className="min-h-screen w-full" style={{ backgroundColor: C.chalk }} />;
  }
  if (mode === "cloud" && !user) {
    return <LoginScreen />;
  }
  return <TournamentShell />;
}

const pillIconBtn = {
  backgroundColor: "rgba(0,0,0,0.25)",
  width: "1.75rem",
  height: "1.75rem",
  borderRadius: "9999px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function TournamentShell() {
  const { mode, user, logout } = useAuth();
  const {
    players, nameInput, mode: tourneyMode, config, matches, goals, modeState, tab, history,
    activeMode, standings, champion, nameOf, topScorers, minuteData, quickestGoal, lastGasp,
    timerControls, actions,
  } = useTournament();

  const { importPrompt, confirmImport, dismissImport } = useCloudReconciliation(mode, user);
  const fileInputRef = useRef(null);
  const [importError, setImportError] = useState("");

  const tabs = [
    { key: "setup", label: "Players" },
    ...activeMode.tabs({ matches, config, modeState }),
    { key: "stats", label: "Stats" },
    { key: "history", label: history.length ? `History · ${history.length}` : "History" },
  ];

  const subtitle = activeMode.subtitle({ config });
  const ModeView = activeMode.views[tab];

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const bundle = await importData(file);
      setImportError("");
      window.dispatchEvent(new CustomEvent(REMOTE_UPDATE_EVENT, {
        detail: { current: bundle.current, history: bundle.history || [] },
      }));
    } catch (err) {
      setImportError(err?.message || "Couldn't import that file.");
    }
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: C.chalk, fontFamily: "'Inter', sans-serif" }}>

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

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {matches.length > 0 && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
              <activeMode.icon size={12} color={C.gold} />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#F7F5EE" }}>{activeMode.label}</span>
            </div>
          )}
          {mode === "cloud" && <SyncIndicator />}
          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={exportData} title="Export data" style={pillIconBtn}>
              <Download size={12} color="#F7F5EE" />
            </button>
            <button onClick={() => fileInputRef.current?.click()} title="Import data" style={pillIconBtn}>
              <Upload size={12} color="#F7F5EE" />
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
            {mode === "cloud" && (
              <button onClick={logout} title="Sign out" style={pillIconBtn}>
                <LogOut size={12} color="#F7F5EE" />
              </button>
            )}
          </div>
        </div>
        {importError && <p className="mt-2 text-[10px] font-semibold" style={{ color: "#F7C9C2" }}>{importError}</p>}
      </div>

      {importPrompt && (
        <div className="mx-4 mt-4 rounded-2xl p-4 flex items-start justify-between gap-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
          <div>
            <p className="text-sm font-bold" style={{ color: C.ink }}>Import the data already on this device?</p>
            <p className="text-xs mt-1" style={{ color: C.sub }}>Your account has no saved tournaments yet, but this device does — from this sign-in or a previous one. Only import it if it's yours. Nothing is deleted either way.</p>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button onClick={confirmImport} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>Import</button>
            <button onClick={dismissImport} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#EAE6D9", color: C.ink }}>Not now</button>
          </div>
        </div>
      )}

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
          <SetupView players={players} nameInput={nameInput} mode={tourneyMode} config={config} matches={matches} activeMode={activeMode} actions={actions} />
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

      <InstallPrompt />
    </div>
  );
}
