import { describe, it, expect } from "vitest";
import { generateKnockoutRound1 } from "../src/engine/bracket.js";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("generateKnockoutRound1", () => {
  it("pairs everyone with no bye for a power-of-two count", () => {
    const players = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const round = generateKnockoutRound1(players, seededRng(1));
    expect(round).toHaveLength(2);
    expect(round.every((m) => !m.bye && m.p2 !== null)).toBe(true);
  });

  it("creates exactly one bye for an odd count, carrying p2: null and played: true", () => {
    const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const round = generateKnockoutRound1(players, seededRng(2));
    const byes = round.filter((m) => m.bye);
    expect(byes).toHaveLength(1);
    expect(byes[0]).toMatchObject({ p2: null, played: true });
    expect(round.filter((m) => !m.bye)).toHaveLength(1);
  });

  it("pads to the next power of two — 5 players make 2 real matches and one bye", () => {
    // size pads to 8 (5 real + 3 null slots); pairing walks the 8 slots two at a
    // time, so the trailing null+null pair produces no match at all.
    const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` }));
    const round = generateKnockoutRound1(players, seededRng(3));
    expect(round.filter((m) => m.bye)).toHaveLength(1);
    expect(round.filter((m) => !m.bye)).toHaveLength(2);
    expect(round).toHaveLength(3);
  });

  it("every player appears exactly once across round 1", () => {
    const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}` }));
    const round = generateKnockoutRound1(players, seededRng(4));
    const seen = round.flatMap((m) => [m.p1, m.p2]).filter(Boolean);
    expect(seen.sort()).toEqual(players.map((p) => p.id).sort());
  });
});
