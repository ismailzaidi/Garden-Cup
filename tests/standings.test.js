import { describe, it, expect } from "vitest";
import { computeStandings, computeTopScorers, computeMinuteBuckets, computeCardCounts } from "../src/engine/standings.js";

const p = (id, name) => ({ id, name });
const played = (p1, p2, s1, s2, extra = {}) => ({ id: `${p1}-${p2}`, stage: "group", p1, p2, s1: String(s1), s2: String(s2), played: true, ...extra });

describe("computeStandings", () => {
  it("awards 3 points for a win, 1 each for a draw, tracks gf/ga", () => {
    const players = [p("a", "Alice"), p("b", "Bob")];
    const matches = [played("a", "b", 3, 1)];
    const table = computeStandings(players, matches);
    const alice = table.find((x) => x.id === "a");
    const bob = table.find((x) => x.id === "b");
    expect(alice).toMatchObject({ played: 1, w: 1, d: 0, l: 0, gf: 3, ga: 1, pts: 3 });
    expect(bob).toMatchObject({ played: 1, w: 0, d: 0, l: 1, gf: 1, ga: 3, pts: 0 });
  });

  it("sorts by points, then goal difference, then goals for, then name", () => {
    const players = [p("a", "Zed"), p("b", "Amy"), p("c", "Charlie")];
    // Zed: 3pts, gd +2, gf 3 | Amy: 3pts, gd +2, gf 2 | Charlie: 0pts
    const matches = [
      played("a", "c", 3, 1), // Zed gf3 ga1 -> gd+2
      played("b", "c", 2, 0), // Amy gf2 ga0 -> gd+2
    ];
    const table = computeStandings(players, matches);
    expect(table.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks a full tie (points, gd, gf all equal) by name", () => {
    const players = [p("a", "Zed"), p("b", "Amy")];
    const matches = [played("a", "x", 2, 0), played("b", "y", 2, 0)];
    // both unrelated to each other, identical stats, no "x"/"y" in players so those rows are skipped
    const table = computeStandings(players, matches);
    expect(table.map((x) => x.name)).toEqual(["Amy", "Zed"]);
  });

  it("excludes byes and unplayed matches", () => {
    const players = [p("a", "Alice"), p("b", "Bob")];
    const matches = [
      { id: "1", stage: "knockout", p1: "a", p2: null, s1: "0", s2: "0", played: true, bye: true },
      played("a", "b", 0, 0, { played: false }),
    ];
    const table = computeStandings(players, matches);
    expect(table.find((x) => x.id === "a")).toMatchObject({ played: 0, pts: 0 });
    expect(table.find((x) => x.id === "b")).toMatchObject({ played: 0, pts: 0 });
  });
});

describe("computeTopScorers", () => {
  it("filters out players with zero goals and sorts descending", () => {
    const players = [p("a", "Alice"), p("b", "Bob"), p("c", "Cid")];
    const goals = [
      { playerId: "a" }, { playerId: "a" }, { playerId: "a" },
      { playerId: "b" },
    ];
    const scorers = computeTopScorers(players, goals);
    expect(scorers).toEqual([
      { id: "a", name: "Alice", goals: 3 },
      { id: "b", name: "Bob", goals: 1 },
    ]);
  });
});

describe("computeMinuteBuckets", () => {
  it("returns [] for no goals", () => {
    expect(computeMinuteBuckets([])).toEqual([]);
  });

  it("buckets by Math.floor(second / 60), filling gaps up to the max", () => {
    const goals = [{ second: 5 }, { second: 65 }, { second: 190 }];
    const buckets = computeMinuteBuckets(goals);
    expect(buckets).toEqual([
      { label: "0-1m", goals: 1 },
      { label: "1-2m", goals: 1 },
      { label: "2-3m", goals: 0 },
      { label: "3-4m", goals: 1 },
    ]);
  });
});

describe("computeStandings with red cards", () => {
  const two = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  const m = (extra) => ({ id: "m", p1: "a", p2: "b", s1: "2", s2: "0", played: true, ...extra });

  it("docks the points a red card cost, leaving the result and goals alone", () => {
    const [first, second] = computeStandings(two, [m({ d1: 3 })]);
    // A won 2-0 and was docked the 3 points: level on 0, ahead on goal difference
    expect(first).toMatchObject({ id: "a", w: 1, gf: 2, pts: 0 });
    expect(second).toMatchObject({ id: "b", l: 1, pts: 0 });
  });

  it("can take a player below zero", () => {
    const table = computeStandings(two, [m({ d2: 3 })]);
    expect(table.find((r) => r.id === "b").pts).toBe(-3);
  });

  it("docks nothing until the match is played", () => {
    expect(computeStandings(two, [m({ d1: 3, played: false })]).every((r) => r.pts === 0)).toBe(true);
  });
});

describe("computeCardCounts", () => {
  const three = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];

  it("adds up each player's yellows and reds across matches, home or away", () => {
    const matches = [
      { id: "1", p1: "a", p2: "b", c1: 2, r2: 1 },
      { id: "2", p1: "b", p2: "a", c2: 1, c1: 1 },
    ];
    expect(computeCardCounts(three, matches)).toEqual([
      { id: "b", name: "B", yellow: 1, red: 1 },
      { id: "a", name: "A", yellow: 3, red: 0 },
    ]);
  });

  it("leaves out players who were never shown a card", () => {
    expect(computeCardCounts(three, [{ id: "1", p1: "a", p2: "b" }])).toEqual([]);
  });
});
