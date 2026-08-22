import { useEffect, useMemo, useRef, useState } from "react";
import { makeId } from "./match.js";
import { computeStandings, computeTopScorers, computeMinuteBuckets } from "./standings.js";
import { migrateState } from "./persistence.js";
import { playGoalChime } from "./audio.js";
import { useTimers } from "./useTimers.js";
import { storage } from "../lib/storage.js";
import { addHistory, deleteHistory, clearHistory as syncClearHistory, REMOTE_UPDATE_EVENT } from "../lib/syncEngine.js";
import { MODES, getMode } from "../modes/index.js";

const CURRENT_KEY = "gardenCup:current";
const HISTORY_KEY = "gardenCup:history";

function defaultConfig() {
  const cfg = {};
  MODES.forEach((m) => Object.entries(m.config || {}).forEach(([k, spec]) => { cfg[k] = spec.default; }));
  return cfg;
}

export function useTournament() {
  const [players, setPlayers] = useState([]);
  const [nameInput, setNameInput] = useState("");
  const [mode, setMode] = useState("league");
  const [config, setConfigState] = useState(defaultConfig);
  const [matches, setMatches] = useState([]);
  const [goals, setGoals] = useState([]);
  const [modeState, setModeState] = useState({});
  const [tab, setTab] = useState("setup");
  const [history, setHistory] = useState([]);
  const [historySaved, setHistorySaved] = useState(false);
  const [tournamentId, setTournamentId] = useState(() => makeId());
  const [loaded, setLoaded] = useState(false);

  const saveTimeoutRef = useRef(null);
  const { timerControls, displayTimer, clearTimers } = useTimers();

  const activeMode = getMode(mode);

  /* apply a loaded/migrated current-tournament object to state — shared by
     the mount load below and by a remote update (a 409 conflict resolution,
     or the initial cloud reconciliation in App.jsx both dispatch
     REMOTE_UPDATE_EVENT rather than duplicate this) */
  const applyCurrentState = (raw) => {
    const d = migrateState(raw);
    if (!d) return;
    setPlayers(d.players || []);
    setMatches(d.matches || []);
    setGoals(d.goals || []);
    setMode(d.mode || "league");
    setConfigState((prev) => ({ ...prev, ...(d.config || {}) }));
    setModeState(d.modeState || {});
    setTournamentId(d.tournamentId || makeId());
    setHistorySaved(!!d.historySaved);
  };

  /* load saved state */
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(CURRENT_KEY);
        if (res && res.value) applyCurrentState(JSON.parse(res.value));
      } catch { /* nothing saved */ }
      try {
        const r = await storage.get(HISTORY_KEY);
        if (r && r.value) setHistory(JSON.parse(r.value));
      } catch { /* no history */ }
      setLoaded(true);
    })();
  }, []);

  /* pick up a state pushed in from outside the normal load path — a 409
     conflict resolution, or the initial cloud reconciliation after login
     (see src/lib/syncEngine.js and src/App.jsx) */
  useEffect(() => {
    const onRemoteUpdate = (e) => {
      if (e.detail?.current !== undefined) applyCurrentState(e.detail.current);
      if (e.detail?.history !== undefined) setHistory(e.detail.history);
    };
    window.addEventListener(REMOTE_UPDATE_EVENT, onRemoteUpdate);
    return () => window.removeEventListener(REMOTE_UPDATE_EVENT, onRemoteUpdate);
  }, []);

  /* persist */
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      storage.set(CURRENT_KEY, JSON.stringify({
        players, matches, goals, mode, config, modeState, tournamentId, historySaved, schemaVersion: 2,
      })).catch(() => {});
    }, 1500);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [players, matches, goals, mode, config, modeState, tournamentId, historySaved, loaded]);

  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? "?";

  const addPlayer = () => {
    const t = nameInput.trim();
    if (!t) return;
    if (activeMode.maxPlayers && players.length >= activeMode.maxPlayers) return;
    setPlayers((p) => [...p, { id: makeId(), name: t.slice(0, 24) }]);
    setNameInput("");
  };

  const removePlayer = (id) => setPlayers((p) => p.filter((x) => x.id !== id));

  const setConfigValue = (key, value) => setConfigState((prev) => ({ ...prev, [key]: value }));

  const handleGenerate = () => {
    setGoals([]);
    clearTimers();
    setTournamentId(makeId());
    setHistorySaved(false);
    const result = activeMode.createFixtures({ players, config, rng: Math.random });
    setMatches(result.matches);
    setModeState(result.modeState || {});
    setTab(result.initialTab || "setup");
  };

  const resetAll = () => {
    setPlayers([]); setMatches([]); setGoals([]); setNameInput("");
    clearTimers();
    setModeState({});
    setMode("league"); setConfigState(defaultConfig());
    setTab("setup"); setTournamentId(makeId()); setHistorySaved(false);
    storage.delete(CURRENT_KEY).catch(() => {});
  };

  const togglePlayed = (id) => setMatches((p) => p.map((m) => (m.id === id ? { ...m, played: !m.played } : m)));

  /* goals */
  const addGoal = (matchId, side) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    const t = displayTimer(matchId);
    const elapsed = Math.max(0, t.duration - t.remaining);
    playGoalChime();
    setGoals((prev) => [...prev, {
      id: makeId(), matchId, playerId: side === "s1" ? match.p1 : match.p2,
      second: elapsed, duration: t.duration, stage: match.stage,
    }]);
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, [side]: String(Number(m[side] || 0) + 1) } : m)));
  };

  const undoGoal = (matchId, side) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    const pid = side === "s1" ? match.p1 : match.p2;
    setGoals((prev) => {
      let last = -1;
      for (let i = prev.length - 1; i >= 0; i--) if (prev[i].matchId === matchId && prev[i].playerId === pid) { last = i; break; }
      return last === -1 ? prev : prev.filter((_, i) => i !== last);
    });
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, [side]: String(Math.max(0, Number(m[side] || 0) - 1)) } : m)));
  };

  const advance = () => {
    if (!activeMode.advance) return;
    const result = activeMode.advance({ players, matches, config, modeState, rng: Math.random });
    setMatches(result.matches);
    setModeState(result.modeState ?? modeState);
    if (result.tab) setTab(result.tab);
  };

  /* derived — generic across every mode */
  const primaryStage = activeMode.stages[0];
  const standings = useMemo(
    () => computeStandings(players, matches.filter((m) => m.stage === primaryStage)),
    [players, matches, primaryStage]
  );
  const champion = useMemo(
    () => activeMode.champion({ players, matches, config, modeState }),
    [activeMode, players, matches, config, modeState]
  );

  /* stats — shared by every mode */
  const topScorers = useMemo(() => computeTopScorers(players, goals), [players, goals]);
  const minuteData = useMemo(() => computeMinuteBuckets(goals), [goals]);
  const quickestGoal = goals.length ? goals.reduce((a, g) => (g.second < a.second ? g : a), goals[0]) : null;
  const lastGasp = goals.filter((g) => g.duration > 0 && g.duration - g.second <= 10)
    .sort((a, b) => (a.duration - a.second) - (b.duration - b.second))[0] || null;

  /* history */
  useEffect(() => {
    if (!loaded || historySaved || !champion) return;
    const record = {
      id: tournamentId,
      date: new Date().toISOString(),
      mode,
      players: players.map((p) => p.name),
      champion: champion.name,
      topScorer: topScorers[0] ? { name: topScorers[0].name, goals: topScorers[0].goals } : null,
      totalGoals: goals.length,
    };
    setHistory((prev) => {
      const next = [record, ...prev];
      storage.set(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    addHistory(record);
    setHistorySaved(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champion?.id, loaded, historySaved, mode, tournamentId]);

  const deleteHistoryEntry = (id) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      storage.set(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    deleteHistory(id);
  };

  const clearHistory = () => {
    setHistory([]);
    storage.delete(HISTORY_KEY).catch(() => {});
    syncClearHistory();
  };

  return {
    players, nameInput, mode, config, matches, goals, modeState, tab, history, loaded,
    activeMode, standings, champion, nameOf, topScorers, minuteData, quickestGoal, lastGasp,
    timerControls,
    actions: {
      setNameInput, addPlayer, removePlayer, setMode, setConfigValue,
      handleGenerate, resetAll, togglePlayed, addGoal, undoGoal, advance, setTab,
      deleteHistoryEntry, clearHistory,
    },
  };
}
