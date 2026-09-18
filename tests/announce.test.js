import { describe, it, expect } from "vitest";
import { resultSentence, speakResult } from "../src/engine/announce.js";

const NAMES = { p1: "Tom", p2: "Bob" };
const nameOf = (id) => NAMES[id];

function match(overrides) {
  return { id: "m1", p1: "p1", p2: "p2", s1: "0", s2: "0", played: true, ...overrides };
}

describe("resultSentence", () => {
  it("names the home winner and away loser correctly", () => {
    expect(resultSentence(match({ s1: "2", s2: "0" }), nameOf)).toBe("Bob lost, Tom won");
  });

  it("names the away winner and home loser correctly — the template doesn't assume a side", () => {
    expect(resultSentence(match({ s1: "0", s2: "3" }), nameOf)).toBe("Tom lost, Bob won");
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
    expect(resultSentence(match({ played: false, s1: "2", s2: "0" }), nameOf)).toBe("Bob lost, Tom won");
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
    expect(resultSentence(match({ s1: "2", s2: "0" }), sameNameOf)).toBe("Sam lost, Sam won");
  });
});

describe("speakResult", () => {
  it("never throws, even with no speech engine and no audio in the environment", () => {
    expect(() => speakResult("All square")).not.toThrow();
    expect(() => speakResult("Bob lost, Tom won")).not.toThrow();
    expect(() => speakResult(null)).not.toThrow();
  });
});
