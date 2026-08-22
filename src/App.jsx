import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus, X, Trophy, RotateCcw, Check, Minus, Award, Play, Pause,
  Timer as TimerIcon, Medal, Zap, Flame, Shuffle, Trash2, Crown,
  ListOrdered, Swords, ChevronRight, Users, Target,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/* ---------- persistent storage (localStorage) ---------- */
const storage = {
  get: async (key) => {
    const v = localStorage.getItem(key);
    return v === null ? null : { key, value: v };
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return { key, value };
  },
  delete: async (key) => {
    localStorage.removeItem(key);
    return { key, deleted: true };
  },
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');`;

const C = {
  pitch: "#1E5631",
  pitchLight: "#2F7A42",
  chalk: "#F7F5EE",
  gold: "#F4B942",
  ink: "#16241A",
  draw: "#8B8F87",
  loss: "#C1443B",
  line: "#E4E0D2",
  mute: "#8B8F87",
  sub: "#5C6B57",
};

const DURATION_PRESETS = [60, 120, 180, 300];
const MEDAL_COLORS = ["#F4B942", "#C9CDD3", "#C9793F"];

const MODES = [
  { key: "league", label: "League + Final", desc: "Round robin, top 2 play off", icon: ListOrdered },
  { key: "knockout", label: "Knockout", desc: "Single elimination bracket", icon: Swords },
  { key: "king", label: "Winner Stays On", desc: "Beat the king, queue to challenge", icon: Crown },
  { key: "roundrobin", label: "Pure League", desc: "Round robin, no final — top of table wins", icon: Users },
];

/* ---------- utils ---------- */

const makeId = () => Math.random().toString(36).slice(2, 10);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const randomOrder = (a, b) => (Math.random() < 0.5 ? [a, b] : [b, a]);

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

/* ---------- audio ---------- */

let sharedAudioCtx = null;

function getAudioContext() {
  if (!sharedAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch (e) { /* no audio */ }
}

function tone(freq, type, when, dur, vol) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + dur + 0.02);
}

function playBeep() {
  try {
    unlockAudio();
    [0, 0.22, 0.44].forEach((o) => tone(880, "square", o, 0.18, 0.15));
  } catch (e) { /* no audio */ }
}

function playWarningBeep() {
  try {
    unlockAudio();
    tone(1318, "sine", 0, 0.15, 0.12);
  } catch (e) { /* no audio */ }
}

function playGoalChime() {
  try {
    unlockAudio();
    tone(659, "triangle", 0, 0.12, 0.1);
    tone(988, "triangle", 0.1, 0.16, 0.1);
  } catch (e) { /* no audio */ }
}

/* ---------- fixture generation ---------- */

function generateGroupMatches(players, legCount) {
  const pairs = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) pairs.push([players[i], players[j]]);
  }
  const matches = [];
  for (let leg = 1; leg <= legCount; leg++) {
    shuffle(pairs).forEach(([p1, p2]) => {
      const [a, b] = randomOrder(p1, p2);
      matches.push({ id: makeId(), stage: "group", leg, p1: a.id, p2: b.id, s1: "0", s2: "0", played: false });
    });
  }
  return matches;
}

function generateFinalMatches(p1, p2, legCount) {
  return Array.from({ length: legCount }, (_, i) => {
    const [a, b] = randomOrder(p1, p2);
    return { id: makeId(), stage: "final", leg: i + 1, p1: a.id, p2: b.id, s1: "0", s2: "0", played: false };
  });
}

function generateKnockoutRound1(players) {
  const shuffled = shuffle(players);
  let size = 1;
  while (size < shuffled.length) size *= 2;
  const slots = [...shuffled];
  while (slots.length < size) slots.push(null);
  const round = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    if (a && b) {
      round.push({ id: makeId(), stage: "knockout", round: 1, p1: a.id, p2: b.id, s1: "0", s2: "0", played: false, bye: false });
    } else if (a || b) {
      round.push({ id: makeId(), stage: "knockout", round: 1, p1: (a || b).id, p2: null, s1: "0", s2: "0", played: true, bye: true });
    }
  }
  return round;
}

function makeKingMatch(seq, kingId, challengerId) {
  return { id: makeId(), stage: "king", seq, p1: kingId, p2: challengerId, s1: "0", s2: "0", played: false };
}

function matchWinner(m) {
  if (m.bye) return m.p1;
  if (!m.played) return null;
  const s1 = Number(m.s1 || 0);
  const s2 = Number(m.s2 || 0);
  if (s1 === s2) return null;
  return s1 > s2 ? m.p1 : m.p2;
}

function roundLabel(n) {
  if (n === 1) return "FINAL";
  if (n === 2) return "SEMI-FINAL";
  if (n === 4) return "QUARTER-FINAL";
  return `ROUND OF ${n * 2}`;
}

/* ---------- stats ---------- */

