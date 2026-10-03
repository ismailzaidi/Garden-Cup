/* ---------- the horror deck ----------
 * Horror mode's own deck, kept apart from engine/twists.js on purpose: a
 * chaos twist must never change how a result counts, but a horror rule's
 * `fate` does. Fates are applied only by computeHorrorStandings below, and
 * only the horror mode calls it — the generic standings (and the Stats tab)
 * still see the honest on-pitch result.
 *
 * Rules come in two kinds, decided by `fate` (see isSecret):
 *  - SECRET (any fate but "normal"): referee only. Sealed behind a
 *    hold-to-peek button, revealed at full time, and it rewrites the result.
 *  - OPEN (fate "normal"): everyone knows. Shown on the card from the start,
 *    because the players have to act it out.
 *
 * Every rule must be child-friendly: spooky and silly, never mean. No
 * roasts, insults, shame or humiliation forfeits, devils, souls, blood or
 * death played straight — tests/horror.test.js scans the wording for it.
 *
 * The mode has no mercy, and it is not a performance. Two kinds of rule do
 * not belong in the deck, and tests/horror.test.js holds the line on both:
 *  - nothing that hands the loser points or a way back in (the "pity" fate
 *    still exists in FATES, but only for saved matches — nothing live uses it);
 *  - nothing that asks a player to make noises, put on a voice, give a
 *    speech or tell a story. A referee's call, or a one-word cue, is fine.
 *
 * Same storage rule as twists.js: never rename or delete a key. `m.twist`
 * stores the key on every horror match, and horrorOf returns null for an
 * unknown key — retire a rule by moving it to RETIRED_HORRORS at the bottom.
 */
import { shuffle } from "./match.js";

export const FATES = [
  "normal", "reverse", "void", "both-lose", "truce", "double", "pity", "drain",
  // the No Mercy fates — see the "No Mercy deck" rules below
  "draw6", "draw10", "wipeout", "skip-all", "swap", "rotate",
];

// "wipeout" only bites on a loss by this many goals or more
const WIPEOUT_MARGIN = 3;

export const FATE_VERDICT = {
  reverse: "☠️ The winner actually LOST. The loser takes the points.",
  void: "👻 The match never happened. No points for anyone.",
  "both-lose": "👾 The monsters got everyone. Both players take the loss.",
  truce: "🕊️ A draw paid 3 points each. A win paid just 1.",
  double: "🌑 The winner powers up: double points.",
  pity: "😢 The loser was pitied: they get 3 points too.",
  drain: "🧛 The winner drained 3 points out of the loser.",
  draw6: "🎴 Draw six! The loser is hit for minus 6 points.",
  draw10: "🔟 Draw ten! The loser is hit for minus 10 points.",
  wipeout: "🧨 Lose by 3 goals or more and it's minus 6 points. A closer loss is just a loss.",
  "skip-all": "⛔ Skip everyone! The winner takes 3 and every other player in the tournament loses 1.",
  swap: "🤲 Hand swap! These two players swap their whole points totals.",
  rotate: "0️⃣ Pass your hand! Every player's points pass to the next player on the Players list.",
};

/* SECRET rules come first in the deck, OPEN rules after — purely for
   reading; dealing shuffles the whole deck. */
