/* ---------- audio ---------- */

let sharedAudioCtx = null;

function getAudioContext() {
  if (!sharedAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch { /* no audio */ }
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

export function playBeep() {
  try {
    unlockAudio();
    [0, 0.22, 0.44].forEach((o) => tone(880, "square", o, 0.18, 0.15));
  } catch { /* no audio */ }
}

/* One tick per second through the final ten. Kept to a single short tone so
   ten of them in a row read as a countdown rather than as ten alarms, and
   pitched well above the goal chime so the two are never confused. */
export function playCountdownTick() {
  try {
    unlockAudio();
    tone(1200, "square", 0, 0.15, 0.25);
  } catch { /* no audio */ }
}

export function playGoalChime() {
  try {
    unlockAudio();
    tone(659, "triangle", 0, 0.12, 0.1);
    tone(988, "triangle", 0.1, 0.16, 0.1);
  } catch { /* no audio */ }
}
