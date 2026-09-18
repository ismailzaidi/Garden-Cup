import { useEffect, useRef, useState } from "react";
import { unlockAudio, playBeep, playCountdownTick, playPauseReminder, cancelSpeech } from "./audio.js";

const DEFAULT_DURATION = 180;

// One line to retune how often the "Game paused" reminder repeats.
const PAUSE_REMINDER_INTERVAL_MS = 2000;

export function useTimers() {
  const [timers, setTimers] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const beepedRef = useRef({});
  // The last second each timer ticked for, not a played/not-played flag: the
  // final ten seconds each get their own tick, and keying the guard on the
  // second itself makes a repeated callback for the same second a no-op.
  const lastTickRef = useRef({});
  // id -> interval id, present only while that timer's "Game paused"
  // reminder is repeating. Presence of the key is the source of truth for
  // "currently reminding", so stopping a reminder that isn't running is a
  // harmless no-op.
  const pauseAnnounceRef = useRef({});

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

  // Stops one timer's "Game paused" repeat and cancels whatever it most
  // recently said, if it was reminding at all. Called on every way out of
  // "paused" — resume, reset, a new duration — so none of them can leave
  // the reminder talking past the moment it stopped making sense. Only
  // cancels speech when this timer actually had a reminder running, so
  // starting or resetting a timer that was never paused can't cut off an
  // unrelated utterance (the result speech, say) that happens to be
  // playing at the same moment.
  const stopPauseAnnounce = (id) => {
    const intervalId = pauseAnnounceRef.current[id];
    if (intervalId == null) return;
    clearInterval(intervalId);
    delete pauseAnnounceRef.current[id];
    cancelSpeech();
  };

  const startTimer = (id) => {
    unlockAudio();
    stopPauseAnnounce(id);
    beepedRef.current[id] = false; lastTickRef.current[id] = null;
    setTimers((prev) => {
      const t = prev[id] || { duration: DEFAULT_DURATION, remaining: DEFAULT_DURATION };
      const remaining = t.remaining ?? t.duration;
      return { ...prev, [id]: { ...t, running: true, endTime: Date.now() + remaining * 1000 } };
    });
  };

  // The side effect (announcing, and starting the repeat) stays outside the
  // setTimers updater — same reasoning as useTournament's togglePlayed:
  // React may invoke an updater more than once, and a repeating interval
  // must not be started twice for a single pause.
  const pauseTimer = (id) => {
    const t = timers[id];
    if (!t || !t.running) return; // never running: nothing to pause, nothing to announce
    playPauseReminder();
    pauseAnnounceRef.current[id] = setInterval(playPauseReminder, PAUSE_REMINDER_INTERVAL_MS);
    setTimers((prev) => {
      const cur = prev[id];
      if (!cur || !cur.running) return prev;
      return { ...prev, [id]: { ...cur, running: false, remaining: Math.max(0, Math.ceil((cur.endTime - Date.now()) / 1000)), endTime: null } };
    });
  };

  const resetTimer = (id) => {
    stopPauseAnnounce(id);
    beepedRef.current[id] = false; lastTickRef.current[id] = null;
    setTimers((prev) => {
      const t = prev[id] || { duration: DEFAULT_DURATION };
      return { ...prev, [id]: { duration: t.duration, remaining: t.duration, running: false, endTime: null } };
    });
  };

  const setTimerDuration = (id, secs) => {
    stopPauseAnnounce(id);
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
    Object.keys(pauseAnnounceRef.current).forEach(stopPauseAnnounce);
    setTimers({});
    beepedRef.current = {};
    lastTickRef.current = {};
  };

  return { timerControls, displayTimer, clearTimers };
}