export const HORROR_TWISTS = [
  // ════════ SECRET — referee only, rewrites the result ════════

  // ── Cursed results: the winner loses ──
  { key: "upside-down", emoji: "🙃", fate: "reverse", label: "Upside Down", detail: "Whoever wins this match actually loses. Whoever loses, wins. Tell nobody until full time." },
  { key: "cursed-crown", emoji: "👑", fate: "reverse", label: "Cursed Crown", detail: "The crown is cursed. The winner takes the defeat; the loser walks off with the points." },
  { key: "mirror-world", emoji: "🪞", fate: "reverse", label: "Mirror World", detail: "This match takes place in the mirror world. Everything is reflected — including the result." },
  { key: "poisoned-chalice", emoji: "🧁", fate: "reverse", label: "Cursed Cupcake", detail: "Victory tastes sweet… but the cupcake was cursed. The winner gets nothing; the loser takes the win." },
  { key: "backwards-clock", emoji: "🕰️", fate: "reverse", label: "Clock Runs Backwards", detail: "Time runs backwards in this match, and so does the result." },
  { key: "monkeys-paw", emoji: "🐒", fate: "reverse", label: "Monkey's Paw", detail: "You wished to win. The paw granted it… by making you lose." },
  { key: "evil-twin", emoji: "👯", fate: "reverse", label: "Evil Twin", detail: "The players' evil twins secretly played instead. The winner's twin lost on their behalf." },
  { key: "trick-not-treat", emoji: "🎃", fate: "reverse", label: "Trick, Not Treat", detail: "The winner thinks they got a treat. It was a trick: the result is reversed." },

  // ── Cursed results: it never happened ──
  { key: "ghost-match", emoji: "👻", fate: "void", label: "Ghost Match", detail: "This match was played by ghosts. It never happened. Nobody gets any points." },
  { key: "all-a-dream", emoji: "💤", fate: "void", label: "It Was All a Dream", detail: "Everyone wakes up in a cold sweat. None of it happened. No points for anyone." },
  { key: "memory-wipe", emoji: "🧠", fate: "void", label: "Memory Wipe", detail: "The referee wipes everyone's memory at full time. The match doesn't count." },
  { key: "burial-ground", emoji: "🏰", fate: "void", label: "Haunted Castle", detail: "This match was played in a haunted castle. The ghosts hid the result: no points." },
  { key: "the-fog", emoji: "🌫️", fate: "void", label: "The Fog", detail: "The fog rolled in and nobody saw a thing. Result void." },

  // ── Cursed results: the monsters get everyone ──
  { key: "devils-pact", emoji: "🧙", fate: "both-lose", label: "The Witch's Spell", detail: "A mischievous witch put a spell on both players. Both lose, whatever the score." },
  { key: "haunted-house", emoji: "🏚️", fate: "both-lose", label: "Haunted House", detail: "Nobody escapes the haunted house. Both players take the loss." },
  { key: "quicksand", emoji: "⏳", fate: "both-lose", label: "Quicksand", detail: "The pitch was quicksand all along. Both players sank. Both lose." },
  { key: "double-curse", emoji: "🧿", fate: "both-lose", label: "A Curse on Both Your Houses", detail: "The witch cursed you both. Both players lose this match." },
  { key: "swamp-monster", emoji: "🐊", fate: "both-lose", label: "Swamp Monster", detail: "The swamp monster chased both players off the pitch at full time. Both lose." },

  // ── Cursed results: the spirits want peace ──
  { key: "full-moon-truce", emoji: "🌕", fate: "truce", label: "Full Moon Truce", detail: "Under the full moon, a draw is worth 3 points each. A win is worth only 1." },
  { key: "rest-in-peace", emoji: "🕊️", fate: "truce", label: "Peaceful Spirits", detail: "The spirits want everyone to be friends. A draw earns 3 points each; winning earns just 1." },
  { key: "cursed-handshake", emoji: "🤝", fate: "truce", label: "Cursed Handshake", detail: "The ghosts reward friendship. Draw and you both get 3. Win and you get a measly 1." },
  { key: "white-flag", emoji: "🏳️", fate: "truce", label: "White Flag", detail: "Surrender is rewarded here. A draw pays 3 each; a winner gets only 1." },
  { key: "the-seance", emoji: "🕯️", fate: "truce", label: "The Séance", detail: "The spirits love harmony. A draw is worth 3 each, a win only 1." },

  // ── Cursed results: the winner powers up ──
  { key: "blood-moon", emoji: "🌑", fate: "double", label: "Eclipse", detail: "During the eclipse, the winner gets double points." },
  { key: "soul-wager", emoji: "🔮", fate: "double", label: "Wizard's Wager", detail: "Both players secretly bet their magic wands. The winner takes 6 points." },
  { key: "thunderstorm", emoji: "⛈️", fate: "double", label: "Thunderstorm", detail: "Lightning strikes the winner and powers them up: double points." },
  { key: "werewolf-hour", emoji: "🐺", fate: "double", label: "Werewolf Hour", detail: "The winner transforms at full time. Double points." },
  { key: "dragon-hoard", emoji: "🐉", fate: "double", label: "Dragon's Hoard", detail: "The winner raids the dragon's hoard and takes 6 points." },

  // ── Cursed results: the winner drains the loser ──
  { key: "vampire", emoji: "🧛", fate: "drain", label: "Vampire", detail: "The winner is a vampire: they gain 3 points and drain 3 points from the loser." },
  { key: "leech", emoji: "🪱", fate: "drain", label: "Leech", detail: "A leech latches on. The winner takes 3, the loser loses 3." },
  { key: "soul-stealer", emoji: "👁️", fate: "drain", label: "Point Snatcher", detail: "A sneaky spirit snatches 3 points from the loser and gives them to the winner." },
  { key: "grim-tax", emoji: "🧌", fate: "drain", label: "Troll Toll", detail: "A troll guards the bridge and charges the loser a toll: minus 3 points. The winner keeps their 3." },
  { key: "ghost-pickpocket", emoji: "🦝", fate: "drain", label: "Ghost Pickpocket", detail: "A ghost pickpockets 3 points off the loser and hands them to the winner." },
  { key: "black-hole", emoji: "🕳️", fate: "drain", label: "Black Hole", detail: "The loser falls into a black hole and comes out 3 points poorer." },


  // ── The No Mercy deck: card-game cruelty, sealed ──
  { key: "wild-draw-six", emoji: "🎴", fate: "draw6", label: "Wild Draw Six", detail: "A Draw Six lands on the loser: minus 6 points. The winner keeps their 3." },
  { key: "stacked-draw", emoji: "🗼", fate: "draw6", label: "Stacked Draw", detail: "The +2s kept stacking and the loser could not pass them on: minus 6 points." },
  { key: "wild-draw-ten", emoji: "🔟", fate: "draw10", label: "Wild Draw Ten", detail: "The cruellest card in the deck. The loser draws ten: minus 10 points." },
  { key: "wipeout", emoji: "🧨", fate: "wipeout", label: "Show No Mercy", detail: "Lose by three goals or more and you are wiped out: minus 6 points. A closer loss is just a loss." },
  { key: "skip-everyone", emoji: "⛔", fate: "skip-all", label: "Skip Everyone", detail: "The winner takes 3 points, and every other player in the tournament loses 1. Yes, even the ones who weren't playing." },
  { key: "hand-swap", emoji: "🤲", fate: "swap", label: "Hand Swap", detail: "A seven was played. These two players swap their whole points totals, whoever won." },
  { key: "pass-your-hand", emoji: "0️⃣", fate: "rotate", label: "Pass Your Hand", detail: "A zero was played. Every player's points pass to the next player on the Players list, and the last player's go to the first." },
  { key: "reverse-card", emoji: "↪️", fate: "reverse", label: "Reverse Card", detail: "A reverse card is played at full time. The winner loses; the loser wins." },
  { key: "double-draw", emoji: "🎰", fate: "drain", label: "Draw Four, Give Four", detail: "The loser hands 3 points straight to the winner: plus 3 one way, minus 3 the other." },


  // ════════ OPEN — everyone knows, act it out ════════

  // ── Haunted keeper ──
  { key: "possessed-keeper", emoji: "😵‍💫", fate: "normal", label: "Possessed Keeper", detail: "Keepers are possessed: arms stiff by their sides like a creepy doll." },
  { key: "mummy-keeper", emoji: "🧻", fate: "normal", label: "Mummy Keeper", detail: "Keepers tuck one arm inside their shirt like a mummy's wrapping." },
  { key: "frankenstein-keeper", emoji: "🔩", fate: "normal", label: "Frankenstein Keeper", detail: "Keepers move stiff-legged like Frankenstein's monster. No bending the knees." },
  { key: "scarecrow-keeper", emoji: "🌾", fate: "normal", label: "Scarecrow Keeper", detail: "Keepers stand arms out like a scarecrow and can only move once the ball is struck." },
  { key: "weeping-angel", emoji: "😶", fate: "normal", label: "Weeping Angel", detail: "Keepers may only move while the shooter isn't looking at them." },
  { key: "coffin-keeper", emoji: "🛌", fate: "normal", label: "Coffin Keeper", detail: "Keepers start each attack sitting down and may only rise from the coffin when the shooter shouts RISE." },

  // ── Curses on the body ──
  { key: "zombie-shuffle", emoji: "🧟‍♀️", fate: "normal", label: "Zombie Shuffle", detail: "Shuffle like a zombie all match, arms out. Run normally and your opponent gets a free shot." },
  { key: "mummy-wrap", emoji: "🩹", fate: "normal", label: "Mummy Wrap", detail: "Both players keep one arm tucked inside their shirt all match." },
  { key: "cursed-leg", emoji: "🦴", fate: "normal", label: "Cursed Leg", detail: "Your strong leg is cursed. Touch the ball with it and your opponent gets a free shot." },
  { key: "hopping-vampire", emoji: "🦇", fate: "normal", label: "Hopping Vampire", detail: "Without the ball you must hop with your feet together, like a hopping vampire." },
  { key: "crab-curse", emoji: "🦀", fate: "normal", label: "Crab Curse", detail: "You may only move sideways. Forwards or backwards and it's a free shot to your opponent." },
  { key: "frozen-soul", emoji: "🥶", fate: "normal", label: "Frozen Ghost", detail: "Whenever you concede, freeze stiff for five seconds while your opponent celebrates." },
  { key: "ghost-chains", emoji: "⛓️", fate: "normal", label: "Ghost Chains", detail: "Drag one foot behind you all match like it's chained to a ghost." },
  { key: "headless-horseman", emoji: "🐴", fate: "normal", label: "Headless Horseman", detail: "Cover one eye with your hand every time you shoot." },
  { key: "shrinking-curse", emoji: "🤏", fate: "normal", label: "Shrinking Curse", detail: "Every time you score, your opponent's goal shrinks: move one post a foot closer to the other." },
  { key: "puppet-strings", emoji: "🪆", fate: "normal", label: "Puppet Strings", detail: "Once per attack your opponent shouts LEFT or RIGHT, and your next touch must go that way." },

  // ── Silly forfeits ──
  { key: "dramatic-death", emoji: "🎭", fate: "normal", label: "Dramatic Faint", detail: "Every time you concede, do a theatrical fainting scene on the grass." },
  { key: "chicken-of-doom", emoji: "🐔", fate: "normal", label: "Chicken Dance of Doom", detail: "Every goal you concede costs you five seconds of chicken dance." },
  { key: "cursed-nickname", emoji: "🏷️", fate: "normal", label: "Monster Name", detail: "Before kick-off, each player picks a monster name for themselves and must answer to it all match." },
  { key: "haunted-portrait", emoji: "📸", fate: "normal", label: "Monster Selfie", detail: "At full time both players pull their scariest monster faces for a photo together." },

  // ── Mind games & betrayal ──
  { key: "the-traitor", emoji: "🐍", fate: "normal", label: "The Traitor", detail: "Once per match the referee may shout TRAITOR: the players swap goals and play on." },
  { key: "whispers", emoji: "🗣️", fate: "normal", label: "Whispers", detail: "Creepy whispers only. Raise your voice and your opponent gets a free shot." },
  { key: "forbidden-word", emoji: "🤐", fate: "normal", label: "Forbidden Word", detail: "Saying the word \"goal\" is forbidden. Say it and your last goal is cancelled." },
  { key: "lights-out", emoji: "🔦", fate: "normal", label: "Lights Out", detail: "Whenever the referee shouts LIGHTS OUT, both players freeze with eyes closed for three seconds." },
  { key: "hot-potato", emoji: "🥔", fate: "normal", label: "Hot Potato Curse", detail: "Hold the ball more than five seconds and the curse passes: free shot to your opponent." },
  { key: "possessed-ref", emoji: "🧑‍⚖️", fate: "normal", label: "Possessed Referee", detail: "The referee may award one completely made-up free kick to each player. No arguing." },
  { key: "doppelganger", emoji: "👥", fate: "normal", label: "Doppelgänger", detail: "Swap identities: you must call yourself by your opponent's name all match." },
  { key: "paranoia", emoji: "👀", fate: "normal", label: "Paranoia", detail: "Every so often the referee shouts BEHIND YOU! and both players must spin round and look." },

  // ── Spooky garden ──
  { key: "graveyard-shift", emoji: "🌙", fate: "normal", label: "Graveyard Shift", detail: "Slow, silent, sneaky football. Make a loud noise and you lose the ball." },
  { key: "lava-graveyard", emoji: "🌋", fate: "normal", label: "The Floor Is Lava", detail: "When the referee shouts LAVA, both players stand on one leg until they shout SAFE." },
  { key: "spider-crawl", emoji: "🕷️", fate: "normal", label: "Spider Crawl", detail: "Before every kick-off, both players crab-walk like spiders to their own goal and back." },
  { key: "bat-wings", emoji: "🪽", fate: "normal", label: "Bat Wings", detail: "Flap your arms like bat wings whenever you don't have the ball." },
  { key: "rattling-bones", emoji: "☠️", fate: "normal", label: "Rattling Bones", detail: "Shake every limb like a rattling skeleton before every shot." },
  { key: "moonwalk", emoji: "🌚", fate: "normal", label: "Zombie Moonwalk", detail: "After conceding, moonwalk all the way back to your goal." },
  { key: "shadow-marker", emoji: "🖤", fate: "normal", label: "Shadow", detail: "After every goal, the conceder must shadow the scorer's every move for ten seconds." },
  { key: "tombstone-wall", emoji: "🧱", fate: "normal", label: "Tombstone Wall", detail: "Free kicks are defended by kneeling like a tombstone in front of the ball." },
  { key: "eerie-silence", emoji: "🤫", fate: "normal", label: "Eerie Silence", detail: "Total silence all match. First to speak gives away a free shot." },
  { key: "ghost-whistle", emoji: "📯", fate: "normal", label: "Ghost Whistle", detail: "The referee may blow an imaginary whistle at any time. Both players freeze like statues until it blows again." },

  // ── Cursed skills ──
  { key: "phantom-shot", emoji: "👤", fate: "normal", label: "Phantom Shot", detail: "Every real shot must follow a fake one. No fake shot, no goal." },
  { key: "double-phantom", emoji: "💨", fate: "normal", label: "Double Phantom", detail: "Two fake shots in a row before every real one. Miss one out and the goal is wiped." },
  { key: "spellbound-goal", emoji: "🪄", fate: "normal", label: "Spellbound Goal", detail: "Goals only count if the finish is a skill: back-heel, volley, chip or rabona." },
  { key: "skeleton-stepover", emoji: "💀", fate: "normal", label: "Skeleton Stepover", detail: "Two stepovers before every shot. Forget them and it's your opponent's ball." },
  { key: "ghost-turn", emoji: "🌀", fate: "normal", label: "Ghost Turn", detail: "Turn away from your opponent with a drag-back or Cruyff turn before every shot." },
  { key: "shapeshifter", emoji: "🦎", fate: "normal", label: "Shapeshifter", detail: "Drop your shoulder one way and go the other before you shoot. No feint, no goal." },
  { key: "witchs-roulette", emoji: "🎡", fate: "normal", label: "Witch's Roulette", detail: "Spin right over the ball, a full 360, before you shoot." },
  { key: "scissor-hands", emoji: "✂️", fate: "normal", label: "Scissor Hands", detail: "One scissors move over the ball before every shot. No scissors, no goal." },
  { key: "poltergeist-pass", emoji: "📦", fate: "normal", label: "Poltergeist Pass", detail: "Fake a pass, keep the ball, then shoot. A shot with no fake pass is wiped." },
  { key: "tricksters-toll", emoji: "🤹", fate: "normal", label: "Trickster's Toll", detail: "You must dribble past your opponent before you may shoot." },
  { key: "chain-of-curses", emoji: "🔗", fate: "normal", label: "Chain of Curses", detail: "Link two different skills before every shot, or the goal is wiped." },

  // ── The No Mercy deck: played in the open ──
  { key: "stack-attack", emoji: "📈", fate: "normal", label: "Stack Attack", detail: "Goals in a row stack. Your second in a row counts as 2, your third as 3. Concede and your stack is gone." },
  { key: "stacking-plus-two", emoji: "➕", fate: "normal", label: "Stacking +2", detail: "Concede and do 2 star jumps before you may defend. They stack: 4 next time, then 6, then 8." },
  { key: "draw-until-you-play", emoji: "🎣", fate: "normal", label: "Draw Until You Play", detail: "Miss the target and your opponent takes free shots at your goal until they miss one." },
  { key: "colour-roulette", emoji: "🎨", fate: "normal", label: "Colour Roulette", detail: "The scorer names a colour. The conceder must run and touch something that colour before they may defend again." },
  { key: "discard-all", emoji: "🗑️", fate: "normal", label: "Discard All", detail: "Score twice in a row and one of your opponent's goals is thrown away." },
  { key: "wild-card", emoji: "🌈", fate: "normal", label: "Wild Card", detail: "After every goal the scorer picks the rule for the next one: weak foot, one touch, or skill finish only." },

  // ── No Mercy ──
  { key: "no-mercy", emoji: "🚫", fate: "normal", label: "No Mercy", detail: "Lead by four and the match ends on the spot. The loser does a forfeit of the winner's choosing." },
  { key: "stacking-curse", emoji: "📚", fate: "normal", label: "Stacking Curse", detail: "Curses stack as you concede: 1st, weak foot only. 2nd, one arm tucked in. 3rd, hop everywhere." },
  { key: "draw-four", emoji: "🃏", fate: "normal", label: "Draw Four", detail: "Concede and do four of whatever the scorer picks: star jumps, spins or squats." },
  { key: "skipped", emoji: "⏭️", fate: "normal", label: "Skipped", detail: "Once each per match, shout SKIP: your opponent must stand still for the next kick-off." },
];

