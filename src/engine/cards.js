/* ---------- the referee's cards ----------
 * Two cards, shown to one player in one match, in every mode.
 *
 * YELLOW — the slow-play card, for a game being held up. It costs a goal.
 * It works on the score alone, so it means the same thing everywhere: a
 * table, a bracket, a king streak and a goal race all read s1/s2.
 *
 * RED — for a real offence. It costs points: RED_CARD_POINTS off the
 * player's total in whatever table the match feeds. A stage with no table
 * to dock (a knockout tie, a king match, a goal race — a mode lists these
 * as `goalStages`) takes RED_CARD_GOALS off the score instead, so a red
 * always bites.
 *
 * A score can't go below zero (the server rejects a negative s1/s2), so a
 * player with no goals to lose hands the opponent a goal instead. Either way
 * a goal's worth of card is a one-goal swing against the player shown it.
 *
 * What a card leaves on the match:
 *   c1/c2 — yellows shown to each side. For the badge only; nothing may read
 *           them to decide a result.
 *   r1/r2 — reds shown to each side. For the badge only, likewise.
 *   d1/d2 — points docked from each side. computeStandings and
 *           computeHorrorStandings subtract these, once the match is played.
 * The server stores none of them (same gap as m.twist): a state composed
 * back from the cloud keeps the goals a card cost but loses the badges and
 * the docked points.
 */

export const CARD_GOAL_OFF = "goal-off";
export const CARD_GOAL_TO_OPPONENT = "goal-to-opponent";
export const RED_CARD_POINTS = 3;
export const RED_CARD_GOALS = 2;

const keyFor = (side, letter) => `${letter}${side === "s1" ? 1 : 2}`;

/* One goal's swing against `side`: a goal off them, or one to the opponent
   when they have none. */
function swing(match, side) {
  const other = side === "s1" ? "s2" : "s1";
  const own = Number(match[side] || 0);
  if (own > 0) return { match: { ...match, [side]: String(own - 1) }, effect: CARD_GOAL_OFF };
  return { match: { ...match, [other]: String(Number(match[other] || 0) + 1) }, effect: CARD_GOAL_TO_OPPONENT };
}

/* Pure: the match after `side` ("s1" | "s2") is shown a yellow, and which of
   the two effects it had. */
export function applyCard(match, side) {
  const countKey = keyFor(side, "c");
  return swing({ ...match, [countKey]: Number(match[countKey] || 0) + 1 }, side);
}

/* Pure: the match after `side` is shown a red. `costsGoals` is true in a
   stage with no points table. `goalsOff` is how many of the player's own
   goals it removed, so the caller can take the same number out of the log. */
export function applyRedCard(match, side, costsGoals) {
  const countKey = keyFor(side, "r");
  let next = { ...match, [countKey]: Number(match[countKey] || 0) + 1 };
  if (!costsGoals) {
    const dockKey = keyFor(side, "d");
    return { match: { ...next, [dockKey]: Number(match[dockKey] || 0) + RED_CARD_POINTS }, goalsOff: 0 };
  }
  let goalsOff = 0;
  for (let i = 0; i < RED_CARD_GOALS; i++) {
    const result = swing(next, side);
    next = result.match;
    if (result.effect === CARD_GOAL_OFF) goalsOff++;
  }
  return { match: next, goalsOff };
}

/* Pure: takes back the most recent red shown to `side`, and the points it
   docked. A red that cost goals only loses its badge — put the score right
   with the goal buttons. */
export function undoRedCard(match, side) {
  const countKey = keyFor(side, "r");
  const dockKey = keyFor(side, "d");
  const reds = Number(match[countKey] || 0);
  if (reds === 0) return match;
  return {
    ...match,
    [countKey]: reds - 1,
    [dockKey]: Math.max(0, Number(match[dockKey] || 0) - RED_CARD_POINTS),
  };
}

/* What the announcer says. Kids play this: it names the slow play, never
   the reason for it, and ends by getting the game going again. */
export function cardSentence(effect, name, opponent) {
  if (!name || !opponent) return null;
  const cost = effect === CARD_GOAL_OFF
    ? `One goal comes off ${name}.`
    : `A bonus goal goes to ${opponent}.`;
  return `Referee's whistle! Slow play card for ${name}. ${cost} Big deep breath, and play on!`;
}

/* The red's line. Same rule: it states the cost and moves the game on. */
export function redCardSentence(name, costsGoals) {
  if (!name) return null;
  const cost = costsGoals ? `That costs ${RED_CARD_GOALS} goals.` : `${RED_CARD_POINTS} points come off in the table.`;
  return `Referee's whistle! Red card for ${name}. ${cost} Shake hands, and play on!`;
}
