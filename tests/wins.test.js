import { describe, it, expect } from "vitest";
import { computeWinsTable } from "../src/engine/wins.js";

const win = (name, w, extra = {}) => ({ name, played: w, w, d: 0, l: 0, gf: 0, ga: 0, ...extra });

describe("computeWinsTable", () => {
  it("returns [] for empty history", () => {
    expect(computeWinsTable([])).toEqual([]);
  });

  it("ranks by titles: two wins, one win, never wins", () => {
    const history = [
      { champion: "A", players: ["A", "B"] },
      { champion: "A", players: ["A", "C"] },
      { champion: "B", players: ["B", "C"] },
    ];
    const table = computeWinsTable(history);
    expect(table.map((r) => r.name)).toEqual(["A", "B", "C"]);
    expect(table.map((r) => r.titles)).toEqual([2, 1, 0]);
    expect(table.map((r) => r.entered)).toEqual([2, 2, 2]);
  });

  it("merges names after trim() + case-fold, keeping the newest spelling", () => {
    // newest first, matching how history is stored
    const history = [
      { champion: "Bob", players: ["Bob", "Sam"] },
      { champion: "bob ", players: [" bob ", "sam"] },
    ];
    const table = computeWinsTable(history);
    expect(table.map((r) => r.name)).toEqual(["Bob", "Sam"]);
    const bob = table.find((r) => r.key === "bob");
    expect(bob.titles).toBe(2);
    expect(bob.entered).toBe(2);
  });

  it("still credits a title when the champion isn't in that record's players list", () => {
    const table = computeWinsTable([{ champion: "Ghost", players: ["A", "B"] }]);
    const ghost = table.find((r) => r.name === "Ghost");
    expect(ghost).toMatchObject({ titles: 1, entered: 0 });
  });

  it("breaks a tie on titles by match wins, then fewer tournaments entered, then name", () => {
    const history = [
      // Bob: 1 title, 1 tournament entered, 5 match wins
      { champion: "Bob", players: ["Bob", "Z1"], results: [win("Bob", 5), win("Z1", 0)] },
      // Dee: same as Bob on everything but name
      { champion: "Dee", players: ["Dee", "Z2"], results: [win("Dee", 5), win("Z2", 0)] },
      // Cara: 1 title, 1 entered, but fewer wins — ranks below the 5-win pair
      { champion: "Cara", players: ["Cara", "Z3"], results: [win("Cara", 3), win("Z3", 0)] },
      // Alice: ties Bob/Dee on titles and wins, but entered twice — ranks below them
      { champion: "Alice", players: ["Alice", "Z4"], results: [win("Alice", 5), win("Z4", 0)] },
      { champion: "Z5", players: ["Alice", "Z5"], results: [win("Alice", 0), win("Z5", 5)] },
    ];
    const table = computeWinsTable(history);
    const order = table.map((r) => r.name).filter((n) => ["Bob", "Dee", "Cara", "Alice"].includes(n));
    expect(order).toEqual(["Bob", "Dee", "Alice", "Cara"]);
  });

  it("defaults to no match-win data when no record has results, and sums a partial mix honestly", () => {
    const noResults = computeWinsTable([{ champion: "A", players: ["A", "B"] }]);
    const a = noResults.find((r) => r.name === "A");
    expect(a.w).toBe(0);
    expect(a.hasResults).toBe(false);

    const mixed = computeWinsTable([
      { champion: "A", players: ["A", "B"], results: [win("A", 1), win("B", 0)] },
      { champion: "A", players: ["A", "B"] }, // older record, written before results existed
    ]);
    const aMixed = mixed.find((r) => r.name === "A");
    expect(aMixed).toMatchObject({ titles: 2, entered: 2, w: 1, hasResults: true });
  });
});
