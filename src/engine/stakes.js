/* ---------- what the tournament is played for ----------
 * Two lines of text, set on the Players tab before the fixtures are made: a
 * prize for the champion, and a forfeit for whoever finishes last. Both
 * are optional, and both are a family's own rule for the real world — the
 * app only shows them and writes them on the history record.
 */
import { computeStandings } from "./standings.js";

// Suggestions only: the setup screen shows a few at a time as one-tap chips
// beside a free-text box, and its Random button draws from the whole list.
// Kids read them. A forfeit can be a real cost — a chore, a workout, a treat
// missed — but never something that shames whoever came last. Each must fit
// the 40-character box.
export const PRIZE_IDEAS = [
  "A sweet treat", "Extra game time", "No homework tonight", "Pick the film",
  "Stay up 30 minutes late", "Pick what's for dinner", "An ice cream", "A day off chores",
  "First pick of teams next time", "Pick the next game mode", "Breakfast in bed", "Pick the music in the car",
  "A trip to the park", "Hot chocolate with marshmallows", "Front seat in the car", "Pick the weekend activity",
  "A takeaway night", "Pick the bedtime story", "One hour of screen time", "A new football sticker pack",
  "Pizza night", "Captain for the next tournament", "Skip tidying your room once", "A lie-in at the weekend",
];

export const FORFEIT_IDEAS = [
  // chores
  "Tidy up the cones", "Set the table", "Wash up", "Tidy your bedroom",
  "Take the bins out", "Hoover the living room", "Carry all the kit inside", "Water the plants",
  "Clear the table after dinner", "Sweep the patio", "Put the washing away", "Clean the football boots",
  // workouts
  "20 star jumps", "10 press-ups", "3 laps of the garden", "30-second plank",
  "15 squats", "20 toe taps on the ball", "Fetch every ball next game",
  // punishments
  "No screen time tonight", "Bed 30 minutes early", "No sweets today", "No pudding tonight",
  "Last pick of teams next time", "Start the next match 1-0 down", "In goal for the whole next match",
  "No tablet until tomorrow", "Extra reading for 20 minutes", "Extra homework practice",
];

/* A random idea other than the one already in the box, so tapping Random
   always visibly changes something. */
export function randomIdea(ideas, current, rng = Math.random) {
  const pool = ideas.filter((idea) => idea !== current);
  return pool.length ? pool[Math.floor(rng() * pool.length)] : current;
}

/* The bottom of an ordered list of rows, champion excluded. Rows level with
   the very last one on every value `keys` returns share last place, rather
   than one of them taking the forfeit on an alphabetical tie-break. */
export function bottomOf(rows, championId, keys) {
  const rest = rows.filter((r) => r.id !== championId);
  if (rest.length === 0) return [];
  const last = keys(rest[rest.length - 1]).join("|");
  return rest.filter((r) => keys(r).join("|") === last);
}

const tableKeys = (r) => [r.pts, r.gf - r.ga, r.gf];

/* Last place off a points table — shared with any mode that keeps its own
   table (horror's fates), so the tie rule is written once. */
export const lastOfTable = (standings, championId) => bottomOf(standings, championId, tableKeys);

/* Who finished last, as a list (ties share it). A mode with its own idea of
   last supplies `lastPlace` on the contract; every other mode gets the table
   of every match it played, bottom row. Empty until there is a champion. */
export function lastPlaceOf(mode, { players, matches, config, modeState, champion }) {
  if (!champion || players.length < 2) return [];
  if (mode.lastPlace) return mode.lastPlace({ players, matches, config, modeState, champion });
  return lastOfTable(computeStandings(players, matches), champion.id);
}