/* Rules taken out of the deck. They are never dealt again, but horrorOf still
   resolves them, so a saved tournament that was dealt one keeps its banner
   and — for the pity rules — its fate. Retire a rule by moving it here,
   never by deleting it. */
export const RETIRED_HORRORS = [
  // ── Players had to make noises, put on a voice, or tell a story ──
  { key: "seance-keeper", emoji: "🙈", fate: "normal", label: "Séance Keeper", detail: "Keepers close their eyes and only open them when the shooter shouts BOO before shooting." },
  { key: "vanished-keeper", emoji: "🫥", fate: "normal", label: "Vanished Keeper", detail: "The keeper has vanished. They must stand behind the goal moaning like a ghost." },
  { key: "walk-of-shame", emoji: "🔔", fate: "normal", label: "Ghost Parade", detail: "At full time both players do a slow, spooky ghost parade round the garden, oooo-ing all the way." },
  { key: "roast-session", emoji: "💐", fate: "normal", label: "Compliment Curse", detail: "After every goal, the scorer must give the other player a spooky compliment: \"That save was scarily good!\"" },
  { key: "the-eulogy", emoji: "📜", fate: "normal", label: "Comeback Speech", detail: "At full time, the loser gives a dramatic speech about how they'll rise again next match." },
  { key: "gravestone", emoji: "✍️", fate: "normal", label: "Ghost Story", detail: "At full time, the loser tells a ten-second spooky story about what happened in the match." },
  { key: "losers-curse", emoji: "🧹", fate: "normal", label: "Groaning Ghoul", detail: "Whoever concedes fetches the ball like a ghoul, groaning all the way there and back." },
  { key: "grovel", emoji: "🙇", fate: "normal", label: "Monster Manners", detail: "At full time both players bow and say \"Well played, fellow monster.\"" },
  { key: "villain-laugh", emoji: "🦹", fate: "normal", label: "Villain Laugh", detail: "Celebrate every goal with an evil villain laugh. Forget and the goal is chalked off." },
  { key: "scream-queen", emoji: "😱", fate: "normal", label: "Movie Scream", detail: "Concede and you let out your best spooky movie scream." },
  { key: "jump-scare", emoji: "👹", fate: "normal", label: "Jump Scare", detail: "Once each per match, shout BOO as your opponent shoots. If they flinch, the shot doesn't count." },
  { key: "creaking-door", emoji: "🚪", fate: "normal", label: "Creaking Door", detail: "Before every shot, make a long creaking-door sound. No creak, no goal." },
  { key: "haunted-radio", emoji: "📻", fate: "normal", label: "Haunted Radio", detail: "The referee commentates the whole match like a spooky late-night radio narrator." },
  { key: "witchs-brew", emoji: "🧪", fate: "normal", label: "Witch's Brew", detail: "Before each kick-off, both players stir an imaginary cauldron and cackle." },
  { key: "haunted-goal", emoji: "🥅", fate: "normal", label: "Haunted Goal", detail: "One goal is haunted. Goals scored into it only count if the scorer says \"sorry, ghost\" first." },
  { key: "creepy-doll", emoji: "🧸", fate: "normal", label: "Creepy Doll", detail: "Talk like a creepy doll whenever you have the ball: \"Play with meeee…\"" },
  { key: "last-words", emoji: "💬", fate: "normal", label: "Spooky Catchphrase", detail: "Before every shot, shout your spooky catchphrase." },

  // ── Mercy: the loser was handed points, or a way back in ──
  { key: "sympathy-ghost", emoji: "🫂", fate: "pity", label: "Sympathy Ghost", detail: "The ghosts felt sorry for the loser. The loser gets 3 points too." },
  { key: "haunted-trophy", emoji: "🎗️", fate: "pity", label: "Haunted Participation Trophy", detail: "Everyone's a winner… spookily. The loser also gets 3 points." },
  { key: "rise-again", emoji: "🧟", fate: "pity", label: "Rise Again", detail: "The loser rises from the grave clutching 3 points." },
  { key: "nine-lives", emoji: "🐈‍⬛", fate: "pity", label: "Nine Lives", detail: "The loser spent one of their nine lives: they get 3 points as well." },
  { key: "banshee-wail", emoji: "😭", fate: "pity", label: "Banshee's Wail", detail: "The banshee wailed so loudly the loser was given 3 points just to make it stop." },
  { key: "beg-for-mercy", emoji: "🙏", fate: "normal", label: "Ask for Mercy", detail: "Concede two in a row and you may politely ask for mercy. Your opponent decides if you get a free penalty." },
  { key: "deal-with-devil", emoji: "📝", fate: "normal", label: "Goblin's Bargain", detail: "Once per match, whoever is losing may buy a free penalty by doing a silly forfeit the leader picks: a dance, a song or a funny walk." },
];

