import { describe, it, expect } from "vitest";
import chaos from "../src/modes/chaos.jsx";
import { TWISTS, RETIRED_TWISTS, TIER_2, TIER_3, TWIST_TIPS, dealTwists, twistOf, tierOf, tipOf } from "../src/engine/twists.js";

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

  it("never repeats a twist within one pass through the deck", () => {
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

  it("deals 20 distinct twists across a 5-player, 2-leg Chaos Cup", () => {
    const { matches } = chaos.createFixtures({ players: players(5), config: { chaosLegs: 2 }, rng: seededRng(9) });
    expect(matches).toHaveLength(20); // 5 players, two legs: 10 per leg
    expect(new Set(matches.map((m) => m.twist)).size).toBe(20);
  });
});

describe("the twist deck", () => {
  it("has grown to at least 30 twists", () => {
    expect(TWISTS.length).toBeGreaterThanOrEqual(30);
  });

  it("has skill twists: a fake shot, two fakes in a row, and a skill finish", () => {
    for (const key of ["fake-shot", "double-fake", "skill-goal"]) expect(TWISTS.some((t) => t.key === key)).toBe(true);
  });

  it("never reuses a retired twist's key", () => {
    const all = [...TWISTS, ...RETIRED_TWISTS].map((t) => t.key);
    expect(new Set(all).size).toBe(all.length);
  });

  it("has unique keys, labels and emoji", () => {
    expect(new Set(TWISTS.map((t) => t.key)).size).toBe(TWISTS.length);
    expect(new Set(TWISTS.map((t) => t.label)).size).toBe(TWISTS.length);
    expect(new Set(TWISTS.map((t) => t.emoji)).size).toBe(TWISTS.length);
  });

  it("keeps every label short enough for TwistBanner and every detail non-empty", () => {
    expect(TWISTS.every((t) => t.label.length <= 22)).toBe(true);
    expect(TWISTS.every((t) => t.detail.length > 0)).toBe(true);
  });

  it("keeps the original ten keys resolvable, live or retired", () => {
    const original = [
      "weak-foot",
      "one-touch",
      "sitting-keeper",
      "silent",
      "slow-mo",
      "swap-ends",
      "long-range",
      "hop-start",
      "no-looking",
      "commentator",
    ];
    original.forEach((key) => expect(twistOf(key)?.key).toBe(key));
  });

  it("never deals a retired twist, and never lists a key as both live and retired", () => {
    const retired = new Set(RETIRED_TWISTS.map((t) => t.key));
    expect(TWISTS.some((t) => retired.has(t.key))).toBe(false);
    expect(dealTwists(TWISTS.length * 3, seededRng(17)).some((k) => retired.has(k))).toBe(false);
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

describe("chaos tiers and the climbing deal", () => {
  const liveKeys = new Set(TWISTS.map((t) => t.key));

  it("only lists live twists in the tier sets, so a typo can't hide", () => {
    for (const key of [...TIER_2, ...TIER_3]) expect(liveKeys.has(key), key).toBe(true);
    expect([...TIER_2].filter((k) => TIER_3.has(k))).toEqual([]);
  });

  it("gives every tier plenty of twists to draw from", () => {
    for (const tier of [1, 2, 3]) expect(TWISTS.filter((t) => tierOf(t.key) === tier).length).toBeGreaterThanOrEqual(15);
  });

  it("has a short how-to for skill moves, and only for live twists", () => {
    for (const key of ["fake-shot", "double-fake", "skill-goal", "stepover"]) expect(tipOf(key)).toBeTruthy();
    expect(Object.keys(TWIST_TIPS).filter((k) => !liveKeys.has(k))).toEqual([]);
    expect(Object.values(TWIST_TIPS).filter((t) => t.length > 90)).toEqual([]);
    expect(tipOf("weak-foot")).toBeNull();
  });

  it("deals tier 1 first, tier 2 in the middle and tier 3 last", () => {
    for (const seed of [1, 2, 3]) {
      const tiers = dealTwists(30, seededRng(seed), "climb").map(tierOf);
      expect(tiers.slice(0, 10).every((t) => t === 1)).toBe(true);
      expect(tiers.slice(10, 20).every((t) => t === 2)).toBe(true);
      expect(tiers.slice(20).every((t) => t === 3)).toBe(true);
    }
  });

  it("never repeats a twist while a tier still has an unused one", () => {
    const dealt = dealTwists(45, seededRng(5), "climb");
    expect(new Set(dealt).size).toBe(45);
  });

  it("is deterministic under a seeded rng, and leaves the random deal alone", () => {
    expect(dealTwists(12, seededRng(9), "climb")).toEqual(dealTwists(12, seededRng(9), "climb"));
    expect(dealTwists(12, seededRng(9))).toEqual(dealTwists(12, seededRng(9), "random"));
  });

  it("chaos.createFixtures climbs by default and stamps each match's level", () => {
    const { matches } = chaos.createFixtures({ players: players(4), config: { chaosLegs: 1 }, rng: seededRng(3) });
    expect(matches.map((m) => m.tier)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(matches.every((m) => tierOf(m.twist) === m.tier)).toBe(true);
  });

  it("chaos.createFixtures stamps no level when the order is mixed up", () => {
    const { matches } = chaos.createFixtures({ players: players(4), config: { chaosLegs: 1, chaosOrder: "random" }, rng: seededRng(3) });
    expect(matches.every((m) => m.tier === undefined)).toBe(true);
  });
});
