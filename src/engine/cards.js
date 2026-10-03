/* ---------- the slow-play card ----------
 * The referee's answer to a game being held up: a card shown to one player
 * in one match, which costs them a goal. It works on the score alone, so it
 * means the same thing in every mode — a table, a bracket, a king streak and
 * a goal race all read s1/s2 and nothing else.
 *
 * A score can't go below zero (the server rejects a negative s1/s2), so a
 * player with no goals to lose hands the opponent a goal instead. Either way
 * the card is a one-goal swing against the player it was shown to.
 *
 * c1/c2 count the cards shown to each side, for the badge on the match card
 * only. Nothing may read them to decide a result: the server doesn't store
 * them (same gap as m.twist), so a state composed back from the cloud
 * arrives without them while the scores they changed are still right.
 */

export const CARD_GOAL_OFF = "goal-off";
export const CARD_GOAL_TO_OPPONENT = "goal-to-opponent";

/* Pure: the match after `side` ("s1" | "s2") is shown a card, and which of
   the two effects it had. */
export function applyCard(match, side) {
  const other = side === "s1" ? "s2" : "s1";
  const countKey = side === "s1" ? "c1" : "c2";
  const own = Number(match[side] || 0);
  const carded = { ...match, [countKey]: Number(match[countKey] || 0) + 1 };
  if (own > 0) {
    return { match: { ...carded, [side]: String(own - 1) }, effect: CARD_GOAL_OFF };
  }
  return {
    match: { ...carded, [other]: String(Number(match[other] || 0) + 1) },
    effect: CARD_GOAL_TO_OPPONENT,
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