/* true: referee only, sealed until full time. false: shown to everyone. */
export const isSecret = (twist) => twist.fate !== "normal";

export const horrorOf = (key) => HORROR_TWISTS.find((t) => t.key === key) ?? RETIRED_HORRORS.find((t) => t.key === key) ?? null;

/* Same as dealTwists: no repeats until the deck runs dry, then reshuffle. */
export function dealHorrors(count, rng = Math.random) {
  const dealt = [];
  let deck = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) deck = shuffle(HORROR_TWISTS, rng);
    dealt.push(deck.shift().key);
  }
  return dealt;
}

/* Points and W/D/L for one played match after its fate, as
   [p1 outcome, p2 outcome], each { r: "w" | "d" | "l" | null, pts }.
   r null means the match counts as played but goes in no column. */
export function fateOutcome(fate, s1, s2) {
  if (fate === "void") return [{ r: null, pts: 0 }, { r: null, pts: 0 }];
  if (fate === "both-lose") return [{ r: "l", pts: 0 }, { r: "l", pts: 0 }];
  if (s1 === s2) {
    const pts = fate === "truce" ? 3 : 1;
    return [{ r: "d", pts }, { r: "d", pts }];
  }
  const p1Won = s1 > s2;
  let win = { r: "w", pts: 3 };
  let lose = { r: "l", pts: 0 };
  if (fate === "reverse") { win = { r: "l", pts: 0 }; lose = { r: "w", pts: 3 }; }
  else if (fate === "truce") win = { r: "w", pts: 1 };
  else if (fate === "double") win = { r: "w", pts: 6 };
  else if (fate === "pity") lose = { r: "l", pts: 3 };
  else if (fate === "drain") lose = { r: "l", pts: -3 };
  else if (fate === "draw6") lose = { r: "l", pts: -6 };
  else if (fate === "draw10") lose = { r: "l", pts: -10 };
  else if (fate === "wipeout" && Math.abs(s1 - s2) >= WIPEOUT_MARGIN) lose = { r: "l", pts: -6 };
  return p1Won ? [win, lose] : [lose, win];
}