function computeStandings(players, matches) {
  const table = {};
  players.forEach((p) => {
    table[p.id] = { id: p.id, name: p.name, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  });
  matches.forEach((m) => {
    if (!m.played || m.bye) return;
    const s1 = Number(m.s1 || 0);
    const s2 = Number(m.s2 || 0);
    const a = table[m.p1];
    const b = table[m.p2];
    if (!a || !b) return;
    a.played++; b.played++;
    a.gf += s1; a.ga += s2;
    b.gf += s2; b.ga += s1;
    if (s1 > s2) { a.w++; b.l++; a.pts += 3; }
    else if (s2 > s1) { b.w++; a.l++; b.pts += 3; }
    else { a.d++; b.d++; a.pts += 1; b.pts += 1; }
  });
  return Object.values(table).sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    const gdX = x.gf - x.ga, gdY = y.gf - y.ga;
    if (gdY !== gdX) return gdY - gdX;
    if (y.gf !== x.gf) return y.gf - x.gf;
    return x.name.localeCompare(y.name);
  });
}

function computeTopScorers(players, goals) {
  const counts = {};
  players.forEach((p) => { counts[p.id] = { id: p.id, name: p.name, goals: 0 }; });
  goals.forEach((g) => { if (counts[g.playerId]) counts[g.playerId].goals++; });
  return Object.values(counts).filter((c) => c.goals > 0).sort((a, b) => b.goals - a.goals);
}

function computeMinuteBuckets(goals) {
  if (!goals.length) return [];
  const buckets = {};
  goals.forEach((g) => {
    const m = Math.floor(g.second / 60);
    buckets[m] = (buckets[m] || 0) + 1;
  });
  const max = Math.max(...Object.keys(buckets).map(Number));
  return Array.from({ length: max + 1 }, (_, m) => ({ label: `${m}-${m + 1}m`, goals: buckets[m] || 0 }));
}

function computeKingStreaks(kingMatches) {
  const best = {};
  let currentId = null;
  let run = 0;
  kingMatches.filter((m) => m.played).sort((a, b) => a.seq - b.seq).forEach((m) => {
    const w = matchWinner(m) || m.p1; // draw = king defends
    if (w === currentId) run += 1; else { currentId = w; run = 1; }
    best[w] = Math.max(best[w] || 0, run);
  });
  return { best, currentId, run };
}

/* ---------- shared UI ---------- */

function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.sub }}>{children}</p>
      {right}
    </div>
  );
}

function EmptyCard({ children }) {
  return (
    <div className="rounded-2xl p-6 text-center text-sm" style={{ backgroundColor: "#fff", border: `2px dashed ${C.line}`, color: C.mute }}>
      {children}
    </div>
  );
}

function ChampionBanner({ name, subtitle }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${C.gold} 0%, #E8A62B 100%)`, border: `2px solid ${C.ink}` }}>
      <Trophy size={34} color={C.ink} fill={C.ink} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.ink }}>Champion</p>
        <p className="truncate" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.9rem", color: C.ink, lineHeight: 1.05 }}>{name}</p>
        {subtitle && <p className="text-[11px] font-semibold mt-0.5" style={{ color: "#4A3C10" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.sub }}>Progress</span>
        <span className="text-[11px] font-bold" style={{ color: C.sub, fontFamily: "'JetBrains Mono', monospace" }}>{value}/{total}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: C.line }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: C.pitch }} />
      </div>
    </div>
  );
}

