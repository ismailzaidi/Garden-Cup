import { useEffect, useRef, useState } from "react";
import { unlockAudio, playBeep, playCountdownTick } from "./audio.js";

const DEFAULT_DURATION = 180;

export function useTimers() {
  const [timers, setTimers] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const beepedRef = useRef({});
  // The last second each timer ticked for, not a played/not-played flag: the
  // final ten seconds each get their own tick, and keying the guard on the
  // second itself makes a repeated callback for the same second a no-op.
  const lastTickRef = useRef({});

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
          } else if (remaining <= 10 && lastTickRef.current[id] !== remaining) {
            lastTickRef.current[id] = remaining;
            playCountdownTick(remaining);
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTimer = (id) => timers[id] || { duration: DEFAULT_DURATION, remaining: DEFAULT_DURATION, running: false, endTime: null };

  const displayTimer = (id) => {
    const t = getTimer(id);
    return t.running ? { ...t, remaining: Math.max(0, Math.ceil((t.endTime - now) / 1000)) } : t;
  };

  const startTimer = (id) => {
    unlockAudio();
    beepedRef.current[id] = false; lastTickRef.current[id] = null;
    setTimers((prev) => {
      const t = prev[id] || { duration: DEFAULT_DURATION, remaining: DEFAULT_DURATION };
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
    beepedRef.current[id] = false; lastTickRef.current[id] = null;
    setTimers((prev) => {
      const t = prev[id] || { duration: DEFAULT_DURATION };
      return { ...prev, [id]: { duration: t.duration, remaining: t.duration, running: false, endTime: null } };
    });
  };

  const setTimerDuration = (id, secs) => {
    beepedRef.current[id] = false; lastTickRef.current[id] = null;
    setTimers((prev) => ({ ...prev, [id]: { duration: secs, remaining: secs, running: false, endTime: null } }));
  };

  const timerControls = (id) => ({
    timer: displayTimer(id),
    onStart: () => startTimer(id),
    onPause: () => pauseTimer(id),
    onReset: () => resetTimer(id),
    onSetDuration: (s) => setTimerDuration(id, s),
  });

  const clearTimers = () => {
    setTimers({});
    beepedRef.current = {};
    lastTickRef.current = {};
  };

  return { timerControls, displayTimer, clearTimers };
}
