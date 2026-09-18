/* ---------- audio ---------- */

import { speakWord, WORDS } from "./voice.js";

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
    // Resume on anything other than "running" — not just "suspended". iOS
    // has a non-standard "interrupted" state after a phone call, and a
    // locked/backgrounded tab can land somewhere else again; all of them
    // need the same nudge.
    if (ctx.state !== "running") ctx.resume().catch(() => {});
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

// Two timers in their final ten would otherwise both start a word in the
// same setInterval callback, which is mush rather than "talking over each
// other". This timestamp makes the second timer fall back to the beep;
// it's a module singleton, same as sharedAudioCtx above.
let speakingUntil = 0;

/* One announcement per second through the final ten: the second's word
   ("ten" down to "one"), synthesised by voice.js, or the existing 1200 Hz
   beep as a fallback — when the voice preference is off, `remaining` is
   outside 1-10, or another timer is already mid-word. Called once per
   second with the second being announced; never schedules more than one
   number, so pausing a timer can't leave a queued sequence behind. */
export function playCountdownTick(remaining) {
  try {
    unlockAudio();
    const ctx = getAudioContext();
    if (ctx.state !== "running") return; // schedule nothing at all unless running
    if (!getVoicePref() || !WORDS[remaining] || speakingUntil > ctx.currentTime) {
      tone(1200, "square", 0, 0.15, 0.25);
      return;
    }
    speakingUntil = speakWord(ctx, WORDS[remaining], ctx.currentTime + 0.03);
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
 * Gates 5B's result speech and 5A's countdown voice alike.
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

/* Turning the voice on is itself a user gesture — the one thing iOS wants
   in order to unlock audio — so the toggle speaks a sample word through
   the same countdown voice, letting whoever just switched it on hear what
   it sounds like. Same guards as playCountdownTick, minus the beep
   fallback: if there's nothing to speak with, this is silent rather than
   ticking once for no reason. */
export function speakVoiceSample() {
  try {
    unlockAudio();
    const ctx = getAudioContext();
    if (ctx.state !== "running") return;
    speakingUntil = speakWord(ctx, WORDS[7], ctx.currentTime + 0.03);
  } catch { /* no audio */ }
}
