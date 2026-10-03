import { describe, it, expect } from "vitest";
import { bottomOf, lastOfTable, lastPlaceOf } from "../src/engine/stakes.js";
import horror from "../src/modes/horror.jsx";
import goldenboot from "../src/modes/goldenboot.jsx";
import survivor from "../src/modes/survivor.jsx";
import roundrobin from "../src/modes/roundrobin.jsx";
import { HORROR_TWISTS } from "../src/engine/horror.js";

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const played = (p1, p2, s1, s2, extra = {}) => ({ id: `${p1}${p2}`, stage: "group", p1, p2, s1: String(s1), s2: String(s2), played: true, ...extra });
const ids = (rows) => rows.map((r) => r.id);

describe("bottomOf / lastOfTable", () => {
  const tableRow = (id, pts, gf, ga) => ({ id, pts, gf, ga });

  it("returns the bottom row", () => {
    const table = [tableRow("a", 6, 4, 0), tableRow("b", 3, 2, 2), tableRow("c", 0, 0, 4)];
    expect(ids(lastOfTable(table, "a"))).toEqual(["c"]);
  });

  it("shares last place between rows level on points, goal difference and goals", () => {
    const table = [tableRow("a", 6, 4, 0), tableRow("b", 0, 1, 3), tableRow("c", 0, 1, 3)];
    expect(ids(lastOfTable(table, "a"))).toEqual(["b", "c"]);
  });

  it("never names the champion, even from the bottom of the table", () => {
    const table = [tableRow("a", 3, 1, 0), tableRow("b", 0, 0, 1)];
    expect(ids(lastOfTable(table, "b"))).toEqual(["a"]);
    expect(bottomOf([tableRow("a", 3, 1, 0)], "a", (r) => [r.pts])).toEqual([]);
  });
});

describe("lastPlaceOf", () => {
  it("is empty until there is a champion", () => {
    const ps = players(3);
    expect(lastPlaceOf(roundrobin, { players: ps, matches: [], config: {}, modeState: {}, champion: null })).toEqual([]);
  });

  it("uses the table of every match for a mode with no rule of its own", () => {
    const ps = players(3);
    const matches = [played("p0", "p1", 2, 0), played("p0", "p2", 3, 0), played("p1", "p2", 1, 0)];
    expect(ids(lastPlaceOf(roundrobin, { players: ps, matches, config: {}, modeState: {}, champion: ps[0] }))).toEqual(["p2"]);
  });

  it("horror: last on the table after the fates, not on the pitch", () => {
    const ps = players(3);
    const reverse = HORROR_TWISTS.find((t) => t.fate === "reverse").key;
    const normal = HORROR_TWISTS.find((t) => t.fate === "normal").key;
    const h = (p1, p2, s1, s2, twist) => played(p1, p2, s1, s2, { stage: "horror", twist });
    const matches = [
      h("p0", "p1", 5, 0, reverse), // p1 takes the points
      h("p0", "p2", 0, 1, reverse), // p0 takes the points
      h("p1", "p2", 1, 0, normal),
    ];
    // p1: 6, p0: 3, p2: 0 — p2 won a match on the pitch and is still last
    const champ = horror.champion({ players: ps, matches });
    expect(champ.id).toBe("p1");
    expect(ids(lastPlaceOf(horror, { players: ps, matches, config: {}, modeState: {}, champion: champ }))).toEqual(["p2"]);
  });

  it("goldenboot: fewest goals is last, and a tie shares it", () => {
    const ps = players(3);
    const g = (p1, p2, s1, s2) => played(p1, p2, s1, s2, { stage: "goldenboot" });
    const matches = [g("p0", "p1", 5, 1), g("p0", "p2", 5, 1)];
    expect(ids(lastPlaceOf(goldenboot, { players: ps, matches, config: {}, modeState: {}, champion: ps[0] })).sort()).toEqual(["p1", "p2"]);
  });

  it("survivor: last is whoever was knocked out first", () => {
    const ps = players(3);
    const modeState = { alive: ["p0"], eliminated: [{ id: "p2", round: 1 }, { id: "p1", round: 2 }] };
    expect(ids(lastPlaceOf(survivor, { players: ps, matches: [], config: {}, modeState, champion: ps[0] }))).toEqual(["p2"]);
  });
});
