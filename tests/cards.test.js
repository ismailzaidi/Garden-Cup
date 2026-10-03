import { describe, it, expect } from "vitest";
import { applyCard, cardSentence, CARD_GOAL_OFF, CARD_GOAL_TO_OPPONENT } from "../src/engine/cards.js";

function match(overrides) {
  return { id: "m1", p1: "p1", p2: "p2", s1: "0", s2: "0", played: false, ...overrides };
}

describe("applyCard", () => {
  it("takes a goal off the carded player when they have one to lose", () => {
    const { match: m, effect } = applyCard(match({ s1: "2", s2: "1" }), "s1");
    expect(effect).toBe(CARD_GOAL_OFF);
    expect(m.s1).toBe("1");
    expect(m.s2).toBe("1");
    expect(m.c1).toBe(1);
    expect(m.c2).toBeUndefined();
  });

  it("works for the away side too", () => {
    const { match: m, effect } = applyCard(match({ s1: "2", s2: "1" }), "s2");
    expect(effect).toBe(CARD_GOAL_OFF);
    expect(m.s1).toBe("2");
    expect(m.s2).toBe("0");
    expect(m.c2).toBe(1);
  });

  it("gives the opponent a goal instead of going below zero", () => {
    const { match: m, effect } = applyCard(match({ s1: "0", s2: "3" }), "s1");
    expect(effect).toBe(CARD_GOAL_TO_OPPONENT);
    expect(m.s1).toBe("0");
    expect(m.s2).toBe("4");
    expect(m.c1).toBe(1);
  });

  it("counts every card shown to a side, and keeps scores as strings", () => {
    const once = applyCard(match({ s1: "1" }), "s1").match;
    const twice = applyCard(once, "s1").match;
    expect(twice.c1).toBe(2);
    expect(twice.s1).toBe("0");
    expect(twice.s2).toBe("1");
    expect(typeof twice.s1).toBe("string");
    expect(typeof twice.s2).toBe("string");
  });

  it("does not mutate the match it was given", () => {
    const original = match({ s1: "1" });
    applyCard(original, "s1");
    expect(original).toEqual(match({ s1: "1" }));
  });
});

describe("cardSentence", () => {
  it("says a goal came off the carded player", () => {
    const s = cardSentence(CARD_GOAL_OFF, "Tom", "Bob");
    expect(s).toContain("Slow play card for Tom");
    expect(s).toContain("One goal comes off Tom");
    expect(s).not.toContain("Bob");
  });

  it("says the opponent got the goal when there was none to take", () => {
    const s = cardSentence(CARD_GOAL_TO_OPPONENT, "Tom", "Bob");
    expect(s).toContain("Slow play card for Tom");
    expect(s).toContain("A bonus goal goes to Bob");
  });

  it("returns null when a name is missing", () => {
    expect(cardSentence(CARD_GOAL_OFF, "", "Bob")).toBeNull();
    expect(cardSentence(CARD_GOAL_OFF, "Tom", undefined)).toBeNull();
  });
});
