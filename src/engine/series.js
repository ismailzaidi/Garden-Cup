import { computeStandings } from "./standings.js";

/* Winner of a two-player leg series (a best-of-N final), settled early once
   the trailing player can no longer catch up even by winning every leg left.
   Draws are worth a point like any other leg, so a W-D-D series has already
   crowned its winner before the last leg is played, while W-L-D stays level.
   With every leg played this reduces to "more points" — today's rule for a
   one-off final, now just the zero-unplayed-legs case of the same formula. */
export function seriesWinner(finalists, legs) {
  if (finalists.length !== 2 || legs.length === 0) return null;
  const [lead, trail] = computeStandings(finalists, legs);
  const unplayed = legs.filter((m) => !m.played).length;
  return lead.pts - trail.pts > 3 * unplayed ? lead : null;
}
