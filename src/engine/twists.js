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

  // ── Movement madness ──
  { key: "crab-walk", emoji: "🦀", label: "Crab walk", detail: "Sideways shuffles only. Step forwards or backwards and it's a foul." },
  { key: "kangaroo", emoji: "🦘", label: "Kangaroo", detail: "Feet together, bounce everywhere. No normal steps allowed." },
  { key: "zombie", emoji: "🧟", label: "Zombie match", detail: "Arms out front, stiff legs, groan every time you touch the ball." },
  { key: "robot", emoji: "🤖", label: "Robot mode", detail: "Move and talk like a robot. Bend a knee normally and you power down for three seconds." },
  { key: "ballerina", emoji: "🩰", label: "Ballerina", detail: "Tiptoes all match. Heels touch the ground and it's a free ball." },
  { key: "moonwalk", emoji: "🔙", label: "Moonwalk", detail: "Move backwards only. Turn round and it's your opponent's ball." },
  { key: "ice-skater", emoji: "⛸️", label: "Ice skater", detail: "Feet never leave the ground. Slide and shuffle everywhere." },
  { key: "gorilla", emoji: "🦍", label: "Gorilla walk", detail: "Bent over, arms swinging low, chest-thump after every touch." },
  { key: "tightrope", emoji: "🎪", label: "Tightrope", detail: "Every step must be heel-to-toe, like walking a wire. Break the line and it's a foul." },
  { key: "hot-lava", emoji: "🌋", label: "Hot lava", detail: "Stand on one spot for more than two seconds and your opponent gets a free shot." },
  { key: "giraffe", emoji: "🦒", label: "Giraffe", detail: "Giant strides only. Big long steps, no little ones." },
  { key: "ant", emoji: "🐜", label: "Ant march", detail: "Tiny steps only — a foot-length at most. Speed up and lose the ball." },
  { key: "grandpa", emoji: "👴", label: "Grandpa match", detail: "Hunched back, slow shuffle, and complain about your knees after every run." },
  { key: "slow-motion-match", emoji: "🎞️", label: "Slow-motion match", detail: "Everything in slow-mo — running, tackling, shooting. Go full speed and turn it over." },
  { key: "cyclops", emoji: "👁️", label: "Cyclops", detail: "One eye closed all match. Open both and you give away the ball." },
  { key: "hand-on-head", emoji: "💆", label: "Hand on head", detail: "One hand stays on top of your head the whole match." },
  { key: "pocket-hands", emoji: "🧥", label: "Pocket hands", detail: "Hands in pockets or tucked in your waistband. Keepers too — feet only." },
  { key: "elephant", emoji: "🐘", label: "Elephant trunk", detail: "Hold your nose with one hand and swing that arm like a trunk. Trumpet after every goal." },
  { key: "wobbly-legs", emoji: "🍮", label: "Jelly legs", detail: "Knees bent and wobbling at all times. Stand still and stiff and it's a foul." },
  { key: "gnome", emoji: "🍄", label: "Garden gnome", detail: "Stay in a deep crouch and waddle. Stand up straight and you lose the ball." },
  { key: "tree", emoji: "🌳", label: "Tree mode", detail: "Both arms up like branches all match. Lower them and it's a free kick." },

  // ── Keeper chaos ──
  { key: "flamingo-keeper", emoji: "🦩", label: "Flamingo keeper", detail: "Keepers stand on one leg. Put the other foot down and it's a goal." },
  { key: "bear-keeper", emoji: "🐻", label: "Bear keeper", detail: "Keepers stay on hands and feet like a bear. Growl on every save." },
  { key: "one-arm-keeper", emoji: "🖐️", label: "One-arm keeper", detail: "Keepers keep one hand behind their back at all times." },
  { key: "umbrella-keeper", emoji: "☂️", label: "Umbrella keeper", detail: "Keepers must hold an open umbrella and can only save with it." },
  { key: "cone-hands", emoji: "🔺", label: "Cone hands", detail: "Keepers hold a cone in each hand. Drop one and it's a goal." },
  { key: "swap-keeper", emoji: "🔀", label: "Keeper swap", detail: "After every save, the keeper and the shooter swap roles." },
  { key: "bat-keeper", emoji: "🏏", label: "Bat keeper", detail: "Keepers defend with a cricket bat or rolled-up newspaper. No hands allowed." },
  { key: "keepers-glory", emoji: "🧤", label: "Keeper's glory", detail: "Goals scored by the keeper's kick from their own area count double." },

  // ── Shooting rules ──
  { key: "rocket", emoji: "🚀", label: "Rocket launch", detail: "Count down 3-2-1 blast-off before every shot." },
  { key: "worm-burner", emoji: "🐛", label: "Worm burners", detail: "Ground shots only. If the ball leaves the floor, no goal." },
  { key: "rainbow", emoji: "🌈", label: "Rainbow shots", detail: "The ball must go above waist height before it crosses the line." },
  { key: "bounce-goal", emoji: "🏀", label: "Bounce goal", detail: "The ball has to bounce once before crossing the line." },
  { key: "heel-flick", emoji: "👠", label: "Heel flicks", detail: "Only back-heel shots count. Everything else is just practice." },
  { key: "volley", emoji: "🌪️", label: "Volley or bust", detail: "The ball must be in the air when you strike it, or the goal doesn't count." },
  { key: "big-head", emoji: "🧠", label: "Big head", detail: "Headers are worth double. Everything else is worth one." },
  { key: "bank-shot", emoji: "🎱", label: "Bank shot", detail: "Ball must bounce off a wall or fence before going in." },
  { key: "nutmeg", emoji: "🥜", label: "Nutmeg bonus", detail: "Nutmeg your opponent and you get a free shot on an empty goal." },
  { key: "hula-hoop", emoji: "⭕", label: "Hula goal", detail: "Prop a hoop in the goal. Only shots through the hoop count." },
  { key: "bottle-topple", emoji: "🍾", label: "Bottle topple", detail: "Balance a bottle on the goal. Knock it off with a shot for a bonus goal." },
  { key: "cone-slalom", emoji: "🚧", label: "Slalom first", detail: "Dribble around a cone before every shot. Miss the cone and it doesn't count." },
  { key: "keepy-start", emoji: "🤹", label: "Keepy-up start", detail: "Three keepy-ups before every kick-off. Drop it and your opponent starts." },
  { key: "shades", emoji: "🕶️", label: "Cool shades", detail: "Pretend to put on sunglasses before each shot. Forget and the goal doesn't count." },
  { key: "double-nothing", emoji: "💸", label: "Double or nothing", detail: "Call \"DOUBLE\" before a shot. Score and it's two goals; miss and you lose a point." },
  { key: "jackpot", emoji: "🎰", label: "Jackpot", detail: "Every third goal in the match is worth triple." },
  { key: "comeback", emoji: "🔥", label: "Comeback kid", detail: "Whoever is losing scores double. Leaders only get single goals." },
  { key: "golden-boot", emoji: "👢", label: "Golden boot", detail: "Once per match, call it and your next goal counts double." },
  { key: "hat-trick", emoji: "🏆", label: "Hat-trick hero", detail: "Score three in a row and you win instantly." },
  { key: "sudden-death", emoji: "💀", label: "Sudden death", detail: "Next goal wins the whole match." },
  { key: "spoon-chip", emoji: "🥄", label: "Spoon chips", detail: "Only chipped shots, scooped under the ball, count." },
  { key: "warm-up-dribble", emoji: "🍯", label: "Warm-up dribble", detail: "Take at least five touches before you're allowed to shoot." },
  { key: "left-right", emoji: "🦿", label: "Left-right-left", detail: "Alternate feet on every touch. Two in a row from the same foot and you lose it." },
  { key: "bowling", emoji: "🎳", label: "Bowling shots", detail: "Shots are underarm rolls, like bowling. Feet are for dribbling only." },
  { key: "woodwork", emoji: "🪵", label: "Woodwork wizard", detail: "The ball must hit a post or crossbar before it goes in, or it doesn't count." },
  { key: "back-to-goal", emoji: "🔄", label: "Back to goal", detail: "Start with your back to goal, then spin and shoot." },
  { key: "handball-hero", emoji: "🤾", label: "Handball hero", detail: "Once per match, pick up the ball and throw it at goal. It counts." },
  { key: "penalty-duel", emoji: "⚔️", label: "Penalty duel", detail: "Only penalties, taken in turn. First to five wins." },

  // ── Score and rule twists ──
  { key: "score-swap", emoji: "🔃", label: "Score swap", detail: "After every third goal, swap scores with your opponent." },
  { key: "rewind", emoji: "⏪", label: "Rewind", detail: "Once each, shout REWIND to undo the last goal and replay the restart." },
  { key: "var", emoji: "📺", label: "VAR check", detail: "Once each, challenge a goal. Settle it with rock-paper-scissors." },
  { key: "rps-restart", emoji: "✂️", label: "RPS kick-off", detail: "After every goal, rock-paper-scissors decides who gets the ball." },
  { key: "coin-flip", emoji: "🪙", label: "Coin flip chaos", detail: "Flip a coin before each kick-off. Heads is normal, tails is weak foot only." },
  { key: "dice-roll", emoji: "🎲", label: "Dice roll", detail: "Roll a dice each time you win the ball. That's how many touches you get before you must shoot." },
  { key: "losers-choice", emoji: "🎡", label: "Loser's choice", detail: "The player who just conceded picks a mini-twist for the next point." },
  { key: "handicap-hat", emoji: "🧢", label: "Handicap hat", detail: "Whoever's winning wears a cap and must keep one hand on it." },
  { key: "give-and-go", emoji: "🎁", label: "Give and go", detail: "Before shooting, pass to your opponent. They must pass it back. Yes, really." },
  { key: "keep-rolling", emoji: "🛼", label: "Keep it rolling", detail: "The ball can never stop. If it stops, the other player wins it." },
  { key: "traffic-lights", emoji: "🚦", label: "Traffic lights", detail: "Before each shot the keeper calls red, amber or green. Red is pass first, amber is weak foot, green is free choice." },
  { key: "shoe-throw-restart", emoji: "🥾", label: "Shoe-throw restart", detail: "After every goal, throw a shoe. Wherever it lands is where play restarts." },
  { key: "shoe-swap", emoji: "🥿", label: "Shoe swap", detail: "At half-time, swap shoes with your opponent and play on." },

  // ── Props and equipment ──
  { key: "balloon", emoji: "🎈", label: "Balloon ball", detail: "Play with a balloon or beach ball instead of the football." },
  { key: "sock-ball", emoji: "🧦", label: "Sock ball", detail: "Play with a rolled-up sock ball. Good luck with that." },
  { key: "tennis-ball", emoji: "🎾", label: "Tennis ball switch", detail: "Halfway through, swap to a tennis ball. Everything gets trickier." },
  { key: "shoe-mines", emoji: "👞", label: "Shoe mines", detail: "Put two shoes on the pitch. Touch one with the ball and your opponent gets it." },
  { key: "double-trouble", emoji: "⚽", label: "Double trouble", detail: "Two balls in play at once. Goals count from either." },
  { key: "accessory-stack", emoji: "🧣", label: "Accessory stack", detail: "Every time you score, add a silly item to wear: scarf, sock on hand, hat." },

  // ── Voices and characters ──
  { key: "pirate", emoji: "🏴‍☠️", label: "Pirate match", detail: "Talk like a pirate. Goals are \"treasure\"." },
  { key: "wizard", emoji: "🪄", label: "Wizard duel", detail: "Wave an arm and cast a made-up spell before every shot." },
  { key: "mouse", emoji: "🐭", label: "Squeaky mouse", detail: "Every word you say must be in a squeaky mouse voice." },
  { key: "interview", emoji: "🎙️", label: "Post-goal interview", detail: "After every goal, the loser interviews the scorer with three questions." },
  { key: "cowboy", emoji: "🤠", label: "Cowboy match", detail: "Say \"yeehaw\" after every shot and talk like it's the Wild West." },
  { key: "alien", emoji: "👽", label: "Alien language", detail: "Speak only in made-up alien gibberish." },
  { key: "cooking-show", emoji: "🍳", label: "Cooking show", detail: "Describe every move like a recipe: \"Add one pinch of dribble...\"" },
  { key: "animal-noises", emoji: "🐄", label: "Animal noises", detail: "Pick an animal each. You can only communicate in its noises." },
  { key: "villain", emoji: "🦹", label: "Evil villain", detail: "Do an evil laugh after every goal and monologue about your plan." },
  { key: "nature-doc", emoji: "🎬", label: "Nature documentary", detail: "Whisper-narrate the match like a wildlife documentary." },
  { key: "shakespeare", emoji: "📜", label: "Shakespeare", detail: "Speak in old-fashioned English. \"Thou shalt not pass!\"" },
  { key: "ref-cards", emoji: "🟨", label: "Card-happy ref", detail: "Wave imaginary yellow and red cards for anything silly." },
  { key: "drama-queen", emoji: "😭", label: "Drama queen", detail: "Whoever concedes must cry dramatically for five seconds." },
  { key: "diving", emoji: "🏊", label: "Diving contest", detail: "Every tackle needs a dramatic dive. Best acting wins the ball." },
  { key: "comedian", emoji: "😂", label: "Comedian", detail: "Tell a joke before each shot. If the keeper laughs, the goal counts double." },
  { key: "good-sport", emoji: "🏅", label: "Good sport", detail: "After every goal, the loser must give the scorer a ridiculous compliment." },
  { key: "alphabet", emoji: "🔤", label: "Alphabet shots", detail: "Before you shoot, name something starting with the next letter of the alphabet." },
  { key: "category", emoji: "🍕", label: "Name three", detail: "Before you shoot, name three of something the keeper picks: animals, foods, countries." },
  { key: "tongue-twister", emoji: "👅", label: "Tongue twister", detail: "Say a tongue twister before each shot. Mess it up and the goal doesn't count." },
  { key: "acrobat", emoji: "🤸", label: "Acrobat", detail: "Do a forward roll or cartwheel after every goal, before the restart." },
  { key: "mirror", emoji: "🪞", label: "Mirror mirror", detail: "Defenders must copy the attacker's arm movements." },
  { key: "polite-steal", emoji: "🙏", label: "Polite steal", detail: "Say \"please\" to tackle and \"thank you\" afterwards, or it's a foul." },
  { key: "invisible-ball", emoji: "👻", label: "Invisible ball", detail: "Play one minute with an imaginary ball. Argue about goals and settle with rock-paper-scissors." },
  { key: "lucky-ritual", emoji: "🍀", label: "Lucky ritual", detail: "Invent a lucky ritual and do it before every shot. Forget it and the shot is void." },
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
