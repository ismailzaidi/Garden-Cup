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

/* ---------- the shared speech primitive ----------
 * The countdown's numbers, the paused-game reminder, and (via announce.js)
 * the spoken result all go through this one function and this one voice
 * selection, so there is exactly one place that decides "is there a voice
 * we can safely use" — none of the callers duplicate that logic, and none
 * of them can drift out of step with each other on what counts as safe.
 *
 * Local voices only. The original reason was privacy: player and match
 * names are typed in by a family and should never leave the device just to
 * be read aloud. That reason still holds, and there is now a second one —
 * this app is built to keep working with no network at all, and a
 * network-backed voice would simply fail offline. A local voice is the
 * only kind that satisfies both.
 *
 * getVoices() commonly returns [] until the async "voiceschanged" event
 * fires once — a call caught in that window can't confirm a local voice
 * exists. Rather than gamble on the engine's default (which may be a
 * network voice) or wait and miss the moment, it takes the silent option
 * for that one call; the listener below means only the first call or two
 * ever pay that cost, after which the real voice list is cached.
 */
let cachedVoices = [];
let voicesListenerAttached = false;

function localVoice() {
  const synth = window.speechSynthesis;
  const fresh = typeof synth.getVoices === "function" ? synth.getVoices() : [];
  if (fresh && fresh.length) cachedVoices = fresh;
  if (!voicesListenerAttached && typeof synth.addEventListener === "function") {
    voicesListenerAttached = true;
    synth.addEventListener("voiceschanged", () => {
      cachedVoices = typeof synth.getVoices === "function" ? synth.getVoices() : [];
    });
  }
  const local = cachedVoices.filter((v) => v.localService === true);
  if (!local.length) return null;
  // Prefer a voice matching the page's language when there's a choice, but
  // any local voice beats a network one.
  const lang = (typeof document !== "undefined" && document.documentElement.lang) || "";
  const shortLang = lang.slice(0, 2).toLowerCase();
  return (shortLang && local.find((v) => v.lang && v.lang.slice(0, 2).toLowerCase() === shortLang)) || local[0];
}

/* Speaks `text` through a confirmed local voice and reports whether it did,
   so callers decide what — if anything — stands in for it: the countdown
   falls back to a beep, the paused-game reminder falls back to silence, and
   the result (announce.js) falls back to its two-note motif. Never throws.

   Cancels whatever the engine is presently saying before speaking again,
   every single time, with no exception for who owns the outgoing
   utterance — the countdown speaks once a second and the paused-game
   reminder repeats every couple of seconds, and either one queuing up
   behind an unrelated utterance would be worse than cutting it off. */
export function speak(text, rate = 1) {
  if (!text) return false;
  try {
    if (!getVoicePref()) return false;
    const synth = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;
    if (!synth || !Utterance) return false;
    const voice = localVoice();
    if (!voice) return false;
    synth.cancel();
    const utterance = new Utterance(text);
    utterance.rate = rate;
    utterance.voice = voice;
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/* Stops whatever the engine is presently saying, without starting anything
   new. Used when a paused timer resumes, resets, or changes duration: the
   reminder's own repeat has already stopped by then, but the sentence it
   most recently started can still be mid-utterance, and it must not be
   left talking past the moment the reason for it went away. */
export function cancelSpeech() {
  try {
    window.speechSynthesis && window.speechSynthesis.cancel();
  } catch { /* no speech engine */ }
}

// Ten words, known in advance, spoken through the same local voice as the
// paused-game reminder and the spoken result — see speak() above. This used
// to be synthesised from an OscillatorNode instead; one voice engine for
// every spoken thing in the app reads better than two.
const NUMBER_NAMES = {
  10: "ten", 9: "nine", 8: "eight", 7: "seven", 6: "six",
  5: "five", 4: "four", 3: "three", 2: "two", 1: "one",
};

/* One announcement per second through the final ten: the second's number,
   spoken aloud, or the existing 1200 Hz beep as a fallback — when the
   voice preference is off, there's no confirmed local voice, or speech
   isn't available at all. Called once per second with the second being
   announced; never schedules more than one number, so pausing a timer
   can't leave a queued sequence behind. */
export function playCountdownTick(remaining) {
  const word = NUMBER_NAMES[remaining];
  if (word && speak(word)) return;
  try {
    unlockAudio();
    const ctx = getAudioContext();
    if (ctx.state !== "running") return; // schedule nothing at all unless running
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

/* Says "Game paused" through the speak() primitive above, repeated by
   useTimers every couple of seconds for as long as a timer stays paused —
   players kept asking whether the game was paused, so one announcement on
   its own wasn't enough. Deliberately has no beep fallback: when there's
   nothing to speak with, silence is the honest answer, not an unexplained
   noise standing in for a sentence nobody can hear. */
export function playPauseReminder() {
  speak("Game paused");
}

/* ---------- the voice preference ----------
 * One key, device-local on purpose: whether *this browser* should talk is a
 * property of the device, not the tournament, so it deliberately sits
 * outside the players/matches/goals state that exportData ships and that
 * cloud sync carries between devices. Stored "0" means off; absence means
 * on, so a fresh install (and everyone who doesn't touch the toggle) gets
 * the countdown voice and the result announcement without doing anything.
 * Gates the countdown, the paused-game reminder, and the spoken result
 * alike.
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

/* Lets whoever just switched the voice on hear a sample of the same voice
   used for the countdown, the paused-game reminder, and the spoken result.
   Silent rather than beeping if there's nothing to speak with — a demo that
   played the wrong sound would be more confusing than one that plays
   nothing. */
export function speakVoiceSample() {
  speak(NUMBER_NAMES[7]);
}
