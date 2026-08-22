import { describe, it, expect } from "vitest";
import penalties, { advance } from "../src/modes/penalties.jsx";
import { advanceBracket, bracketChampion } from "../src/engine/bracket.js";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

describe("penalties.createFixtures", () => {
  it("stamps stage 'pens' on every match, byes included", () => {
    const { matches } = penalties.createFixtures({ players: players(5), config: {}, rng: seededRng(3) });
    expect(matches.some((m) => m.bye)).toBe(true);
    expect(matches.every((m) => m.stage === "pens")).toBe(true);
  });
});

describe("penalties.advance", () => {
  it("keeps the next round in the pens stage rather than reverting to knockout", () => {
    const round1 = penalties.createFixtures({ players: players(4), config: {}, rng: seededRng(1) }).matches
      .map((m) => ({ ...m, s1: "5", s2: "4", played: true }));
    const next = advance({ matches: round1, rng: seededRng(2) }).matches;
    const round2 = next.filter((m) => m.round === 2);
    expect(round2).toHaveLength(1);
    expect(round2[0].stage).toBe("pens");
  });

  it("is a no-op while the round is undecided", () => {
    const round1 = penalties.createFixtures({ players: players(4), config: {}, rng: seededRng(1) }).matches;
    expect(advance({ matches: round1, rng: seededRng(2) }).matches).toBe(round1);
  });
});

describe("advanceBracket (shared)", () => {
  it("treats a level score as undecided — a shootout has to produce a winner", () => {
    const level = [{ id: "m1", stage: "pens", round: 1, p1: "a", p2: "b", s1: "5", s2: "5", played: true, bye: false },
      { id: "m2", stage: "pens", round: 1, p1: "c", p2: "d", s1: "5", s2: "4", played: true, bye: false }];
    expect(advanceBracket(level, "pens", seededRng(1))).toBe(level);
  });

  it("crowns the winner of a decided one-match final round", () => {
    const final = [{ id: "f", stage: "pens", round: 2, p1: "a", p2: "b", s1: "6", s2: "5", played: true, bye: false }];
    expect(bracketChampion([{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }], final).name).toBe("Alice");
  });
});
