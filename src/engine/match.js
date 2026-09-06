/* ---------- ids, ordering, fixture generation ---------- */

export function makeId() {
  return Math.random().toString(36).slice(2).padEnd(8, "0").slice(0, 8);
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const randomOrder = (a, b, rng = Math.random) => (rng() < 0.5 ? [a, b] : [b, a]);

export function matchWinner(m) {
  if (m.bye) return m.p1;
  if (!m.played) return null;
  const s1 = Number(m.s1 || 0);
  const s2 = Number(m.s2 || 0);
  if (s1 === s2) return null;
  return s1 > s2 ? m.p1 : m.p2;
}

export function roundLabel(n) {
  if (n === 1) return "FINAL";
  if (n === 2) return "SEMI-FINAL";
  if (n === 4) return "QUARTER-FINAL";
  return `ROUND OF ${n * 2}`;
}

/* ---------- home/away balance ----------
 * p1 is the home side: it kicks off and wears the HOME tag, so it can't be an
 * independent coin flip per match. Flipping each match on its own regularly
 * left somebody away in every fixture they played. Instead the players are
 * sat in a random circle and the shorter way round hosts, which gives every
 * player the same number of home matches in a leg (give or take one, when the
 * roster is even and nobody can have exactly half of an odd number of games).
 * The randomness lives in the seating, drawn once per tournament, rather than
 * in each match.
 */
function circleHosts(seats, n) {
  return (a, b) => {
    const ia = seats.get(a.id);
    const ib = seats.get(b.id);
    const forward = (ib - ia + n) % n;
    const backward = (ia - ib + n) % n;
    // A pair sat exactly opposite each other — only possible on an even
    // roster — has no shorter way round, so seat order settles it.
    return forward !== backward ? forward < backward : ia < ib;
  };
}

// Shared by every mode with a round-robin group stage (league, roundrobin,
// chaos, goldenboot, survivor, worldcup's groups, leaguechaos).
export function generateGroupMatches(players, legCount, rng = Math.random) {
  const pairs = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) pairs.push([players[i], players[j]]);
  }
  const seats = new Map(shuffle(players, rng).map((p, i) => [p.id, i]));
  const hosts = circleHosts(seats, players.length);
  const matches = [];
  for (let leg = 1; leg <= legCount; leg++) {
    // Every other leg is played the other way round, so a player who hosted
    // more often in leg 1 travels more often in leg 2.
    const reversed = leg % 2 === 0;
    shuffle(pairs, rng).forEach(([p, q]) => {
      const [a, b] = hosts(p, q) !== reversed ? [p, q] : [q, p];
      matches.push({ id: makeId(), stage: "group", leg, p1: a.id, p2: b.id, s1: "0", s2: "0", played: false });
    });
  }
  return matches;
}

/* Two players over a fixed set of legs (a Best of N series, a multi-leg
   final): alternate who starts at home, with one flip deciding who hosts leg
   1, so nobody plays a whole series away. Returns [home, away] per leg. */
export function alternateHome(a, b, legCount, rng = Math.random) {
  const [first, second] = randomOrder(a, b, rng);
  return Array.from({ length: legCount }, (_, i) => (i % 2 === 0 ? [first, second] : [second, first]));
}
