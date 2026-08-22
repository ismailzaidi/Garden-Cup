import { describe, it, expect } from "vitest";
import chaos, { TWISTS, dealTwists, twistOf } from "../src/modes/chaos.jsx";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

describe("dealTwists", () => {
  it("is deterministic under a seeded rng", () => {
    expect(dealTwists(8, seededRng(7))).toEqual(dealTwists(8, seededRng(7)));
  });

  it("never repeats a twist within the first ten matches", () => {
    const dealt = dealTwists(TWISTS.length, seededRng(11));
    expect(new Set(dealt).size).toBe(TWISTS.length);
  });

  it("reshuffles once the deck is exhausted rather than running out", () => {
    const dealt = dealTwists(TWISTS.length + 5, seededRng(13));
    expect(dealt).toHaveLength(TWISTS.length + 5);
    expect(dealt.every((k) => twistOf(k) !== null)).toBe(true);
  });
});

describe("chaos.createFixtures", () => {
  it("stamps stage 'chaos' and a resolvable twist on every match", () => {
    const { matches } = chaos.createFixtures({ players: players(4), config: { chaosLegs: 1 }, rng: seededRng(3) });
    expect(matches).toHaveLength(6); // 4 players, one leg
    expect(matches.every((m) => m.stage === "chaos")).toBe(true);
    expect(matches.every((m) => twistOf(m.twist) !== null)).toBe(true);
  });

  it("keeps the leg field so the view can group by leg", () => {
    const { matches } = chaos.createFixtures({ players: players(3), config: { chaosLegs: 2 }, rng: seededRng(5) });
    expect(matches.filter((m) => m.leg === 1)).toHaveLength(3);
    expect(matches.filter((m) => m.leg === 2)).toHaveLength(3);
  });
});

describe("chaos.champion", () => {
  const m = (p1, p2, s1, s2, played = true) => ({ id: `${p1}${p2}`, stage: "chaos", leg: 1, p1, p2, s1: String(s1), s2: String(s2), played });

  it("is null while any match is unplayed", () => {
    const ps = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
    expect(chaos.champion({ players: ps, matches: [m("a", "b", 3, 0, false)], config: {}, modeState: {} })).toBeNull();
  });

  it("is null when the top two are level on points, mirroring Pure League", () => {
    const ps = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
    // one win each: 3 pts apiece
    const matches = [m("a", "b", 1, 0), { ...m("b", "a", 1, 0), id: "ba" }];
    expect(chaos.champion({ players: ps, matches, config: {}, modeState: {} })).toBeNull();
  });

  it("returns the clear points leader once everything is played", () => {
    const ps = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
    const champ = chaos.champion({ players: ps, matches: [m("a", "b", 2, 0)], config: {}, modeState: {} });
    expect(champ.id).toBe("a");
  });
});
