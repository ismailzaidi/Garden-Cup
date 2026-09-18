/* ---------- the chaos twist deck ----------
 * Shared by every mode that deals silly rules to matches (chaos, leaguechaos)
 * — it moved out of chaos.jsx the moment a second mode needed it, the same
 * way engine/bracket.js moved out of knockout.jsx.
 *
 * Twists are real-world rules for the players, never scoring rules for the
 * app — a twist must never change how a goal counts, or the generic standings
 * stop being valid for the modes that deal them.
 *
 * Append only; never rename or remove a key. `m.twist` stores a twist's key
 * on every chaos match in localStorage (and in cloud saves), and `twistOf`
 * returns null for an unknown key — renaming or deleting one silently makes
 * the banner vanish from every saved tournament that dealt it. New twists
 * always go on the end; array order doesn't matter to dealing since the deck
 * is shuffled.
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
  { key: "trex-arms", emoji: "🦖", label: "T-rex arms", detail: "Elbows pinned to your sides all match. Tiny arms only." },
  { key: "walking", emoji: "🚶", label: "Walking football", detail: "No running, ever. Get caught running and it's your opponent's ball." },
  { key: "penguin", emoji: "🐧", label: "Penguin feet", detail: "Heels together, waddle everywhere." },
  { key: "spin-start", emoji: "🌀", label: "Dizzy kick-off", detail: "Spin round three times before every kick-off." },
  { key: "freeze", emoji: "🧊", label: "Freeze!", detail: "One FREEZE each per match — shout it and your opponent stands still for three seconds." },
  { key: "fence-run", emoji: "🏃", label: "Fence run", detail: "After every goal, both players run and touch the far end of the garden before play restarts." },
  { key: "statue-keeper", emoji: "🗿", label: "Statue keeper", detail: "Guarding your goal? Feet stay planted — arms and body only." },
  { key: "toe-poke", emoji: "👟", label: "Toe pokes only", detail: "Every shot is a toe poke. No laces, no side-foot." },
  { key: "trick-first", emoji: "🎨", label: "Trick to score", detail: "Pull off a skill before you shoot — stepover, drag-back, anything — or the goal doesn't count." },
  { key: "call-your-corner", emoji: "📣", label: "Call your corner", detail: "Shout which corner you're aiming for before you shoot. Wrong corner, no goal." },
  { key: "shot-clock", emoji: "⏰", label: "Shot clock", detail: "Shoot within ten seconds of winning the ball, or hand it over." },
  { key: "tiny-goals", emoji: "🥅", label: "Tiny goals", detail: "A cone in each goal halves it — both ends, all match." },
  { key: "quiz-goal", emoji: "🧮", label: "Quiz goal", detail: "Before a goal counts, answer a quiz question from your opponent. Get it wrong and play on." },
  { key: "sound-effects", emoji: "🎺", label: "Sound effects", detail: "Make your own sound effect for every kick, save and goal." },
  { key: "opposite-day", emoji: "🙃", label: "Opposite day", detail: "Say the opposite of what you mean all match: \"terrible goal!\"" },
  { key: "posh-voice", emoji: "🎩", label: "Posh match", detail: "Poshest voice only. \"I say, splendid tackle.\"" },
  { key: "superhero", emoji: "🦸", label: "Superhero names", detail: "Pick a superhero name each and answer to nothing else." },
  { key: "count-touches", emoji: "🔢", label: "Count your touches", detail: "Count every touch out loud. Lose count and it's your opponent's ball." },
  { key: "singing", emoji: "🎤", label: "Singing dribbler", detail: "Sing while you have the ball. Stop singing and you lose it." },
  { key: "dance-restart", emoji: "🕺", label: "Dance restart", detail: "The scorer picks a dance and both players do it before the next kick-off." },
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
