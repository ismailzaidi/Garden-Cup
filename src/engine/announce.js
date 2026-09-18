/* ---------- the result, spoken when a match is marked played ----------
 * resultSentence is pure text — kept separate from the speech engine so it
 * can be tested with plain string assertions and no browser at all.
 * speakResult is the guarded side effect that turns that text into sound,
 * on the browser's own speechSynthesis engine (never the oscillator voice
 * in audio.js — turning arbitrary typed-in names into speech needs a real
 * text-to-speech engine, which is a different mechanism from the countdown).
 */
import { getVoicePref, playResultCue } from "./audio.js";

// Winner-first would be one line here — {loser} and {winner} are the only
// two things this template ever touches.
const RESULT_TEMPLATE = "{loser} lost, {winner} won";

/* null means "not a result": a bye, or a match missing either player (by
   id, or because nameOf can't resolve one). A draw is still a result, so it
   returns a sentence — just never a winner, because the card on screen may
   still be waiting on penalties or another leg.
   Deliberately does not look at match.played: useTournament's togglePlayed
   calls this with the pre-toggle match, at the instant it's about to flip
   false -> true, so played is still false on the object passed in here.
   Whether this is a real result is the caller's call, not this one's. */
export function resultSentence(match, nameOf) {
  if (!match || match.bye) return null;
  if (!match.p1 || !match.p2) return null;

  const s1 = Number(match.s1 || 0);
  const s2 = Number(match.s2 || 0);
  if (s1 === s2) return "All square";

  const winnerId = s1 > s2 ? match.p1 : match.p2;
  const loserId = s1 > s2 ? match.p2 : match.p1;
  const winner = nameOf(winnerId);
  const loser = nameOf(loserId);
  if (!winner || !loser) return null;

  return RESULT_TEMPLATE.replace("{loser}", loser).replace("{winner}", winner);
}

/* getVoices() commonly returns [] until the async "voiceschanged" event
   fires once — a call caught in that window can't confirm a local voice
   exists. Rather than gamble on the engine's default (which may be a
   network voice) or wait and miss the tap, it takes the safe option (the
   motif) for that one call; the listener below means only the first call
   or two ever pay that cost, after which the real voice list is cached. */
let cachedVoices = [];
let listenerAttached = false;

function localVoiceFor(synth) {
  const fresh = typeof synth.getVoices === "function" ? synth.getVoices() : [];
  if (fresh && fresh.length) cachedVoices = fresh;
  if (!listenerAttached && typeof synth.addEventListener === "function") {
    listenerAttached = true;
    synth.addEventListener("voiceschanged", () => {
      cachedVoices = typeof synth.getVoices === "function" ? synth.getVoices() : [];
    });
  }
  const local = cachedVoices.filter((v) => v.localService === true);
  if (!local.length) return null;
  // Kids' names, not kids' privacy — a local voice never sends the
  // sentence off the device. Prefer one matching the page's language when
  // there's a choice, but any local voice beats a network one.
  const lang = (typeof document !== "undefined" && document.documentElement.lang) || "";
  const shortLang = lang.slice(0, 2).toLowerCase();
  return (shortLang && local.find((v) => v.lang && v.lang.slice(0, 2).toLowerCase() === shortLang)) || local[0];
}

/* Speaks `sentence` through a local voice, or plays the two-note motif
   instead when there's no sentence, the voice preference is off, there's
   no local voice, or speechSynthesis doesn't exist at all. Never throws. */
export function speakResult(sentence) {
  if (!sentence) return;
  const won = sentence !== "All square";
  try {
    if (getVoicePref()) {
      const synth = window.speechSynthesis;
      const Utterance = window.SpeechSynthesisUtterance;
      if (synth && Utterance) {
        const voice = localVoiceFor(synth);
        if (voice) {
          synth.cancel(); // marking three matches quickly shouldn't queue three sentences deep
          const utterance = new Utterance(sentence);
          utterance.rate = 1.05;
          utterance.voice = voice;
          synth.speak(utterance);
          return;
        }
      }
    }
  } catch { /* fall through to the motif below */ }
  playResultCue(won);
}
