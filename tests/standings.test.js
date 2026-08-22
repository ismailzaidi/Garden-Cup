import { describe, it, expect } from "vitest";
import { computeStandings, computeTopScorers, computeMinuteBuckets } from "../src/engine/standings.js";

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
