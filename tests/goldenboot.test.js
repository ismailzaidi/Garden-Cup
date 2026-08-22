import { describe, it, expect } from "vitest";
import goldenboot, { computeGoalTotals, advance } from "../src/modes/goldenboot.jsx";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const A = { id: "a", name: "Alice" };
const B = { id: "b", name: "Bob" };
const D = { id: "d", name: "Dara" };
const m = (id, p1, p2, s1, s2, played = true, leg = 1) => ({ id, stage: "goldenboot", leg, p1, p2, s1: String(s1), s2: String(s2), played });

describe("computeGoalTotals", () => {
  it("counts only played matches", () => {
    const matches = [m("1", "a", "b", 3, 1), m("2", "a", "b", 5, 5, false)];
    const totals = computeGoalTotals([A, B], matches);
    expect(totals.find((t) => t.id === "a").goals).toBe(3);
    expect(totals.find((t) => t.id === "b").goals).toBe(1);
  });

  it("credits each player the goals they scored, not the ones they conceded", () => {
    const matches = [m("1", "a", "b", 2, 4), m("2", "b", "a", 1, 6)];
    const totals = computeGoalTotals([A, B], matches);
    expect(totals.find((t) => t.id === "a").goals).toBe(8); // 2 + 6
    expect(totals.find((t) => t.id === "b").goals).toBe(5); // 4 + 1
  });

  it("sorts by goals descending, breaking ties by name", () => {
    const matches = [m("1", "a", "b", 2, 2)];
    expect(computeGoalTotals([B, A], matches).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("goldenboot.champion", () => {
  const champ = (matches, target = 5) => goldenboot.champion({ players: [A, B], matches, config: { bootTarget: target }, modeState: {} });

  it("is null while nobody has reached the target", () => {
    expect(champ([m("1", "a", "b", 4, 0)])).toBeNull();
  });

  it("crowns the unique leader as soon as the target is reached, mid-tournament", () => {
    // Alice hits 5 with a match still unplayed — it's a race, not a league.
    const matches = [m("1", "a", "b", 5, 0), m("2", "a", "b", 0, 0, false)];
    expect(champ(matches).id).toBe("a");
  });

  it("is null when two players are tied at the top on or above the target", () => {
    expect(champ([m("1", "a", "b", 6, 6)])).toBeNull();
  });
});

describe("goldenboot.advance", () => {
  const run = (matches, players = [A, B], target = 5) =>
    advance({ players, matches, config: { bootTarget: target }, modeState: {}, rng: seededRng(9) });

  it("is a no-op while any match is unplayed", () => {
    const matches = [m("1", "a", "b", 1, 0), m("2", "a", "b", 0, 0, false)];
    expect(run(matches).matches).toBe(matches);
  });

  it("is a no-op once there is a champion", () => {
    const matches = [m("1", "a", "b", 5, 0)];
    expect(run(matches).matches).toBe(matches);
  });

  it("adds a full extra round when nobody has reached the target", () => {
    const matches = [m("1", "a", "b", 1, 0)];
    const next = run(matches, [A, B, D]).matches;
    expect(next).toHaveLength(1 + 3); // three players => three new pairings
    expect(next.slice(1).every((x) => x.stage === "goldenboot" && x.leg === 2)).toBe(true);
  });

  it("replays only the tied players when they are level at or above the target", () => {
    // Alice and Bob both on 6, Dara on 0 — Dara sits the tiebreaker out.
    const matches = [m("1", "a", "b", 6, 6), m("2", "a", "d", 0, 0), m("3", "b", "d", 0, 0)];
    const extra = run(matches, [A, B, D]).matches.slice(3);
    expect(extra).toHaveLength(1);
    expect([extra[0].p1, extra[0].p2].sort()).toEqual(["a", "b"]);
  });

  it("continues leg numbering from the last leg", () => {
    const matches = [m("1", "a", "b", 1, 0, true, 1), m("2", "a", "b", 0, 1, true, 2)];
    expect(run(matches).matches.slice(2)[0].leg).toBe(3);
  });
});

describe("goldenboot.createFixtures", () => {
  it("stamps stage 'goldenboot' on a single round robin leg", () => {
    const { matches, initialTab } = goldenboot.createFixtures({ players: [A, B, D], config: {}, rng: seededRng(2) });
    expect(matches).toHaveLength(3);
    expect(matches.every((x) => x.stage === "goldenboot" && x.leg === 1)).toBe(true);
    expect(initialTab).toBe("race");
  });
});
