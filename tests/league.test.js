import { describe, it, expect } from "vitest";
import league, { advance } from "../src/modes/league.jsx";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

// A played group match, so a table can be built without a full playthrough.
const group = (p1, p2, s1, s2, played = true) => ({ id: `g${p1}${p2}`, stage: "group", leg: 1, p1, p2, s1: String(s1), s2: String(s2), played });

describe("league.createFixtures", () => {
  it("stamps its own group stage", () => {
    const { matches, initialTab } = league.createFixtures({ players: players(4), config: { legCount: 1 }, rng: seededRng(3) });
    expect(matches).toHaveLength(6);
    expect(matches.every((m) => m.stage === "group")).toBe(true);
    expect(initialTab).toBe("fixtures");
  });
});

describe("league.advance", () => {
  // p0 leads on points, p1 second, p2 bottom
  const groupMatches = [group("p0", "p1", 3, 0), group("p0", "p2", 3, 0), group("p1", "p2", 2, 0)];

  it("ignores the group stage's legCount and builds the final from finalLegs", () => {
    const result = advance({ players: players(3), matches: groupMatches, config: { legCount: 4, finalLegs: 1 }, rng: seededRng(9) });
    const final = result.matches.filter((m) => m.stage === "final");
    expect(final).toHaveLength(1);
    expect(new Set(final.flatMap((m) => [m.p1, m.p2]))).toEqual(new Set(["p0", "p1"]));
    expect(result.tab).toBe("final");
  });

  it("builds a three-leg final, home alternating, regardless of a one-leg group stage", () => {
    const final = advance({ players: players(3), matches: groupMatches, config: { legCount: 1, finalLegs: 3 }, rng: seededRng(9) })
      .matches.filter((m) => m.stage === "final");
    expect(final).toHaveLength(3);
    expect(final[1].p1).toBe(final[0].p2);
    expect(final[2].p1).toBe(final[0].p1);
  });

  it("defaults the final to three legs when finalLegs isn't set", () => {
    const final = advance({ players: players(3), matches: groupMatches, config: {}, rng: seededRng(9) })
      .matches.filter((m) => m.stage === "final");
    expect(final).toHaveLength(3);
  });

  it("keeps the group stage intact and replaces an earlier final rather than appending", () => {
    const once = advance({ players: players(3), matches: groupMatches, config: { finalLegs: 1 }, rng: seededRng(9) });
    const twice = advance({ players: players(3), matches: once.matches, config: { finalLegs: 1 }, rng: seededRng(31) });
    expect(twice.matches.filter((m) => m.stage === "group")).toHaveLength(3);
    expect(twice.matches.filter((m) => m.stage === "final")).toHaveLength(1);
  });

  it("returns the state unchanged when there aren't two players to promote", () => {
    const matches = [group("p0", "p1", 1, 0, false)];
    const result = advance({ players: [{ id: "p0", name: "P0" }], matches, config: {}, rng: seededRng(2) });
    expect(result.matches).toBe(matches);
    expect(result.tab).toBe("standings");
  });
});

describe("league.champion", () => {
  const ps = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  const final = (p1, p2, s1, s2, played = true) => ({ id: `f${p1}${p2}`, stage: "final", leg: 1, p1, p2, s1: String(s1), s2: String(s2), played });

  it("is null before a final has been set up", () => {
    expect(league.champion({ players: ps, matches: [group("a", "b", 3, 0)], config: {}, modeState: {} })).toBeNull();
  });

  it("is null while the (only) final leg is unplayed", () => {
    expect(league.champion({ players: ps, matches: [final("a", "b", 0, 0, false)], config: {}, modeState: {} })).toBeNull();
  });

  it("is null when a one-leg final is drawn", () => {
    expect(league.champion({ players: ps, matches: [final("a", "b", 1, 1)], config: {}, modeState: {} })).toBeNull();
  });

  it("crowns the winner of a one-leg final", () => {
    expect(league.champion({ players: ps, matches: [final("a", "b", 2, 0)], config: {}, modeState: {} }).id).toBe("a");
  });

  it("crowns a best-of-3 champion 2-0 up with the third leg unplayed", () => {
    const matches = [
      final("a", "b", 2, 0),
      { ...final("b", "a", 0, 1), id: "f2" },
      { ...final("a", "b", 0, 0, false), id: "f3" },
    ];
    expect(league.champion({ players: ps, matches, config: {}, modeState: {} }).id).toBe("a");
  });

  it("is null for a level best-of-3 (win-loss-draw)", () => {
    const matches = [
      final("a", "b", 1, 0),
      { ...final("b", "a", 1, 0), id: "f2" },
      { ...final("a", "b", 1, 1), id: "f3" },
    ];
    expect(league.champion({ players: ps, matches, config: {}, modeState: {} })).toBeNull();
  });
});
