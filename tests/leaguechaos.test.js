import { describe, it, expect } from "vitest";
import leaguechaos, { advance } from "../src/modes/leaguechaos.jsx";
import { TWISTS, twistOf } from "../src/engine/twists.js";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

// A played group match, so a table can be built without a full playthrough.
const group = (p1, p2, s1, s2, played = true) => ({ id: `g${p1}${p2}`, stage: "lcgroup", leg: 1, p1, p2, s1: String(s1), s2: String(s2), played });

describe("leaguechaos.createFixtures", () => {
  it("stamps its own group stage and deals no twists before the final", () => {
    const { matches, initialTab } = leaguechaos.createFixtures({ players: players(4), config: { legCount: 1 }, rng: seededRng(3) });
    expect(matches).toHaveLength(6);
    expect(matches.every((m) => m.stage === "lcgroup")).toBe(true);
    expect(matches.some((m) => m.twist)).toBe(false);
    expect(initialTab).toBe("fixtures");
  });

  it("keeps the leg field so the fixtures list can group by leg", () => {
    const { matches } = leaguechaos.createFixtures({ players: players(3), config: { legCount: 2 }, rng: seededRng(5) });
    expect(matches.filter((m) => m.leg === 1)).toHaveLength(3);
    expect(matches.filter((m) => m.leg === 2)).toHaveLength(3);
  });
});

describe("leaguechaos.advance", () => {
  // p0 leads on points, p1 second, p2 bottom
  const groupMatches = [group("p0", "p1", 3, 0), group("p0", "p2", 3, 0), group("p1", "p2", 2, 0)];

  it("sends the top two into the final and deals every leg a twist", () => {
    const result = advance({ players: players(3), matches: groupMatches, config: { legCount: 3 }, rng: seededRng(9) });
    const final = result.matches.filter((m) => m.stage === "lcfinal");
    expect(final).toHaveLength(3);
    expect(final.every((m) => twistOf(m.twist) !== null)).toBe(true);
    expect(new Set(final.flatMap((m) => [m.p1, m.p2]))).toEqual(new Set(["p0", "p1"]));
    expect(result.tab).toBe("final");
  });

  it("never repeats a twist within one deal of the final", () => {
    const result = advance({ players: players(3), matches: groupMatches, config: { legCount: 4 }, rng: seededRng(21) });
    const dealt = result.matches.filter((m) => m.stage === "lcfinal").map((m) => m.twist);
    expect(dealt).toHaveLength(4);
    expect(new Set(dealt).size).toBe(4);
    expect(dealt.length).toBeLessThanOrEqual(TWISTS.length);
  });

  it("alternates the home side across the final's legs", () => {
    const final = advance({ players: players(3), matches: groupMatches, config: { legCount: 3 }, rng: seededRng(9) })
      .matches.filter((m) => m.stage === "lcfinal");
    expect(final[1].p1).toBe(final[0].p2);
    expect(final[2].p1).toBe(final[0].p1);
  });

  it("keeps the group stage intact and replaces an earlier final rather than appending", () => {
    const once = advance({ players: players(3), matches: groupMatches, config: { legCount: 2 }, rng: seededRng(9) });
    const twice = advance({ players: players(3), matches: once.matches, config: { legCount: 2 }, rng: seededRng(31) });
    expect(twice.matches.filter((m) => m.stage === "lcgroup")).toHaveLength(3);
    expect(twice.matches.filter((m) => m.stage === "lcfinal")).toHaveLength(2);
  });

  it("returns the state unchanged when there aren't two players to promote", () => {
    const matches = [group("p0", "p1", 1, 0, false)];
    const result = advance({ players: [{ id: "p0", name: "P0" }], matches, config: {}, rng: seededRng(2) });
    expect(result.matches).toBe(matches);
    expect(result.tab).toBe("standings");
  });
});

describe("leaguechaos.champion", () => {
  const ps = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  const final = (p1, p2, s1, s2, played = true) => ({ id: `f${p1}${p2}`, stage: "lcfinal", leg: 1, p1, p2, s1: String(s1), s2: String(s2), played, twist: "silent" });

  it("is null before a final has been dealt", () => {
    expect(leaguechaos.champion({ players: ps, matches: [group("a", "b", 3, 0)], config: {}, modeState: {} })).toBeNull();
  });

  it("is null while a final leg is unplayed", () => {
    const matches = [final("a", "b", 2, 0), { ...final("b", "a", 0, 0, false), id: "f2" }];
    expect(leaguechaos.champion({ players: ps, matches, config: {}, modeState: {} })).toBeNull();
  });

  it("is null when the final is level on points", () => {
    const matches = [final("a", "b", 1, 0), { ...final("b", "a", 1, 0), id: "f2" }];
    expect(leaguechaos.champion({ players: ps, matches, config: {}, modeState: {} })).toBeNull();
  });

  it("crowns the winner of the final, ignoring the group table", () => {
    // b lost the group stage but wins the final — the final is what counts
    const matches = [group("a", "b", 5, 0), final("b", "a", 2, 0)];
    expect(leaguechaos.champion({ players: ps, matches, config: {}, modeState: {} }).id).toBe("b");
  });
});
