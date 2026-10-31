import { useEffect, useState } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { C } from "./lib/theme.js";
import { useTournament } from "./engine/useTournament.js";
import { getVoicePref, setVoicePref, speakVoiceSample } from "./engine/audio.js";
import SetupView from "./views/SetupView.jsx";
import StatsView from "./views/StatsView.jsx";
import HomeView from "./views/HomeView.jsx";
import AccountView from "./views/AccountView.jsx";
import BottomNav from "./components/BottomNav.jsx";
import WinsView from "./views/WinsView.jsx";
import HistoryView from "./views/HistoryView.jsx";
import StakesCard from "./components/StakesCard.jsx";
import SyncIndicator from "./components/SyncIndicator.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import ConflictBanner from "./components/ConflictBanner.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import LoginScreen from "./auth/LoginScreen.jsx";
import { useCloudReconciliation } from "./lib/reconcile.js";

export default function GardenCup() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

/* Where an email link sent us (api/auth/confirm.js): ?confirmed=1 after
   confirming an email, ?reset=1 after a "forgot password" link,
   ?confirm_error=1 for a bad or expired link. Read once; the effect in
   AppShell tidies it out of the address bar. */
function readArrival() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has("reset")) return "reset";
  if (params.has("confirmed")) return "confirmed";
  if (params.has("confirm_error")) return "confirm_error";
  return null;
}

/* The three screens: Home (the dashboard), Play (the tournament itself) and
   My account, plus the sign-in screen. Playing never needs an account:
   with no one signed in, everything stays on this device as it always has,
   and signing in adds sync on top. */
