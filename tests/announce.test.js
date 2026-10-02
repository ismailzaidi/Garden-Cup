import { describe, it, expect } from "vitest";
import { resultSentence, speakResult, RESULT_TEMPLATES } from "../src/engine/announce.js";

const NAMES = { p1: "Tom", p2: "Bob" };
const nameOf = (id) => NAMES[id];
const first = () => 0; // always picks RESULT_TEMPLATES[0]

function match(overrides) {
  return { id: "m1", p1: "p1", p2: "p2", s1: "0", s2: "0", played: true, ...overrides };
}

describe("resultSentence", () => {
  it("names the home winner and away loser correctly", () => {
    expect(resultSentence(match({ s1: "2", s2: "0" }), nameOf, first)).toBe("Ewww, Bob got slimed! Tom wins it! Good game, both of you!");
  });

  it("names the away winner and home loser correctly — the template doesn't assume a side", () => {
    expect(resultSentence(match({ s1: "0", s2: "3" }), nameOf, first)).toBe("Ewww, Tom got slimed! Bob wins it! Good game, both of you!");
  });

  it("announces a draw as 'All square', without claiming a winner", () => {
    expect(resultSentence(match({ s1: "1", s2: "1" }), nameOf)).toBe("All square");
    expect(resultSentence(match({ s1: "0", s2: "0" }), nameOf)).toBe("All square");
  });

  it("returns null for a bye — there was no match", () => {
    expect(resultSentence(match({ bye: true, p2: undefined }), nameOf)).toBeNull();
  });

  // useTournament's togglePlayed calls this with the pre-toggle match, at
  // the instant a match is about to flip false -> true, so `played` is
  // still false on the object passed in — resultSentence must still
  // compute the sentence from the score rather than bail out on that flag.
  it("computes the sentence from the score even when played is still false", () => {
    expect(resultSentence(match({ played: false, s1: "2", s2: "0" }), nameOf, first)).toBe("Ewww, Bob got slimed! Tom wins it! Good game, both of you!");
  });

  it("returns null when either player id is missing", () => {
    expect(resultSentence(match({ p1: undefined, s1: "0", s2: "2" }), nameOf)).toBeNull();
    expect(resultSentence(match({ p2: undefined, s1: "2", s2: "0" }), nameOf)).toBeNull();
  });

  it("returns null when a player id can't be resolved to a name", () => {
    const partialNameOf = (id) => (id === "p1" ? "Tom" : undefined);
    expect(resultSentence(match({ s1: "2", s2: "0" }), partialNameOf)).toBeNull();
    expect(resultSentence(match({ s1: "0", s2: "2" }), partialNameOf)).toBeNull();
  });

  it("returns null for anything that isn't a match object", () => {
    expect(resultSentence(null, nameOf)).toBeNull();
  });

  it("is daft but harmless when both players share a name", () => {
    const sameNameOf = () => "Sam";
    expect(resultSentence(match({ s1: "2", s2: "0" }), sameNameOf, first)).toBe("Ewww, Sam got slimed! Sam wins it! Good game, both of you!");
  });
});

describe("RESULT_TEMPLATES", () => {
  it("has several lines, each naming the loser and winner exactly once", () => {
    expect(RESULT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const t of RESULT_TEMPLATES) {
      expect(t.split("{loser}")).toHaveLength(2);
      expect(t.split("{winner}")).toHaveLength(2);
    }
  });

  it("can pick every line, and always names the right players", () => {
    const n = RESULT_TEMPLATES.length;
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      const s = resultSentence(match({ s1: "2", s2: "0" }), nameOf, () => (i + 0.5) / n);
      expect(s).toBe(RESULT_TEMPLATES[i].replace("{loser}", "Bob").replace("{winner}", "Tom"));
      seen.add(s);
    }
    expect(seen.size).toBe(n);
  });

  it("works with the default random pick", () => {
    expect(resultSentence(match({ s1: "2", s2: "0" }), nameOf)).toMatch(/Bob[\s\S]*Tom/);
  });
});

describe("speakResult", () => {
  it("never throws, even with no speech engine and no audio in the environment", () => {
    expect(() => speakResult("All square")).not.toThrow();
    expect(() => speakResult("Ewww, Bob got slimed! Tom wins it! Good game, both of you!")).not.toThrow();
    expect(() => speakResult(null)).not.toThrow();
  });
});
