/* ---------- the chaos twist deck ----------
 * Shared by every mode that deals silly rules to matches (chaos, leaguechaos)
 * — it moved out of chaos.jsx the moment a second mode needed it, the same
 * way engine/bracket.js moved out of knockout.jsx.
 *
 * Twists are real-world rules for the players, never scoring rules for the
 * app — a twist must never change how a goal counts, or the generic standings
 * stop being valid for the modes that deal them.
 */
import { shuffle } from "./match.js";

export const TWISTS = [
  { key: "weak-foot", emoji: "🦶", label: "Weak foot only", detail: "Every shot has to come off your wrong foot." },
  { key: "one-touch", emoji: "🕐", label: "One touch", detail: "One touch to shoot — no dribbling at all." },
  { key: "sitting-keeper", emoji: "🧎", label: "Sitting keeper", detail: "Keepers must stay sat on the ground." },
  { key: "silent", emoji: "🤫", label: "Silent match", detail: "Talk or celebrate out loud and the goal doesn't count." },
  { key: "slow-mo", emoji: "🐢", label: "Slow-mo celebrations", detail: "Every goal gets a slow-motion replay celebration." },
  { key: "swap-ends", emoji: "🔁", label: "Swap ends", detail: "Attack the other goal after every goal scored." },
  { key: "long-range", emoji: "🎯", label: "Long range only", detail: "Goals only count from outside the box or past the cone line." },
  { key: "hop-start", emoji: "🐸", label: "Hop start", detail: "Restart hopping on one leg until you touch the ball." },
  { key: "no-looking", emoji: "🙈", label: "No looking", detail: "The taker looks away as they shoot — the keeper picks when." },
  { key: "commentator", emoji: "👑", label: "Commentator match", detail: "Commentate your own play, in the third person." },
];

export const twistOf = (key) => TWISTS.find((t) => t.key === key) ?? null;

/* Deal without repeats until the deck runs dry, then reshuffle — so a
   tournament of ten or fewer matches never sees the same twist twice. */
export function dealTwists(count, rng = Math.random) {
  const dealt = [];
  let deck = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) deck = shuffle(TWISTS, rng);
    dealt.push(deck.shift().key);
  }
  return dealt;
}
