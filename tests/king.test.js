import { describe, it, expect } from "vitest";
import { computeKingStreaks } from "../src/modes/king.jsx";

const m = (seq, p1, p2, s1, s2, played = true) => ({ id: `m${seq}`, stage: "king", seq, p1, p2, s1: String(s1), s2: String(s2), played });

describe("computeKingStreaks", () => {
  it("returns an empty result with no matches played", () => {
    expect(computeKingStreaks([])).toEqual({ best: {}, currentId: null, run: 0 });
  });

  it("a draw means the king defends — the streak continues for p1", () => {
    const matches = [m(1, "king", "challenger", 2, 2)];
    const streaks = computeKingStreaks(matches);
    expect(streaks.currentId).toBe("king");
    expect(streaks.run).toBe(1);
  });

  it("tracks best, currentId, and run across a sequence of results", () => {
    const matches = [
      m(1, "a", "b", 3, 1), // a wins, run=1
      m(2, "a", "c", 2, 0), // a wins, run=2
      m(3, "a", "d", 1, 1), // draw, a (king) defends, run=3
      m(4, "e", "a", 4, 1), // e wins (a loses as challenger... a is p2 here, e is p1) run resets to e, run=1
      m(5, "e", "f", 2, 2), // draw, e defends, run=2
    ];
    const streaks = computeKingStreaks(matches);
    expect(streaks.currentId).toBe("e");
    expect(streaks.run).toBe(2);
    expect(streaks.best).toEqual({ a: 3, e: 2 });
  });

  it("only considers played matches, and processes them in seq order regardless of input order", () => {
    const matches = [
      m(2, "a", "b", 1, 0),
      m(1, "b", "a", 1, 0),
      m(3, "a", "c", 0, 0, false), // unplayed, ignored
    ];
    const streaks = computeKingStreaks(matches);
    // seq1: b beats a (b is p1, wins) -> current b, run 1
    // seq2: a beats b (a is p1, wins) -> current a, run 1
    expect(streaks.currentId).toBe("a");
    expect(streaks.run).toBe(1);
    expect(streaks.best).toEqual({ b: 1, a: 1 });
  });
});
