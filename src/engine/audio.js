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

/* Fallback for announce.js's speakResult when there's no usable local
   voice: says *that* something happened without saying who — two notes
   rising for a decisive result, falling for a draw, so the ear still gets
   a decided/undecided cue even with speech unavailable or switched off. */
export function playResultCue(won) {
  try {
    unlockAudio();
    if (won) {
      tone(523, "triangle", 0, 0.14, 0.12);
      tone(784, "triangle", 0.12, 0.18, 0.12);
    } else {
      tone(784, "triangle", 0, 0.14, 0.12);
      tone(523, "triangle", 0.12, 0.18, 0.12);
    }
  } catch { /* no audio */ }
}

/* ---------- the voice preference ----------
 * One key, device-local on purpose: whether *this browser* should talk is a
 * property of the device, not the tournament, so it deliberately sits
 * outside the players/matches/goals state that exportData ships and that
 * cloud sync carries between devices. Stored "0" means off; absence means
 * on, so a fresh install (and everyone who doesn't touch the toggle) gets
 * the countdown voice and the result announcement without doing anything.
 * Gates 5B's result speech now, and will gate 5A's countdown voice too.
 */
const VOICE_PREF_KEY = "gardenCup:voice";

export function getVoicePref() {
  try {
    return localStorage.getItem(VOICE_PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setVoicePref(on) {
  try {
    localStorage.setItem(VOICE_PREF_KEY, on ? "1" : "0");
  } catch { /* no storage */ }
}
