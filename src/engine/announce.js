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

// One is picked at random per result so the announcer doesn't repeat itself.
// Kids play this, so keep them gross-out silly, never mean, and end on good
// sportsmanship. Each must use {loser} and {winner} exactly once.
export const RESULT_TEMPLATES = [
  "Ewww, {loser} got slimed! {winner} wins it! Good game, both of you!",
  "Yuck! {loser} stepped in the mud! {winner} takes the win! High fives all round!",
  "Ew, ew, ew! {loser} got covered in bogeys! {winner} wins! Great game!",
  "Splat! {loser} fell in a puddle of goo! {winner} is the winner! Shake hands, superstars!",
  "Pee-yew! {loser} got hit by a stinky sock! {winner} wins it! Brilliant effort, both of you!",
  "Oh no, {loser} got gunged! {winner} wins! Well played, everyone!",
  "Eww, slug slime everywhere! {loser} slipped up and {winner} wins it! Good game!",

  // ── slime, goo and gunge ──
  "Squelch! {loser} landed in the jelly! {winner} wins it! Good game, you two!",
  "Uh oh, {loser} got custard in their boots! {winner} takes the win! Well played, both of you!",
  "Gloop! {loser} is stuck in the porridge! {winner} wins! Shake hands, champions!",
  "Oh dear, {loser} sat in the trifle! {winner} is the winner! Great effort, both of you!",
  "Splosh! A bucket of gunge lands on {loser}! {winner} wins it! High fives all round!",
  "Yuck, {loser} got slimed by a giant snail! {winner} takes the win! Brilliant game!",
  "Blurgh! {loser} trod in the baked beans! {winner} wins! Well played, everyone!",
  "Sticky! {loser} is covered in honey and feathers! {winner} wins it! Good game, both of you!",
  "Splat! A custard pie finds {loser}! {winner} is the winner! Shake hands, superstars!",
  "Eww, {loser} slipped on a banana skin! {winner} takes the win! Great game, you two!",

  // ── pongs and whiffs ──
  "Pee-yew! {loser} found the smelly cheese! {winner} wins it! Well played, both of you!",
  "Phwoar! A stink bomb went off next to {loser}! {winner} wins! High fives all round!",
  "Hold your nose! {loser} trod in the compost! {winner} takes the win! Good game!",
  "What a whiff! {loser} got sprayed by a skunk! {winner} is the winner! Great effort, both of you!",
  "Stinky! {loser} is wearing the cabbage hat! {winner} wins it! Shake hands, champions!",
  "Pongy! {loser} opened the bin lid! {winner} wins! Brilliant game, you two!",
  "Oh no, {loser} fell in the wheelie bin! {winner} takes the win! Well played, everyone!",
  "Whiffy! {loser} got the old trainer award! {winner} wins it! Good game, both of you!",

  // ── garden creatures ──
  "Eek! A worm wriggled into the sock of {loser}! {winner} wins! High fives all round!",
  "Ribbit! A frog jumped on the head of {loser}! {winner} takes the win! Great game!",
  "Uh oh, a seagull pooped on {loser}! {winner} wins it! Well played, both of you!",
  "Buzz! The bees chased {loser} round the garden! {winner} is the winner! Shake hands, superstars!",
  "Squawk! A pigeon pinched the lunch of {loser}! {winner} wins! Good game, you two!",
  "Slurp! A big dog licked {loser} right on the face! {winner} takes the win! Brilliant effort, both of you!",
  "Oh no, the ants carried {loser} away! {winner} wins it! Well played, everyone!",
  "Yikes! {loser} got tickled by a hundred spiders! {winner} wins! Great game, both of you!",
  "Hop it! A slimy toad sat on the boot of {loser}! {winner} is the winner! High fives all round!",

  // ── mud and puddles ──
  "Splash! {loser} went head first into the puddle! {winner} wins it! Good game!",
  "Squelch! {loser} lost a boot in the mud! {winner} takes the win! Shake hands, champions!",
  "Mud pie! {loser} is wearing one as a hat! {winner} wins! Well played, both of you!",
  "Soggy! {loser} sat in the paddling pool! {winner} wins it! Great effort, you two!",
  "Drip, drip! The sprinkler soaked {loser}! {winner} is the winner! Brilliant game!",
  "Whoosh! {loser} slid through the mud on their bottom! {winner} takes the win! High fives all round!",
  "Oh dear, {loser} got stuck in the flower bed! {winner} wins! Good game, both of you!",

  // ── food fights ──
  "Splat! {loser} got a face full of spaghetti! {winner} wins it! Well played, everyone!",
  "Mushy peas everywhere! {loser} is covered and {winner} takes the win! Great game!",
  "Uh oh, {loser} sneezed into the flour! {winner} wins! Shake hands, superstars!",
  "Ketchup alert! {loser} got squirted! {winner} is the winner! Good game, you two!",
  "Sprouts for dinner! {loser} gets the whole plate and {winner} wins it! Well played, both of you!",
  "Burp! {loser} drank the fizzy pop too fast! {winner} takes the win! High fives all round!",
  "Eww, {loser} found a soggy sandwich in their pocket! {winner} wins! Brilliant effort, both of you!",

  // ── just plain silly ──
  "Achoo! {loser} got covered in giant bogeys! {winner} wins it! Great game, you two!",
  "Parp! A whoopee cushion got {loser}! {winner} takes the win! Good game, both of you!",
  "Itchy, itchy! {loser} has itching powder in their shirt! {winner} wins! Shake hands, champions!",
  "Oh no, {loser} has pants on their head! {winner} is the winner! Well played, everyone!",
  "Boing! {loser} bounced into the hedge! {winner} wins it! High fives all round!",
  "Tickle attack! {loser} could not stop giggling and {winner} takes the win! Great game!",
];

/* null means "not a result": a bye, or a match missing either player (by
   id, or because nameOf can't resolve one). A draw is still a result, so it
   returns a sentence — just never a winner, because the card on screen may
   still be waiting on penalties or another leg.
   Deliberately does not look at match.played: useTournament's togglePlayed
   calls this with the pre-toggle match, at the instant it's about to flip
   false -> true, so played is still false on the object passed in here.
   Whether this is a real result is the caller's call, not this one's.
   `rng` picks the template; tests pass a fixed one. */
export function resultSentence(match, nameOf, rng = Math.random) {
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

  const template = RESULT_TEMPLATES[Math.floor(rng() * RESULT_TEMPLATES.length)];
  return template.replace("{loser}", loser).replace("{winner}", winner);
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
