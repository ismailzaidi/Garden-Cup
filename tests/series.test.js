import { describe, it, expect } from "vitest";
import { seriesWinner } from "../src/engine/series.js";

const finalists = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const leg = (s1, s2, played = true) => ({ id: `${s1}-${s2}-${played}-${Math.random()}`, p1: "a", p2: "b", s1: String(s1), s2: String(s2), played });

describe("seriesWinner", () => {
  it("is null when the only leg is unplayed", () => {
    expect(seriesWinner(finalists, [leg(0, 0, false)])).toBeNull();
  });

  it("is null when the only leg is drawn", () => {
    expect(seriesWinner(finalists, [leg(1, 1)])).toBeNull();
  });

  it("crowns the winner of a single decisive leg", () => {
    expect(seriesWinner(finalists, [leg(2, 0)]).id).toBe("a");
  });

  it("settles a best-of-3 early: 2-0 up with the third leg still unplayed", () => {
    const legs = [leg(2, 0), leg(1, 0), leg(0, 0, false)];
    expect(seriesWinner(finalists, legs).id).toBe("a");
  });

  it("is null for a win and a draw with one leg still to play — the lead isn't safe yet", () => {
    const legs = [leg(1, 0), leg(1, 1), leg(0, 0, false)];
    expect(seriesWinner(finalists, legs)).toBeNull();
  });

  it("crowns the winner of a win-draw-draw final", () => {
    const legs = [leg(1, 0), leg(1, 1), leg(2, 2)];
    expect(seriesWinner(finalists, legs).id).toBe("a");
  });

  it("is null for a win-loss-draw final — level on points", () => {
    const legs = [leg(1, 0), leg(0, 1), leg(1, 1)];
    expect(seriesWinner(finalists, legs)).toBeNull();
  });

  it("is null when every leg is played and points are level", () => {
    const legs = [leg(1, 1), leg(2, 2)];
    expect(seriesWinner(finalists, legs)).toBeNull();
  });

  it("is null without exactly two finalists", () => {
    expect(seriesWinner([finalists[0]], [leg(2, 0)])).toBeNull();
    expect(seriesWinner([], [leg(2, 0)])).toBeNull();
    expect(seriesWinner([finalists[0], finalists[1], { id: "c", name: "C" }], [leg(2, 0)])).toBeNull();
  });

  it("is null with no legs at all", () => {
    expect(seriesWinner(finalists, [])).toBeNull();
  });
});
