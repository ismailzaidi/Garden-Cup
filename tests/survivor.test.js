import { describe, it, expect } from "vitest";
import survivor, { advance, roundTable } from "../src/modes/survivor.jsx";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const A = { id: "a", name: "Alice" };
const B = { id: "b", name: "Bob" };
const D = { id: "d", name: "Dara" };
const E = { id: "e", name: "Eli" };
const ALL = [A, B, D, E];

const m = (id, p1, p2, s1, s2, played = true, round = 1) =>
  ({ id, stage: "survivor", round, p1, p2, s1: String(s1), s2: String(s2), played });

// Round 1 of a four-player field, engineered so Eli finishes bottom.
const round1 = [
  m("1", "a", "b", 2, 0),
  m("2", "a", "d", 2, 0),
  m("3", "a", "e", 3, 0),
  m("4", "b", "d", 1, 0),
  m("5", "b", "e", 1, 0),
  m("6", "d", "e", 1, 0),
];

const run = (matches, modeState, players = ALL) =>
  advance({ players, matches, config: {}, modeState, rng: seededRng(4) });

describe("survivor.createFixtures", () => {
  it("stamps stage and round 1, and seeds modeState with everyone alive", () => {
    const { matches, modeState, initialTab } = survivor.createFixtures({ players: ALL, config: {}, rng: seededRng(1) });
    expect(matches).toHaveLength(6);
    expect(matches.every((x) => x.stage === "survivor" && x.round === 1)).toBe(true);
    expect(modeState).toEqual({ alive: ["a", "b", "d", "e"], eliminated: [] });
    expect(initialTab).toBe("rounds");
  });
});

describe("survivor.advance", () => {
  it("is a no-op while the round is unfinished", () => {
    const matches = [...round1.slice(0, 5), { ...round1[5], played: false }];
    const state = { alive: ["a", "b", "d", "e"], eliminated: [] };
    expect(run(matches, state).matches).toBe(matches);
  });

  it("eliminates the bottom row of the round table", () => {
    const state = { alive: ["a", "b", "d", "e"], eliminated: [] };
    const next = run(round1, state);
    expect(next.modeState.eliminated).toEqual([{ id: "e", round: 1 }]);
    expect(next.modeState.alive).toEqual(["a", "b", "d"]);
  });

  it("generates the next round among survivors only", () => {
    const state = { alive: ["a", "b", "d", "e"], eliminated: [] };
    const next = run(round1, state);
    const round2 = next.matches.filter((x) => x.round === 2);
    expect(round2).toHaveLength(3); // three survivors => three pairings
    expect(round2.flatMap((x) => [x.p1, x.p2])).not.toContain("e");
  });

  it("generates no further fixtures once one player is left", () => {
    const round2 = [m("7", "a", "b", 1, 0, true, 2)];
    const state = { alive: ["a", "b"], eliminated: [{ id: "e", round: 1 }] };
    const next = advance({ players: [A, B], matches: round2, config: {}, modeState: state, rng: seededRng(6) });
    expect(next.matches).toBe(round2);
    expect(next.modeState.alive).toEqual(["a"]);
    expect(next.modeState.eliminated).toHaveLength(2);
  });

  it("still eliminates someone when every match in the round is drawn", () => {
    const drawn = [m("1", "a", "b", 0, 0), m("2", "a", "d", 0, 0), m("3", "b", "d", 0, 0)];
    const next = run(drawn, { alive: ["a", "b", "d"], eliminated: [] }, [A, B, D]);
    expect(next.modeState.eliminated).toHaveLength(1);
    expect(next.modeState.alive).toHaveLength(2);
  });
});

describe("survivor.champion", () => {
  it("is null while two or more players are alive", () => {
    expect(survivor.champion({ players: ALL, matches: round1, config: {}, modeState: { alive: ["a", "b"] } })).toBeNull();
  });

  it("is the last player standing", () => {
    const champ = survivor.champion({ players: ALL, matches: round1, config: {}, modeState: { alive: ["a"] } });
    expect(champ.name).toBe("Alice");
  });

  it("is null for a fresh state with no modeState at all", () => {
    expect(survivor.champion({ players: ALL, matches: [], config: {}, modeState: {} })).toBeNull();
  });
});

describe("roundTable", () => {
  it("covers only the requested round's matches and players", () => {
    const matches = [...round1, m("7", "a", "b", 5, 0, true, 2)];
    const table = roundTable(ALL, matches, 2);
    expect(table.map((r) => r.id).sort()).toEqual(["a", "b"]);
    expect(table[0].id).toBe("a");
  });
});