/* computeStandings with every result run through its horror fate. Goals,
   goal difference and the tie-break order are untouched.

   Three fates move points that aren't the two players' own result:
   "skip-all" docks everyone else a point; "swap" and "rotate" move whole
   totals between players. The moves are applied last, to the finished
   totals, in fixture order — never in the order matches happened to be
   played, which isn't recorded. So a swap is permanent: the two players
   trade totals, including points either of them earns afterwards. */
export function computeHorrorStandings(players, matches) {
  const table = {};
  players.forEach((p) => {
    table[p.id] = { id: p.id, name: p.name, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  });
  const moves = [];
  matches.forEach((m) => {
    if (!m.played || m.bye) return;
    const s1 = Number(m.s1 || 0);
    const s2 = Number(m.s2 || 0);
    const a = table[m.p1];
    const b = table[m.p2];
    if (!a || !b) return;
    a.played++; b.played++;
    a.gf += s1; a.ga += s2;
    b.gf += s2; b.ga += s1;
    const fate = horrorOf(m.twist)?.fate ?? "normal";
    const [oa, ob] = fateOutcome(fate, s1, s2);
    if (oa.r) a[oa.r]++;
    if (ob.r) b[ob.r]++;
    a.pts += oa.pts;
    b.pts += ob.pts;
    if (fate === "skip-all" && s1 !== s2) {
      players.forEach((p) => { if (p.id !== m.p1 && p.id !== m.p2) table[p.id].pts -= 1; });
    }
    if (fate === "swap" || fate === "rotate") moves.push({ fate, a, b });
  });
  moves.forEach(({ fate, a, b }) => {
    if (fate === "swap") { [a.pts, b.pts] = [b.pts, a.pts]; return; }
    // rotate: each player takes the total of the player listed before them
    const totals = players.map((p) => table[p.id].pts);
    players.forEach((p, i) => { table[p.id].pts = totals[(i - 1 + totals.length) % totals.length]; });
  });
  return Object.values(table).sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    const gdX = x.gf - x.ga, gdY = y.gf - y.ga;
    if (gdY !== gdX) return gdY - gdX;
    if (y.gf !== x.gf) return y.gf - x.gf;
    return x.name.localeCompare(y.name);
  });
}