function GoalPanel({ score, onAdd, onUndo }) {
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

function MatchTimer({ timer, onStart, onPause, onReset, onSetDuration }) {
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

function MatchCard({ match, nameOf, onAddGoal, onUndoGoal, onTogglePlayed, timer, onStart, onPause, onReset, onSetDuration, needsWinner, homeTag, awayTag, hideToggle }) {
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
        </div>
        <GoalPanel score={s1} onAdd={() => onAddGoal(match.id, "s1")} onUndo={() => onUndoGoal(match.id, "s1")} />
        <span className="flex-shrink-0" style={{ color: "#5C6B57", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem" }}>VS</span>
        <GoalPanel score={s2} onAdd={() => onAddGoal(match.id, "s2")} onUndo={() => onUndoGoal(match.id, "s2")} />
        <div className="flex-1 min-w-0 text-left">
          {awayTag && <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.gold }}>{awayTag}</p>}
          <p className="truncate font-semibold" style={{ color: "#F7F5EE" }}>{nameOf(match.p2)}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#5C6B57" }}>Away</p>
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

function StandingsTable({ standings, highlightTopN = 0, qualifyLabel = "FINAL" }) {
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

/* ---------- App ---------- */

export default function GardenCup() {
  const [players, setPlayers] = useState([]);
  const [nameInput, setNameInput] = useState("");
  const [mode, setMode] = useState("league");
  const [legCount, setLegCount] = useState(3);
  const [kingTarget, setKingTarget] = useState(3);
  const [matches, setMatches] = useState([]);
  const [goals, setGoals] = useState([]);
  const [kingQueue, setKingQueue] = useState([]);
  const [tab, setTab] = useState("setup");
  const [fixtureFilter, setFixtureFilter] = useState("all");
  const [timers, setTimers] = useState({});
  const [now, setNow] = useState(Date.now());
  const [history, setHistory] = useState([]);
  const [historySaved, setHistorySaved] = useState(false);
  const [tournamentId, setTournamentId] = useState(() => makeId());
  const [loaded, setLoaded] = useState(false);

  const beepedRef = useRef({});
  const warnedRef = useRef({});
  const saveTimeoutRef = useRef(null);

  /* audio unlock on first tap */
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  /* load saved state */
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("gardenCup:current");
        if (res && res.value) {
          const d = JSON.parse(res.value);
          setPlayers(d.players || []);
          setMatches(d.matches || []);
          setGoals(d.goals || []);
          setMode(d.mode || "league");
          setLegCount(d.legCount || 3);
          setKingTarget(d.kingTarget || 3);
          setKingQueue(d.kingQueue || []);
          setTournamentId(d.tournamentId || makeId());
          setHistorySaved(!!d.historySaved);
        }
      } catch (e) { /* nothing saved */ }
      try {
        const r = await storage.get("gardenCup:history");
        if (r && r.value) setHistory(JSON.parse(r.value));
      } catch (e) { /* no history */ }
      setLoaded(true);
    })();
  }, []);

  /* persist */
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      storage.set("gardenCup:current", JSON.stringify({
        players, matches, goals, mode, legCount, kingTarget, kingQueue, tournamentId, historySaved,
      })).catch(() => {});
    }, 500);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [players, matches, goals, mode, legCount, kingTarget, kingQueue, tournamentId, historySaved, loaded]);

  /* timer tick */
  useEffect(() => {
    const interval = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setTimers((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(prev).forEach(([id, timer]) => {
          if (!timer.running) return;
          const remaining = Math.max(0, Math.ceil((timer.endTime - t) / 1000));
          if (remaining <= 0) {
            next[id] = { ...timer, running: false, remaining: 0 };
            changed = true;
            if (!beepedRef.current[id]) { beepedRef.current[id] = true; playBeep(); }
          } else if (remaining <= 10 && !warnedRef.current[id]) {
            warnedRef.current[id] = true;
            playWarningBeep();
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? "?";

  const addPlayer = () => {
    const t = nameInput.trim();
    if (!t) return;
    setPlayers((p) => [...p, { id: makeId(), name: t.slice(0, 24) }]);
    setNameInput("");
  };

  const removePlayer = (id) => setPlayers((p) => p.filter((x) => x.id !== id));

  const handleGenerate = () => {
    setGoals([]);
    setTimers({});
    beepedRef.current = {};
    warnedRef.current = {};
    setTournamentId(makeId());
    setHistorySaved(false);

    if (mode === "knockout") {
      setMatches(generateKnockoutRound1(players));
      setKingQueue([]);
      setTab("bracket");
    } else if (mode === "king") {
      const order = shuffle(players);
      setMatches([makeKingMatch(1, order[0].id, order[1].id)]);
      setKingQueue(order.slice(2).map((p) => p.id));
      setTab("arena");
    } else {
      setMatches(generateGroupMatches(players, legCount));
      setKingQueue([]);
      setTab("fixtures");
    }
  };

  const resetAll = () => {
    setPlayers([]); setMatches([]); setGoals([]); setNameInput("");
    setTimers({}); setKingQueue([]);
    beepedRef.current = {}; warnedRef.current = {};
    setMode("league"); setLegCount(3); setKingTarget(3);
    setTab("setup"); setTournamentId(makeId()); setHistorySaved(false);
    storage.delete("gardenCup:current").catch(() => {});
  };

  const togglePlayed = (id) => setMatches((p) => p.map((m) => (m.id === id ? { ...m, played: !m.played } : m)));

  /* timers */
  const getTimer = (id) => timers[id] || { duration: 180, remaining: 180, running: false, endTime: null };
  const startTimer = (id) => {
    unlockAudio();
    beepedRef.current[id] = false; warnedRef.current[id] = false;
    setTimers((prev) => {
      const t = prev[id] || { duration: 180, remaining: 180 };
      const remaining = t.remaining ?? t.duration;
      return { ...prev, [id]: { ...t, running: true, endTime: Date.now() + remaining * 1000 } };
    });
  };
  const pauseTimer = (id) => setTimers((prev) => {
    const t = prev[id];
    if (!t || !t.running) return prev;
    return { ...prev, [id]: { ...t, running: false, remaining: Math.max(0, Math.ceil((t.endTime - Date.now()) / 1000)), endTime: null } };
  });
  const resetTimer = (id) => {
    beepedRef.current[id] = false; warnedRef.current[id] = false;
    setTimers((prev) => {
      const t = prev[id] || { duration: 180 };
      return { ...prev, [id]: { duration: t.duration, remaining: t.duration, running: false, endTime: null } };
    });
  };
  const setTimerDuration = (id, secs) => {
    beepedRef.current[id] = false; warnedRef.current[id] = false;
    setTimers((prev) => ({ ...prev, [id]: { duration: secs, remaining: secs, running: false, endTime: null } }));
  };
  const displayTimer = (id) => {
    const t = getTimer(id);
    return t.running ? { ...t, remaining: Math.max(0, Math.ceil((t.endTime - now) / 1000)) } : t;
  };
  const timerControls = (id) => ({
    timer: displayTimer(id),
    onStart: () => startTimer(id),
    onPause: () => pauseTimer(id),
    onReset: () => resetTimer(id),
    onSetDuration: (s) => setTimerDuration(id, s),
  });

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

  /* derived */
  const groupMatches = matches.filter((m) => m.stage === "group");
  const finalMatches = matches.filter((m) => m.stage === "final");
  const knockoutMatches = matches.filter((m) => m.stage === "knockout");
  const kingMatches = matches.filter((m) => m.stage === "king");

  const standings = useMemo(() => computeStandings(players, groupMatches), [players, matches]);
  const kingStandings = useMemo(() => computeStandings(players, kingMatches), [players, matches]);
  const finalists = finalMatches.length ? players.filter((p) => p.id === finalMatches[0].p1 || p.id === finalMatches[0].p2) : [];
  const finalStandings = useMemo(() => computeStandings(finalists, finalMatches), [matches, players]);

  const playedCount = groupMatches.filter((m) => m.played).length;
  const finalPlayedCount = finalMatches.filter((m) => m.played).length;

  const generateFinal = () => {
    if (standings.length < 2) return;
    setMatches((prev) => [...prev.filter((m) => m.stage !== "final"), ...generateFinalMatches(standings[0], standings[1], legCount)]);
    setTab("final");
  };

  /* knockout */
  const koRounds = {};
  knockoutMatches.forEach((m) => { (koRounds[m.round] = koRounds[m.round] || []).push(m); });
  const koRoundNums = Object.keys(koRounds).map(Number).sort((a, b) => a - b);
  const latestRound = koRoundNums[koRoundNums.length - 1];
  const latestRoundMatches = koRounds[latestRound] || [];
  const latestWinners = latestRoundMatches.map(matchWinner);
  const roundDecided = latestRoundMatches.length > 0 && latestWinners.every(Boolean);
  const isFinalRound = latestRoundMatches.length === 1;
  const koChampionId = isFinalRound && roundDecided ? latestWinners[0] : null;
  const koChampion = koChampionId ? players.find((p) => p.id === koChampionId) : null;
  const canAdvance = roundDecided && !isFinalRound;

  const advanceRound = () => {
    if (!canAdvance) return;
    const next = [];
    for (let i = 0; i < latestWinners.length; i += 2) {
      const [a, b] = randomOrder(latestWinners[i], latestWinners[i + 1]);
      next.push({ id: makeId(), stage: "knockout", round: latestRound + 1, p1: a, p2: b, s1: "0", s2: "0", played: false, bye: false });
    }
    setMatches((prev) => [...prev, ...next]);
  };

  /* king of the hill */
  const lastKingMatch = kingMatches.length ? kingMatches.reduce((a, b) => (b.seq > a.seq ? b : a)) : null;
  const kingStreaks = useMemo(() => computeKingStreaks(kingMatches), [matches]);
  const kingChampionId = kingStreaks.run >= kingTarget ? kingStreaks.currentId : null;
  const kingChampion = kingChampionId ? players.find((p) => p.id === kingChampionId) : null;

  // The live match is the newest one that hasn't been confirmed yet.
  const currentKingMatch = lastKingMatch && !lastKingMatch.played ? lastKingMatch : null;
  // Recovery: newest match got marked played without confirming, so no next fixture exists.
  const kingNeedsNext = !!lastKingMatch && lastKingMatch.played && !kingChampion && players.length >= 2;

  const advanceKing = () => {
    const m = lastKingMatch;
    if (!m) return;
    const s1 = Number(m.s1 || 0);
    const s2 = Number(m.s2 || 0);
    const winner = s1 >= s2 ? m.p1 : m.p2; // draw = king defends
    const loser = winner === m.p1 ? m.p2 : m.p1;

    const nextQueue = [...kingQueue, loser];
    const challenger = nextQueue.shift();

    setMatches((prev) => {
      const marked = prev.map((x) => (x.id === m.id ? { ...x, played: true } : x));
      const streakAfter = computeKingStreaks(marked.filter((x) => x.stage === "king"));
      if (streakAfter.run >= kingTarget) return marked; // crown won — stop here
      if (!challenger) return marked;
      return [...marked, makeKingMatch(m.seq + 1, winner, challenger)];
    });
    setKingQueue(nextQueue);
  };

  /* stats */
  const topScorers = useMemo(() => computeTopScorers(players, goals), [players, goals]);
  const minuteData = useMemo(() => computeMinuteBuckets(goals), [goals]);
  const quickestGoal = goals.length ? goals.reduce((a, g) => (g.second < a.second ? g : a), goals[0]) : null;
  const lastGasp = goals.filter((g) => g.duration > 0 && g.duration - g.second <= 10)
    .sort((a, b) => (a.duration - a.second) - (b.duration - b.second))[0] || null;

  /* champions per mode */
  const leagueChampion = finalMatches.length > 0 && finalPlayedCount === finalMatches.length && finalStandings.length === 2
    ? (finalStandings[0].pts !== finalStandings[1].pts ? finalStandings[0] : null) : null;

  const rrComplete = mode === "roundrobin" && groupMatches.length > 0 && playedCount === groupMatches.length;
  const rrChampion = rrComplete && standings.length > 0 && (standings.length === 1 || standings[0].pts !== standings[1].pts) ? standings[0] : null;

  const activeChampion =
    mode === "knockout" ? koChampion :
    mode === "king" ? kingChampion :
    mode === "roundrobin" ? rrChampion :
    leagueChampion;

  /* history */
  useEffect(() => {
    if (!loaded || historySaved || !activeChampion) return;
    const record = {
      id: tournamentId,
      date: new Date().toISOString(),
      mode,
      players: players.map((p) => p.name),
      champion: activeChampion.name,
      topScorer: topScorers[0] ? { name: topScorers[0].name, goals: topScorers[0].goals } : null,
      totalGoals: goals.length,
    };
    setHistory((prev) => {
      const next = [record, ...prev];
      storage.set("gardenCup:history", JSON.stringify(next)).catch(() => {});
      return next;
    });
    setHistorySaved(true);
  }, [activeChampion?.id, loaded, historySaved, mode, tournamentId]);

  const deleteHistoryEntry = (id) => setHistory((prev) => {
    const next = prev.filter((h) => h.id !== id);
    storage.set("gardenCup:history", JSON.stringify(next)).catch(() => {});
    return next;
  });

  const clearHistory = () => {
    setHistory([]);
    storage.delete("gardenCup:history").catch(() => {});
  };

  /* fixtures view */
  const visibleMatches = groupMatches.filter((m) => {
    if (fixtureFilter === "played") return m.played;
    if (fixtureFilter === "remaining") return !m.played;
    return true;
  });
  const legs = Array.from({ length: legCount }, (_, i) => i + 1).filter((l) => visibleMatches.some((m) => m.leg === l));

  const modeMeta = MODES.find((m) => m.key === mode);

  const tabs = [{ key: "setup", label: "Players" }];
  if (mode === "knockout") tabs.push({ key: "bracket", label: knockoutMatches.length ? `Bracket · R${latestRound}` : "Bracket" });
  else if (mode === "king") tabs.push({ key: "arena", label: "Arena" }, { key: "kingtable", label: "Table" });
  else {
    tabs.push({ key: "fixtures", label: matches.length ? `Fixtures · ${playedCount}/${groupMatches.length}` : "Fixtures" });
    tabs.push({ key: "standings", label: "Table" });
    if (mode === "league") tabs.push({ key: "final", label: finalMatches.length ? `Final · ${finalPlayedCount}/${legCount}` : "Final" });
  }
  tabs.push({ key: "stats", label: "Stats" });
  tabs.push({ key: "history", label: history.length ? `History · ${history.length}` : "History" });

  const subtitle =
    mode === "knockout" ? "SINGLE ELIMINATION · WINNER TAKES ALL" :
    mode === "king" ? `WINNER STAYS ON · FIRST TO ${kingTarget} IN A ROW` :
    mode === "roundrobin" ? `ROUND ROBIN · ${legCount} LEG${legCount > 1 ? "S" : ""} · TOP OF TABLE WINS` :
    `${legCount} LEG${legCount > 1 ? "S" : ""} · 3 PTS WIN · TOP 2 REACH THE FINAL`;

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
            <button onClick={resetAll} className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-full active:scale-95 transition-transform flex-shrink-0"
              style={{ backgroundColor: "rgba(0,0,0,0.28)", color: "#F7F5EE" }}>
              <RotateCcw size={13} /> New
            </button>
          )}
        </div>
        {modeMeta && matches.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
            <modeMeta.icon size={12} color={C.gold} />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#F7F5EE" }}>{modeMeta.label}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 px-3 py-3" style={{ backgroundColor: C.chalk, borderBottom: `1px solid ${C.line}` }}>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              disabled={t.key !== "setup" && t.key !== "history" && matches.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors disabled:opacity-40"
              style={{ backgroundColor: tab === t.key ? C.pitch : "#EAE6D9", color: tab === t.key ? "#F7F5EE" : C.ink }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 pb-20 space-y-5">
        {/* SETUP */}
        {tab === "setup" && (
          <>
            <div>
              <SectionLabel>Game mode</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => {
                  const Icon = m.icon;
                  const active = mode === m.key;
                  return (
                    <button key={m.key} onClick={() => matches.length === 0 && setMode(m.key)} disabled={matches.length > 0}
                      className="rounded-xl p-3 text-left disabled:opacity-60 active:scale-[0.98] transition-transform"
                      style={{ backgroundColor: active ? C.pitch : "#fff", border: `2px solid ${active ? C.pitch : C.line}` }}>
                      <Icon size={16} color={active ? C.gold : C.pitch} />
                      <p className="text-[13px] font-bold mt-1.5 leading-tight" style={{ color: active ? "#F7F5EE" : C.ink }}>{m.label}</p>
                      <p className="text-[10px] mt-0.5 leading-snug" style={{ color: active ? "#D8E8D3" : C.mute }}>{m.desc}</p>
                    </button>
                  );
                })}
              </div>
              {matches.length > 0 && <p className="text-[10px] mt-2" style={{ color: C.mute }}>Tap "New" up top to change mode.</p>}
            </div>

            {(mode === "league" || mode === "roundrobin") && matches.length === 0 && (
              <div>
                <SectionLabel>Legs per pairing</SectionLabel>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} onClick={() => setLegCount(n)} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ backgroundColor: legCount === n ? C.pitch : "#fff", color: legCount === n ? "#F7F5EE" : C.ink, border: `2px solid ${legCount === n ? C.pitch : C.line}` }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "king" && matches.length === 0 && (
              <div>
                <SectionLabel>Wins in a row to take the crown</SectionLabel>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setKingTarget(n)} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ backgroundColor: kingTarget === n ? C.pitch : "#fff", color: kingTarget === n ? "#F7F5EE" : C.ink, border: `2px solid ${kingTarget === n ? C.pitch : C.line}` }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionLabel>Add a player</SectionLabel>
              <div className="flex gap-2">
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                  placeholder="Player name" maxLength={24}
                  className="flex-1 min-w-0 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  style={{ backgroundColor: "#fff", border: `2px solid ${C.line}`, color: C.ink }} />
                <button onClick={addPlayer} className="w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
                  style={{ backgroundColor: C.pitch }}>
                  <Plus color="#F7F5EE" size={20} strokeWidth={3} />
                </button>
              </div>
            </div>

            {players.length > 0 && (
              <div>
                <SectionLabel>Players ({players.length})</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-semibold max-w-full"
                      style={{ backgroundColor: "#fff", border: `2px solid ${C.line}`, color: C.ink }}>
                      <span className="truncate max-w-[150px]">{p.name}</span>
                      <button onClick={() => removePlayer(p.id)} className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EAE6D9" }}>
                        <X size={12} strokeWidth={3} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {players.length >= 2 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
                <p className="text-sm flex items-start gap-2" style={{ color: C.sub }}>
                  <Target size={15} className="flex-shrink-0 mt-0.5" color={C.pitch} />
                  <span>
                    {mode === "knockout" && <><b style={{ color: C.ink }}>{players.length} players</b> shuffled into a random bracket — byes handed out automatically.</>}
                    {mode === "king" && <><b style={{ color: C.ink }}>{players.length} players</b> queue up. Winner stays on; first to <b style={{ color: C.ink }}>{kingTarget} in a row</b> takes the crown. A draw means the king defends.</>}
                    {(mode === "league" || mode === "roundrobin") && (
                      <><b style={{ color: C.ink }}>{(players.length * (players.length - 1) * legCount) / 2} matches</b> ({players.length} players × {legCount} leg{legCount > 1 ? "s" : ""}){mode === "league" ? ", then the top 2 play a final." : ". Top of the table wins."}</>
                    )}
                  </span>
                </p>
              </div>
            )}

            <button onClick={handleGenerate} disabled={players.length < 2}
              className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide disabled:opacity-40 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: C.gold, color: C.ink }}>
              {matches.length > 0 ? "REGENERATE (CLEARS SCORES)" : mode === "knockout" ? "GENERATE BRACKET" : mode === "king" ? "START THE ARENA" : "GENERATE FIXTURES"}
            </button>
            {players.length < 2 && <p className="text-xs text-center" style={{ color: C.mute }}>Add at least 2 players to start</p>}
          </>
        )}

        {/* FIXTURES */}
        {tab === "fixtures" && (
          <>
            <ProgressBar value={playedCount} total={groupMatches.length} />
            <div className="flex gap-2">
              {[{ k: "all", l: "All" }, { k: "remaining", l: "Remaining" }, { k: "played", l: "Played" }].map((f) => (
                <button key={f.k} onClick={() => setFixtureFilter(f.k)} className="px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: fixtureFilter === f.k ? C.ink : "#EAE6D9", color: fixtureFilter === f.k ? "#F7F5EE" : C.ink }}>
                  {f.l}
                </button>
              ))}
            </div>
            {legs.length === 0 && <EmptyCard>No matches in this view.</EmptyCard>}
            {legs.map((leg) => (
              <div key={leg}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", color: C.pitch }}>LEG {leg}</span>
                  <div className="flex-1 border-t border-dashed" style={{ borderColor: "#C9C2AC" }} />
                </div>
                <div className="space-y-2.5">
                  {visibleMatches.filter((m) => m.leg === leg).map((m) => (
                    <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={addGoal} onUndoGoal={undoGoal} onTogglePlayed={togglePlayed} {...timerControls(m.id)} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* STANDINGS */}
        {tab === "standings" && (
          <>
            {rrChampion && <ChampionBanner name={rrChampion.name} subtitle={`${rrChampion.pts} pts · ${rrChampion.w}W ${rrChampion.d}D ${rrChampion.l}L`} />}
            <StandingsTable standings={standings} highlightTopN={mode === "league" ? 2 : 0} />
            {mode === "league" && standings.length >= 2 && (
              <button onClick={generateFinal} className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
                <Award size={16} /> {finalMatches.length ? "REGENERATE FINAL" : "SET UP FINAL (TOP 2)"}
              </button>
            )}
            {playedCount < groupMatches.length && (
              <p className="text-xs text-center" style={{ color: C.mute }}>
                {groupMatches.length - playedCount} match{groupMatches.length - playedCount === 1 ? "" : "es"} still to play — table updates live.
              </p>
            )}
          </>
        )}

        {/* FINAL */}
        {tab === "final" && (
          <>
            {leagueChampion && <ChampionBanner name={leagueChampion.name} subtitle={`Won the final ${leagueChampion.pts}–${finalStandings[1].pts} on points`} />}
            {finalMatches.length === 0 && <EmptyCard>No final set up yet — head to the Table tab and tap "Set up final".</EmptyCard>}
            {finalMatches.length > 0 && finalPlayedCount === finalMatches.length && !leagueChampion && finalStandings.length === 2 && (
              <div className="rounded-2xl p-4 text-sm text-center" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}`, color: C.sub }}>
                Final is level on points — play a decider to crown a champion.
              </div>
            )}
            <div className="space-y-2.5">
              {finalMatches.map((m) => (
                <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={addGoal} onUndoGoal={undoGoal} onTogglePlayed={togglePlayed} {...timerControls(m.id)} />
              ))}
            </div>
            {finalists.length === 2 && <StandingsTable standings={finalStandings} />}
          </>
        )}

        {/* BRACKET */}
        {tab === "bracket" && (
          <>
            {koChampion && <ChampionBanner name={koChampion.name} subtitle="Unbeaten through the bracket" />}
            {koRoundNums.map((rn) => (
              <div key={rn}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", color: C.pitch }}>{roundLabel(koRounds[rn].length)}</span>
                  <div className="flex-1 border-t border-dashed" style={{ borderColor: "#C9C2AC" }} />
                </div>
                <div className="space-y-2.5">
                  {koRounds[rn].map((m) => (
                    <MatchCard key={m.id} match={m} nameOf={nameOf} onAddGoal={addGoal} onUndoGoal={undoGoal} onTogglePlayed={togglePlayed} needsWinner {...timerControls(m.id)} />
                  ))}
                </div>
              </div>
            ))}
            {canAdvance && (
              <button onClick={advanceRound} className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
                <ChevronRight size={16} /> ADVANCE TO NEXT ROUND
              </button>
            )}
          </>
        )}

        {/* KING ARENA */}
        {tab === "arena" && (
          <>
            {kingChampion && <ChampionBanner name={kingChampion.name} subtitle={`${kingTarget} straight wins — crown taken`} />}

            {kingStreaks.currentId && !kingChampion && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FDF3D9" }}>
                  <Crown size={18} color={C.gold} fill={C.gold} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.mute }}>Current king</p>
                  <p className="font-bold truncate" style={{ color: C.ink }}>{nameOf(kingStreaks.currentId)}</p>
                  <div className="flex gap-1 mt-1.5">
                    {Array.from({ length: kingTarget }, (_, i) => (
                      <span key={i} className="h-1.5 w-6 rounded-full" style={{ backgroundColor: i < kingStreaks.run ? C.gold : C.line }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentKingMatch && !kingChampion && (
              <div>
                <SectionLabel>Match {currentKingMatch.seq}</SectionLabel>
                <MatchCard match={currentKingMatch} nameOf={nameOf} onAddGoal={addGoal} onUndoGoal={undoGoal} onTogglePlayed={togglePlayed}
                  homeTag="KING" awayTag="CHALLENGER" hideToggle {...timerControls(currentKingMatch.id)} />
                <button onClick={advanceKing}
                  className="w-full mt-2.5 py-3.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
                  <ChevronRight size={16} /> CONFIRM RESULT & NEXT UP
                </button>
                <p className="text-[10px] text-center mt-1.5" style={{ color: C.mute }}>A draw means the king keeps the pitch.</p>
              </div>
            )}

            {kingNeedsNext && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: "#fff", border: `2px solid ${C.gold}` }}>
                <p className="text-sm mb-3" style={{ color: C.sub }}>
                  Last match was closed without setting up the next one. Tap below to bring on the next challenger.
                </p>
                <button onClick={advanceKing}
                  className="w-full py-3 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
                  <ChevronRight size={16} /> NEXT MATCH
                </button>
              </div>
            )}

            {kingQueue.length > 0 && !kingChampion && (
              <div>
                <SectionLabel>Queue</SectionLabel>
                <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
                  {kingQueue.map((id, i) => (
                    <div key={id} className="flex items-center gap-2.5 px-4 py-2.5" style={{ backgroundColor: "#fff", borderBottom: i < kingQueue.length - 1 ? `1px solid #F0EDE2` : "none" }}>
                      <span className="text-xs font-bold w-4 flex-shrink-0" style={{ color: C.mute }}>{i + 1}</span>
                      <span className="font-semibold truncate" style={{ color: C.ink }}>{nameOf(id)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {kingMatches.filter((m) => m.played).length > 0 && (
              <div>
                <SectionLabel>Results</SectionLabel>
                <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
                  {kingMatches.filter((m) => m.played).sort((a, b) => b.seq - a.seq).map((m, i, arr) => (
                    <div key={m.id} className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: "#fff", borderBottom: i < arr.length - 1 ? `1px solid #F0EDE2` : "none" }}>
                      <span className="text-[10px] font-bold w-5 flex-shrink-0" style={{ color: C.mute }}>#{m.seq}</span>
                      <span className="flex-1 min-w-0 text-right text-sm font-semibold truncate" style={{ color: C.ink }}>{nameOf(m.p1)}</span>
                      <span className="px-2 py-0.5 rounded font-bold text-sm flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", backgroundColor: "#EAE6D9", color: C.ink }}>
                        {m.s1}–{m.s2}
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: C.ink }}>{nameOf(m.p2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* KING TABLE */}
        {tab === "kingtable" && (
          <>
            <StandingsTable standings={kingStandings} />
            <div>
              <SectionLabel>Best win streaks</SectionLabel>
              {Object.keys(kingStreaks.best).length === 0 ? (
                <EmptyCard>No matches confirmed yet.</EmptyCard>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${C.line}` }}>
                  {Object.entries(kingStreaks.best).sort((a, b) => b[1] - a[1]).map(([id, run], i, arr) => (
                    <div key={id} className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ backgroundColor: "#fff", borderBottom: i < arr.length - 1 ? `1px solid #F0EDE2` : "none" }}>
                      <span className="font-semibold truncate" style={{ color: C.ink }}>{nameOf(id)}</span>
                      <span className="flex items-center gap-1 flex-shrink-0 font-bold" style={{ color: C.pitch, fontFamily: "'JetBrains Mono', monospace" }}>
                        <Crown size={13} color={C.gold} fill={C.gold} /> {run}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* STATS */}
        {tab === "stats" && (
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
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <>
            {history.length === 0 ? (
              <EmptyCard>No completed tournaments yet — finish one and it'll be saved here automatically.</EmptyCard>
            ) : (
              <>
                <div className="flex justify-end">
                  <button onClick={clearHistory} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#FBE3DE", color: C.loss }}>
                    <Trash2 size={12} /> Clear all
                  </button>
                </div>
                <div className="space-y-2.5">
                  {history.map((h) => {
                    const meta = MODES.find((m) => m.key === h.mode);
                    return (
                      <div key={h.id} className="rounded-2xl p-4" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase" style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
                                {meta ? meta.label : h.mode}
                              </span>
                              <span className="text-[10px]" style={{ color: C.mute }}>{formatDate(h.date)}</span>
                            </div>
                            <p className="flex items-center gap-1.5" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.35rem", color: C.ink, lineHeight: 1.1 }}>
                              <Trophy size={15} color={C.gold} fill={C.gold} className="flex-shrink-0" />
                              <span className="truncate">{h.champion}</span>
                            </p>
                            <p className="text-xs mt-1.5 truncate" style={{ color: C.sub }}>{h.players.join(", ")}</p>
                            {h.topScorer && (
                              <p className="text-xs mt-1 truncate" style={{ color: C.sub }}>
                                Top scorer: <b style={{ color: C.ink }}>{h.topScorer.name}</b> ({h.topScorer.goals}) · {h.totalGoals} goals total
                              </p>
                            )}
                          </div>
                          <button onClick={() => deleteHistoryEntry(h.id)} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EAE6D9" }}>
                            <X size={13} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
