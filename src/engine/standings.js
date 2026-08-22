/* ---------- stats — generic over any list of matches ---------- */

export function computeStandings(players, matches) {
  const table = {};
  players.forEach((p) => {
    table[p.id] = { id: p.id, name: p.name, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  });
  matches.forEach((m) => {
    if (!m.played || m.bye) return;
    const s1 = Number(m.s1 || 0);
    const s2 = Number(m.s2 || 0);
    const a = table[m.p1];
    const b = table[m.p2];
    if (!a || !b) return;
    a.played++; b.played++;
    a.gf += s1; a.ga += s2;
    b.gf += s2; b.ga += s1;
    if (s1 > s2) { a.w++; b.l++; a.pts += 3; }
    else if (s2 > s1) { b.w++; a.l++; b.pts += 3; }
    else { a.d++; b.d++; a.pts += 1; b.pts += 1; }
  });
  return Object.values(table).sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    const gdX = x.gf - x.ga, gdY = y.gf - y.ga;
    if (gdY !== gdX) return gdY - gdX;
    if (y.gf !== x.gf) return y.gf - x.gf;
    return x.name.localeCompare(y.name);
  });
}

export function computeTopScorers(players, goals) {
  const counts = {};
  players.forEach((p) => { counts[p.id] = { id: p.id, name: p.name, goals: 0 }; });
  goals.forEach((g) => { if (counts[g.playerId]) counts[g.playerId].goals++; });
  return Object.values(counts).filter((c) => c.goals > 0).sort((a, b) => b.goals - a.goals);
}

export function computeMinuteBuckets(goals) {
  if (!goals.length) return [];
  const buckets = {};
  goals.forEach((g) => {
    const m = Math.floor(g.second / 60);
    buckets[m] = (buckets[m] || 0) + 1;
  });
  const max = Math.max(...Object.keys(buckets).map(Number));
  return Array.from({ length: max + 1 }, (_, m) => ({ label: `${m}-${m + 1}m`, goals: buckets[m] || 0 }));
}
