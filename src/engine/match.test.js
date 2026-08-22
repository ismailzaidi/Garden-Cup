import { describe, it, expect } from "vitest";
import { matchWinner, generateGroupMatches, makeId, roundLabel } from "./match.js";

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
