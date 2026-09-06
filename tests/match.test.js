import { describe, it, expect } from "vitest";
import { matchWinner, generateGroupMatches, alternateHome, makeId, roundLabel } from "../src/engine/match.js";

// Deterministic PRNG for reproducible fixture-generation tests.
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("matchWinner", () => {
  it("returns p1 for a bye", () => {
    expect(matchWinner({ bye: true, p1: "a", p2: null, played: true, s1: "0", s2: "0" })).toBe("a");
  });

  it("returns null for an unplayed match", () => {
    expect(matchWinner({ p1: "a", p2: "b", played: false, s1: "0", s2: "0" })).toBeNull();
  });

  it("returns null for a draw", () => {
    expect(matchWinner({ p1: "a", p2: "b", played: true, s1: "2", s2: "2" })).toBeNull();
  });

  it("returns the higher scorer", () => {
    expect(matchWinner({ p1: "a", p2: "b", played: true, s1: "3", s2: "1" })).toBe("a");
    expect(matchWinner({ p1: "a", p2: "b", played: true, s1: "1", s2: "3" })).toBe("b");
  });
});

describe("makeId", () => {
  it("always returns exactly 8 characters", () => {
    for (let i = 0; i < 200; i++) expect(makeId()).toHaveLength(8);
  });
});

describe("roundLabel", () => {
  it("names the last rounds and falls back to a round-of-N label", () => {
    expect(roundLabel(1)).toBe("FINAL");
    expect(roundLabel(2)).toBe("SEMI-FINAL");
    expect(roundLabel(4)).toBe("QUARTER-FINAL");
    expect(roundLabel(8)).toBe("ROUND OF 16");
  });
});

describe("generateGroupMatches", () => {
  const players = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("creates n(n-1)/2 pairings per leg", () => {
    const legs = 3;
    const matches = generateGroupMatches(players, legs, seededRng(42));
    expect(matches).toHaveLength(((players.length * (players.length - 1)) / 2) * legs);
  });

  it("plays every pairing exactly once per leg", () => {
    const matches = generateGroupMatches(players, 2, seededRng(7));
    for (let leg = 1; leg <= 2; leg++) {
      const legMatches = matches.filter((m) => m.leg === leg);
      const pairKeys = legMatches.map((m) => [m.p1, m.p2].sort().join(":"));
      const expectedPairs = [];
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) expectedPairs.push([players[i].id, players[j].id].sort().join(":"));
      }
      expect(pairKeys.sort()).toEqual(expectedPairs.sort());
    }
  });

  it("is reproducible for a fixed rng seed", () => {
    const a = generateGroupMatches(players, 1, seededRng(99)).map((m) => [m.p1, m.p2]);
    const b = generateGroupMatches(players, 1, seededRng(99)).map((m) => [m.p1, m.p2]);
    expect(a).toEqual(b);
  });
});

/* p1 is the home side — it kicks off and wears the HOME tag — so these guard
   the promise that nobody sits through a whole tournament away from home.
   They sweep seeds rather than trusting one lucky draw. */
function homeAwayCounts(players, matches) {
  const counts = new Map(players.map((p) => [p.id, { home: 0, away: 0 }]));
  matches.forEach((m) => {
    counts.get(m.p1).home++;
    counts.get(m.p2).away++;
  });
  return counts;
}

const roster = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

describe("generateGroupMatches home/away balance", () => {
  it("gives every player at least one home match, for every roster and leg count", () => {
    for (let size = 3; size <= 8; size++) {
      for (let legs = 1; legs <= 3; legs++) {
        for (let seed = 1; seed <= 30; seed++) {
          const ps = roster(size);
          const counts = homeAwayCounts(ps, generateGroupMatches(ps, legs, seededRng(seed)));
          for (const [id, { home }] of counts) {
            expect(home, `${size} players, ${legs} legs, seed ${seed}: ${id} never started at home`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("keeps each player's home and away counts within one of each other", () => {
    for (let size = 3; size <= 8; size++) {
      for (let legs = 1; legs <= 3; legs++) {
        for (let seed = 1; seed <= 30; seed++) {
          const ps = roster(size);
          const counts = homeAwayCounts(ps, generateGroupMatches(ps, legs, seededRng(seed)));
          for (const [id, { home, away }] of counts) {
            expect(Math.abs(home - away), `${size} players, ${legs} legs, seed ${seed}: ${id} had ${home} home, ${away} away`).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("splits a two-player pair evenly once they play an even number of legs", () => {
    const ps = roster(2);
    const counts = homeAwayCounts(ps, generateGroupMatches(ps, 2, seededRng(4)));
    for (const [, { home, away }] of counts) {
      expect(home).toBe(1);
      expect(away).toBe(1);
    }
  });

  it("still lets one side start away when the whole tournament is a single match", () => {
    // Two players, one leg: unavoidable, and the only case where a player
    // can go a tournament without a home start.
    const ps = roster(2);
    const matches = generateGroupMatches(ps, 1, seededRng(4));
    expect(matches).toHaveLength(1);
    const homes = [...homeAwayCounts(ps, matches).values()].map((c) => c.home).sort();
    expect(homes).toEqual([0, 1]);
  });

  it("varies which player hosts most from seed to seed", () => {
    // The balance rule must not hand the advantage to whoever was added
    // first every time — the seating draw is what randomises it.
    const ps = roster(3);
    const firstIsHomeFirst = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      firstIsHomeFirst.add(generateGroupMatches(ps, 1, seededRng(seed))[0].p1);
    }
    expect(firstIsHomeFirst.size).toBeGreaterThan(1);
  });
});

describe("alternateHome", () => {
  const a = { id: "a", name: "A" };
  const b = { id: "b", name: "B" };

  it("swaps the home side every leg", () => {
    const legs = alternateHome(a, b, 5, seededRng(2));
    expect(legs).toHaveLength(5);
    legs.forEach(([home, away], i) => {
      expect(home.id).toBe(legs[0][i % 2 === 0 ? 0 : 1].id);
      expect(away.id).not.toBe(home.id);
    });
  });

  it("gives both players a home leg in any series of two or more", () => {
    for (let legCount = 2; legCount <= 7; legCount++) {
      for (let seed = 1; seed <= 20; seed++) {
        const homes = new Set(alternateHome(a, b, legCount, seededRng(seed)).map(([home]) => home.id));
        expect(homes).toEqual(new Set(["a", "b"]));
      }
    }
  });

  it("picks the first host at random but reproducibly", () => {
    // Widely spaced seeds: this PRNG's *first* draw moves very little
    // between neighbouring seeds, and the first host is decided on it.
    const ids = new Set();
    for (let seed = 1; seed <= 30; seed++) ids.add(alternateHome(a, b, 3, seededRng(seed * 1009))[0][0].id);
    expect(ids).toEqual(new Set(["a", "b"]));
    expect(alternateHome(a, b, 3, seededRng(8))).toEqual(alternateHome(a, b, 3, seededRng(8)));
  });
});
