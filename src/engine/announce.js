/* ---------- the result, spoken when a match is marked played ----------
 * resultSentence is pure text — kept separate from the speech engine so it
 * can be tested with plain string assertions and no browser at all.
 * speakResult is the guarded side effect that turns that text into sound,
 * through the same local-voice speech primitive as the countdown and the
 * paused-game reminder (see speak() in audio.js) — turning arbitrary
 * typed-in names into speech needs a real text-to-speech engine, and
 * audio.js is where local-voice selection and the speak() call live for
 * all three features, rather than each rolling its own.
 */
import { speak, playResultCue } from "./audio.js";

// Winner-first would be one line here — {loser} and {winner} are the only
// two things this template ever touches.
const RESULT_TEMPLATE = "{loser} lost HAHAHAHAHA, {winner} won, THE CROWD GOES WILD, YOU ARE THE CHAMPION";

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

/* Speaks `sentence` through a local voice, or plays the two-note motif
   instead when speak() reports it couldn't: no sentence, the voice
   preference off, no confirmed local voice, or no speech engine at all.
   Never throws — speak() already guards its own failures. */
export function speakResult(sentence) {
  if (!sentence) return;
  const won = sentence !== "All square";
  if (speak(sentence, 1.05)) return;
  playResultCue(won);
}
