import { describe, it, expect } from "vitest";
import { bandOf, tierName, formatOrder, TIER_COUNT } from "../src/engine/tiers.js";

describe("bandOf", () => {
  it("splits the matches into thirds, easy first", () => {
    expect(Array.from({ length: 6 }, (_, i) => bandOf(i, 6))).toEqual([1, 1, 2, 2, 3, 3]);
    expect(Array.from({ length: 9 }, (_, i) => bandOf(i, 9))).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });

  it("copes with a tournament too short to fill every tier", () => {
    expect(bandOf(0, 1)).toBe(1);
    expect([bandOf(0, 2), bandOf(1, 2)]).toEqual([1, 2]);
    expect(bandOf(0, 0)).toBe(1);
  });

  it("never goes past the top tier, and never falls back down", () => {
    for (const count of [3, 7, 10, 30, 61]) {
      const bands = Array.from({ length: count }, (_, i) => bandOf(i, count));
      expect(Math.max(...bands)).toBeLessThanOrEqual(TIER_COUNT);
      expect(bands).toEqual([...bands].sort((a, b) => a - b));
    }
  });
});

describe("labels", () => {
  it("names a level and an order", () => {
    expect(tierName(2)).toBe("Level 2 · Medium");
    expect(formatOrder("climb")).toBe("Easy to hard");
    expect(formatOrder("random")).toBe("Mixed up");
  });
});
