/* ---------- what the tournament is played for ----------
 * Two lines of text, set on the Players tab before the fixtures are made: a
 * prize for the champion, and a helper job for whoever finishes last. Both
 * are optional, and both are a family's own rule for the real world — the
 * app only shows them and writes them on the history record.
 */
import { computeStandings } from "./standings.js";

// Suggestions only: the setup screen offers these as one-tap chips beside a
// free-text box. Kids read them, so keep them cheerful.
export const PRIZE_IDEAS = ["A sweet treat", "Extra game time", "No homework tonight", "Pick the film"];
export const CHORE_IDEAS = ["Tidy up the cones", "Set the table", "Wash up", "20 star jumps"];

/* The bottom of an ordered list of rows, champion excluded. Rows level with
   the very last one on every value `keys` returns share last place, rather
   than one of them taking the job on an alphabetical tie-break. */
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