function AppShell() {
  const auth = useAuth();
  const { mode, ready, user } = auth;
  const t = useTournament();
  const reconcile = useCloudReconciliation(mode, user);
  const [arrival, setArrival] = useState(readArrival);
  const [screen, setScreen] = useState(() => {
    if (arrival === "reset") return "account";
    if (arrival === "confirm_error") return "signin";
    return "home";
  });

  useEffect(() => {
    if (arrival && window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [arrival]);

  // Signing in from the sign-in screen lands on Home.
  useEffect(() => {
    if (user && screen === "signin") setScreen("home");
  }, [user, screen]);

  if (mode === "cloud" && !ready) {
    return <div className="min-h-screen w-full" style={{ backgroundColor: C.chalk }} />;
  }
  if (screen === "signin") {
    return <LoginScreen onBack={() => setScreen("home")} linkError={arrival === "confirm_error"} />;
  }

  const inProgress = t.matches.length > 0 && !t.champion;

  // A mode card on Home: a fresh tournament in that mode, same players.
  const startMode = (key) => {
    if (inProgress && !window.confirm("Start a new tournament? The one in progress will be cleared. Finished tournaments stay in History.")) return;
    t.actions.resetAll();
    t.actions.setMode(key);
    setScreen("play");
  };
  const openTab = (tab) => { t.actions.setTab(tab); setScreen("play"); };

  const banners = <Banners mode={mode} reconcile={reconcile} />;

  return (
    <>
      {screen === "home" && (
        <HomeView user={user} cloud={mode === "cloud"} history={t.history} winsTable={t.winsTable}
          confirmed={arrival === "confirmed" && Boolean(user)} onDismissConfirmed={() => setArrival(null)}
          banners={banners} onStartMode={startMode} onOpenTab={openTab} onSignIn={() => setScreen("signin")} />
      )}
      {screen === "play" && <TournamentShell t={t} banners={banners} />}
      {screen === "account" && (
        <AccountView auth={auth} resetPassword={arrival === "reset" && Boolean(user)} onResetDone={() => setArrival(null)}
          banners={banners} onSignIn={() => setScreen("signin")} onSignedOut={() => setScreen("home")} />
      )}
      <BottomNav screen={screen} onChange={setScreen} inProgress={inProgress} signedIn={Boolean(user)} cloud={mode === "cloud"} />
      <InstallPrompt />
    </>
  );
}

/* Shown under each screen's header: the sync conflict banner, and the
   "import this device's data?" question after signing in. */
function Banners({ mode, reconcile }) {
  const { importPrompt, confirmImport, dismissImport } = reconcile;
  return (
    <>
      {mode === "cloud" && <ConflictBanner />}
      {importPrompt && (
        <div className="mx-4 mt-4 rounded-2xl p-4 flex items-start justify-between gap-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
          <div>
            <p className="text-sm font-bold" style={{ color: C.ink }}>Import the data already on this device?</p>
            <p className="text-xs mt-1" style={{ color: C.sub }}>Your account has no tournament in progress, but this device does — from this sign-in or a previous one. Only import it if it's yours. Nothing is deleted either way.</p>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button onClick={confirmImport} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>Import</button>
            <button onClick={dismissImport} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#EAE6D9", color: C.ink }}>Not now</button>
          </div>
        </div>
      )}
    </>
  );
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

// Tabs usable with no live tournament — built from history/setup, not the
// in-progress state — stay enabled regardless of `matches.length`.
const ALWAYS_ON = new Set(["setup", "wins", "history"]);

function TournamentShell({ t, banners }) {
  const { mode } = useAuth();
  const {
    players, nameInput, mode: tourneyMode, config, matches, goals, modeState, stakes, tab, history,
    activeMode, standings, champion, lastPlace, nameOf, topScorers, minuteData, cardCounts, quickestGoal, lastGasp, winsTable,
    timerControls, actions,
  } = t;

  // Device-local, like the preference it reflects (see getVoicePref in
  // engine/audio.js) — read once at mount, never carried in useTournament's
  // state, so it isn't part of what exports or syncs.
  const [voiceOn, setVoiceOn] = useState(() => getVoicePref());

  // Toggling the voice on lets whoever just switched it on hear a sample of
  // the same voice used for the countdown, the paused-game reminder, and
  // the spoken result.
  const toggleVoice = () => {
    const next = !voiceOn;
    setVoicePref(next);
    setVoiceOn(next);
    if (next) speakVoiceSample();
  };

  const tabs = [
    { key: "setup", label: "Players" },
    ...activeMode.tabs({ matches, config, modeState }),
    { key: "stats", label: "Stats" },
    { key: "wins", label: "Wins" },
    { key: "history", label: history.length ? `History · ${history.length}` : "History" },
  ];

  const subtitle = activeMode.subtitle({ config });
  const ModeView = activeMode.views[tab];

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
            <button onClick={toggleVoice} title={voiceOn ? "Turn voice off" : "Turn voice on"}
              aria-label={voiceOn ? "Turn voice off" : "Turn voice on"} aria-pressed={voiceOn} style={pillIconBtn}>
              {voiceOn ? <Volume2 size={12} color="#F7F5EE" /> : <VolumeX size={12} color="#F7F5EE" />}
            </button>
          </div>
        </div>
      </div>

      {banners}

      {/* Tabs */}
      <div className="sticky top-0 z-20 px-3 py-3" style={{ backgroundColor: C.chalk, borderBottom: `1px solid ${C.line}` }}>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => actions.setTab(t.key)}
              disabled={!ALWAYS_ON.has(t.key) && matches.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors disabled:opacity-40"
              style={{ backgroundColor: tab === t.key ? C.pitch : "#EAE6D9", color: tab === t.key ? "#F7F5EE" : C.ink }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 pb-28 space-y-5">
        {tab === "setup" && (
          <SetupView players={players} nameInput={nameInput} mode={tourneyMode} config={config} matches={matches} activeMode={activeMode}
            stakes={stakes} knownNames={winsTable.map((r) => r.name)} actions={actions} />
        )}

        {tab === "stats" && (
          <StatsView topScorers={topScorers} minuteData={minuteData} cardCounts={cardCounts} quickestGoal={quickestGoal} lastGasp={lastGasp} nameOf={nameOf} />
        )}

        {tab === "wins" && <WinsView winsTable={winsTable} />}

        {tab === "history" && <HistoryView history={history} actions={actions} />}

        {ModeView && <StakesCard stakes={stakes} champion={champion} lastPlace={lastPlace} />}

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
