import { describe, it, expect } from "vitest";
import bestofn from "../src/modes/bestofn.jsx";

const players = [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }];
const leg = (n, s1, s2, played = true) => ({ id: `m${n}`, stage: "bestofn", leg: n, p1: "a", p2: "b", s1: String(s1), s2: String(s2), played });

describe("bestofn champion", () => {
  it("has no champion before any legs are generated", () => {
    expect(bestofn.champion({ players, matches: [] })).toBeNull();
  });

  it("has no champion while legs remain unplayed", () => {
    const matches = [leg(1, 1, 0), leg(2, 0, 0, false)];
    expect(bestofn.champion({ players, matches })).toBeNull();
  });

  it("has no champion when all legs are played but points are level", () => {
    const matches = [leg(1, 1, 0), leg(2, 0, 1)];
    expect(bestofn.champion({ players, matches })).toBeNull();
  });

  it("crowns whoever has more points once every leg is played", () => {
    // a: win + draw + win = 7pts, b: loss + draw + loss = 1pt
    const matches = [leg(1, 2, 0), leg(2, 1, 1), leg(3, 3, 1)];
    const champion = bestofn.champion({ players, matches });
    expect(champion.id).toBe("a");
  });
});
