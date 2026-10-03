/* ---------- difficulty tiers for the dealt rules ----------
 * Chaos and Horror deal one rule to every match. In "climb" order the deal
 * starts gentle and ends wild: the first third of the matches get tier 1
 * rules, the middle third tier 2, the last third tier 3, so a tournament
 * teaches its skills before it asks for them. "random" is the old behaviour.
 *
 * A match's band is its position in the fixture list, which is the order the
 * screen shows them in. Which rule belongs to which tier lives with each deck
 * (engine/twists.js, engine/horror.js); this file only knows the bands.
 */

export const TIER_COUNT = 3;
export const TIER_LABELS = { 1: "Easy", 2: "Medium", 3: "Hard" };

export const ORDERS = ["climb", "random"];
export const DEFAULT_ORDER = "climb";
export const formatOrder = (order) => (order === "climb" ? "Easy to hard" : "Mixed up");

/* Which tier the `index`th of `count` matches is dealt from. */
export const bandOf = (index, count) => Math.min(TIER_COUNT, Math.floor((index * TIER_COUNT) / Math.max(1, count)) + 1);

export const tierName = (tier) => `Level ${tier} · ${TIER_LABELS[tier]}`;
