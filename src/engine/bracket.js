/* ---------- single-elimination brackets ----------
 * Shared by every mode that plays out a knockout bracket (knockout,
 * penalties). Round 1 is stamped `stage: "knockout"` the same way
 * generateGroupMatches stamps `stage: "group"` — a mode that owns a
 * different stage remaps it, exactly as league/roundrobin do for groups.
 * The round-advance helpers take the stage explicitly, since they build
 * fixtures on top of a bracket that is already in that mode's stage.
 */
import { makeId, shuffle, randomOrder, matchWinner } from "./match.js";

export function generateKnockoutRound1(players, rng = Math.random) {
  const shuffled = shuffle(players, rng);
  let size = 1;
  while (size < shuffled.length) size *= 2;
  const slots = [...shuffled];
  while (slots.length < size) slots.push(null);
  const round = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    if (a && b) {
      round.push({ id: makeId(), stage: "knockout", round: 1, p1: a.id, p2: b.id, s1: "0", s2: "0", played: false, bye: false });
    } else if (a || b) {
      round.push({ id: makeId(), stage: "knockout", round: 1, p1: (a || b).id, p2: null, s1: "0", s2: "0", played: true, bye: true });
    }
  }
  return round;
}

function groupByRound(matches) {
  const rounds = {};
  matches.forEach((m) => { (rounds[m.round] = rounds[m.round] || []).push(m); });
  const nums = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  return { rounds, nums };
}

export function latestRoundState(matches) {
  const { rounds, nums } = groupByRound(matches);
  const latestRound = nums[nums.length - 1];
  const latestMatches = rounds[latestRound] || [];
  const winners = latestMatches.map(matchWinner);
  const roundDecided = latestMatches.length > 0 && winners.every(Boolean);
  const isFinalRound = latestMatches.length === 1;
  return { rounds, nums, latestRound, latestMatches, winners, roundDecided, isFinalRound };
}

export function bracketChampion(players, matches) {
  const { roundDecided, isFinalRound, winners } = latestRoundState(matches);
  const championId = isFinalRound && roundDecided ? winners[0] : null;
  return championId ? players.find((p) => p.id === championId) ?? null : null;
}

/* Pair this round's winners into the next one. Returns the matches
   unchanged when the round isn't decided yet or the final has been played,
   so a mode's advance can hand the result straight back. */
export function advanceBracket(matches, stage, rng = Math.random) {
  const { latestRound, winners, roundDecided, isFinalRound } = latestRoundState(matches);
  if (!roundDecided || isFinalRound) return matches;
  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    const [a, b] = randomOrder(winners[i], winners[i + 1], rng);
    next.push({ id: makeId(), stage, round: latestRound + 1, p1: a, p2: b, s1: "0", s2: "0", played: false, bye: false });
  }
  return [...matches, ...next];
}
