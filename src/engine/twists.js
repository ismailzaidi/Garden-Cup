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
  // ── Foot & surface focus ──
  { key: "weak-foot", emoji: "🦶", label: "Weak foot only", detail: "Every touch and every shot comes off your weaker foot." },
  { key: "weak-foot-double", emoji: "✌️", label: "Weak foot bonus", detail: "Goals from your weaker foot count double. Strong foot goals count one." },
  { key: "both-feet", emoji: "🦿", label: "Both feet", detail: "Score once with each foot. Two goals from the same foot don't count as a pair." },
  { key: "left-right", emoji: "🔁", label: "Left-right-left", detail: "Alternate feet on every touch. Two in a row from the same foot and you lose it." },
  { key: "laces", emoji: "👟", label: "Laces only", detail: "Every shot must be struck with your laces. Side-foot goals don't count." },
  { key: "side-foot", emoji: "🎯", label: "Side-foot finish", detail: "Every shot is an inside-of-the-foot placement. Pick your spot and pass it in." },
  { key: "outside-boot", emoji: "🌶️", label: "Outside boot", detail: "Shots and passes must use the outside of your boot." },
  { key: "sole-only", emoji: "🧽", label: "Sole control", detail: "Dribble using the sole of your foot only, then shoot however you like." },

  // ── Touch & close control ──
  { key: "one-touch", emoji: "🕐", label: "One touch", detail: "One touch to shoot. No dribbling at all." },
  { key: "two-touch", emoji: "✋", label: "Two touch", detail: "Two touches maximum: one to control, one to shoot." },
  { key: "warm-up-dribble", emoji: "🍯", label: "Warm-up dribble", detail: "Take at least five touches before you're allowed to shoot." },
  { key: "ant", emoji: "🐜", label: "Ant steps", detail: "Tiny touches only, never more than a foot-length. Push it too far and lose the ball." },
  { key: "count-touches", emoji: "🔢", label: "Count your touches", detail: "Count every touch out loud. Lose count and it's your opponent's ball." },
  { key: "walking", emoji: "🚶", label: "Walking football", detail: "No running, ever. Get caught running and it's your opponent's ball." },
  { key: "slow-motion-match", emoji: "🎞️", label: "Slow-motion match", detail: "Everything in slow-mo: running, tackling, shooting. Go full speed and turn it over." },
  { key: "keepy-start", emoji: "🤹", label: "Keepy-up start", detail: "Three keepy-ups before every kick-off. Drop it and your opponent starts." },
  { key: "juggle-shoot", emoji: "🎪", label: "Juggle to score", detail: "Two keepy-ups, then shoot without letting it drop." },
  { key: "toss-volley", emoji: "🌪️", label: "Toss and volley", detail: "Drop-feed the ball to yourself and strike it out of the air. Only volleys count." },

  // ── Skills & moves ──
  { key: "trick-first", emoji: "🎨", label: "Trick to score", detail: "Pull off a skill before you shoot: stepover, drag-back, anything. No skill, no goal." },
  { key: "turn-to-score", emoji: "🌀", label: "Turn to score", detail: "Do a turn (Cruyff, drag-back, inside hook) before every shot." },
  { key: "back-to-goal", emoji: "🔄", label: "Back to goal", detail: "Start with your back to goal, then turn and shoot." },
  { key: "nutmeg", emoji: "🥜", label: "Nutmeg bonus", detail: "Nutmeg your opponent and you get a free shot at an undefended goal." },
  { key: "heel-flick", emoji: "👠", label: "Heel flicks", detail: "Only back-heel shots count. Everything else is just practice." },
  { key: "give-and-go", emoji: "🎁", label: "Give and go", detail: "Before shooting, pass to your opponent. They must pass it straight back." },
  { key: "left-right-pass", emoji: "📮", label: "Pass to score", detail: "Play a wall pass off the fence or wall before you can shoot." },
  { key: "bank-shot", emoji: "🎱", label: "Bank shot", detail: "The ball must bounce off a wall or fence before going in." },

  // ── Finishing types ──
  { key: "worm-burner", emoji: "🐛", label: "Worm burners", detail: "Ground shots only. If the ball leaves the floor, no goal." },
  { key: "rainbow", emoji: "🌈", label: "Rainbow shots", detail: "The ball must go above waist height before it crosses the line." },
  { key: "spoon-chip", emoji: "🥄", label: "Spoon chips", detail: "Only chipped shots, scooped under the ball, count." },
  { key: "curl-it", emoji: "🌀", label: "Curl it", detail: "Shots must curve. Set up wide and bend it in." },
  { key: "volley", emoji: "🌩️", label: "Volley or bust", detail: "The ball must be in the air when you strike it, or the goal doesn't count." },
  { key: "bounce-goal", emoji: "🏀", label: "Bounce goal", detail: "The ball has to bounce once before crossing the line." },
  { key: "big-head", emoji: "🧠", label: "Big head", detail: "Headers are worth double. Everything else is worth one." },
  { key: "call-your-corner", emoji: "📣", label: "Call your corner", detail: "Shout which corner you're aiming for before you shoot. Wrong corner, no goal." },
  { key: "long-range", emoji: "🚀", label: "Long range only", detail: "Goals only count when shot from at least ten big steps away." },
  { key: "penalty-duel", emoji: "⚔️", label: "Penalty duel", detail: "Only penalties, taken in turn. First to five wins." },

  // ── Decision-making & awareness ──
  { key: "shot-clock", emoji: "⏰", label: "Shot clock", detail: "Shoot within ten seconds of winning the ball, or hand it over." },
  { key: "dice-roll", emoji: "🎲", label: "Dice roll", detail: "Roll a dice each time you win the ball. That's how many touches you get before you must shoot." },
  { key: "finger-count", emoji: "🖐️", label: "Head-up fingers", detail: "While you dribble, your opponent holds up fingers behind you. Call the number before you shoot or the goal doesn't count." },
  { key: "traffic-lights", emoji: "🚦", label: "Traffic lights", detail: "Before each shot the keeper calls red, amber or green. Red is pass first, amber is weak foot, green is free choice." },
  { key: "coin-flip", emoji: "🪙", label: "Coin flip chaos", detail: "Flip a coin before each kick-off. Heads is normal, tails is weak foot only." },
  { key: "losers-choice", emoji: "🎡", label: "Loser's choice", detail: "The player who just conceded picks a mini-twist for the next point." },
  { key: "double-trouble", emoji: "⚽", label: "Double trouble", detail: "Two balls in play at once. Goals count from either." },

  // ── Keeper challenges ──
  { key: "sitting-keeper", emoji: "🧎", label: "Sitting keeper", detail: "Keepers must stay sat on the ground." },
  { key: "statue-keeper", emoji: "🗿", label: "Statue keeper", detail: "Guarding your goal? Feet stay planted. Arms and body only." },
  { key: "flamingo-keeper", emoji: "🦩", label: "Flamingo keeper", detail: "Keepers stand on one leg. Put the other foot down and it's a goal." },
  { key: "one-arm-keeper", emoji: "🧤", label: "One-arm keeper", detail: "Keepers keep one hand behind their back at all times." },
  { key: "swap-keeper", emoji: "🔀", label: "Keeper swap", detail: "After every save, the keeper and the shooter swap roles." },
  { key: "keepers-glory", emoji: "👑", label: "Keeper's glory", detail: "Goals scored by the keeper's kick from their own area count double." },
  { key: "keeper-picks", emoji: "🧐", label: "Keeper's call", detail: "The keeper picks which foot the shooter must use before every shot." },

  // ── Score & rule twists ──
  { key: "double-nothing", emoji: "💸", label: "Double or nothing", detail: "Call \"DOUBLE\" before a shot. Score and it's two goals; miss and you lose a point." },
  { key: "jackpot", emoji: "🎰", label: "Jackpot", detail: "Every third goal in the match is worth triple." },
  { key: "comeback", emoji: "🔥", label: "Comeback kid", detail: "Whoever is losing scores double. Leaders only get single goals." },
  { key: "golden-boot", emoji: "🥇", label: "Golden boot", detail: "Once per match, call it and your next goal counts double." },
  { key: "hat-trick", emoji: "🏆", label: "Hat-trick hero", detail: "Score three in a row and you win instantly." },
  { key: "sudden-death", emoji: "💀", label: "Sudden death", detail: "Next goal wins the whole match." },
  { key: "swap-ends", emoji: "🔃", label: "Swap ends", detail: "Attack the other goal after every goal scored." },
  { key: "rewind", emoji: "⏪", label: "Rewind", detail: "Once each, shout REWIND to undo the last goal and replay the restart." },
  { key: "var", emoji: "📺", label: "VAR check", detail: "Once each, challenge a goal. Settle it with rock-paper-scissors." },
  { key: "freeze", emoji: "🧊", label: "Freeze!", detail: "One FREEZE each per match. Shout it and your opponent stands still for three seconds." },
  { key: "fence-run", emoji: "🏃", label: "Fence run", detail: "After every goal, both players run and touch the far end of the garden before play restarts." },

  // ── Fun & personality ──
  { key: "commentator", emoji: "🎙️", label: "Commentator match", detail: "Commentate your own play, in the third person." },
  { key: "dance-restart", emoji: "🕺", label: "Dance restart", detail: "The scorer picks a dance and both players do it before the next kick-off." },
  { key: "good-sport", emoji: "🏅", label: "Good sport", detail: "After every goal, the loser must give the scorer a ridiculous compliment." },
  { key: "posh-voice", emoji: "🎩", label: "Posh match", detail: "Poshest voice only. \"I say, splendid tackle.\"" },
  { key: "opposite-day", emoji: "🙃", label: "Opposite day", detail: "Say the opposite of what you mean all match: \"terrible goal!\"" },
  { key: "lucky-ritual", emoji: "🍀", label: "Lucky ritual", detail: "Invent a lucky ritual and do it before every shot. Forget it and the shot is void." },
  { key: "accessory-stack", emoji: "🧣", label: "Accessory stack", detail: "Every time you score, add a silly item to wear: scarf, sock on hand, hat." },
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
