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

// Shared by every mode with a round-robin group stage (league, roundrobin).
export function generateGroupMatches(players, legCount, rng = Math.random) {
  const pairs = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) pairs.push([players[i], players[j]]);
  }
  const matches = [];
  for (let leg = 1; leg <= legCount; leg++) {
    shuffle(pairs, rng).forEach(([p1, p2]) => {
      const [a, b] = randomOrder(p1, p2, rng);
      matches.push({ id: makeId(), stage: "group", leg, p1: a.id, p2: b.id, s1: "0", s2: "0", played: false });
    });
  }
  return matches;
}
