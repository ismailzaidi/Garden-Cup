import { describe, it, expect } from "vitest";
import worldcup, { advance, groupStandings } from "../src/modes/worldcup.jsx";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

const fixtures = (n = 4, legs = 1, seed = 5) =>
  worldcup.createFixtures({ players: players(n), config: { groupLegs: legs }, rng: seededRng(seed) });

// Play every group match, giving the earlier-listed player of each group a
// win so the group order is predictable.
const playGroups = (matches) => matches.map((m) => (m.stage === "wcgroup" ? { ...m, s1: "2", s2: "1", played: true } : m));

describe("worldcup.createFixtures", () => {
  it("deals alternately into two groups and stamps stage and group on every match", () => {
    const { matches, modeState, initialTab } = fixtures(4);
    expect(modeState.groups.A).toHaveLength(2);
    expect(modeState.groups.B).toHaveLength(2);
    expect(matches.every((m) => m.stage === "wcgroup" && ["A", "B"].includes(m.group))).toBe(true);
    expect(initialTab).toBe("groups");
  });

  it("is deterministic under a seeded rng", () => {
    expect(fixtures(6, 1, 11).modeState).toEqual(fixtures(6, 1, 11).modeState);
  });

  it("handles an odd roster with uneven groups", () => {
    const { modeState } = fixtures(5);
    expect(modeState.groups.A).toHaveLength(3);
    expect(modeState.groups.B).toHaveLength(2);
  });

  it("doubles the group fixtures for a two-leg group stage", () => {
    expect(fixtures(4, 2).matches).toHaveLength(4); // 1 match per group per leg
  });
});

describe("worldcup.advance — group stage to semi-finals", () => {
  it("is a no-op while any group match is unplayed", () => {
    const { matches, modeState } = fixtures(4);
    expect(advance({ players: players(4), matches, config: {}, modeState, rng: seededRng(1) }).matches).toBe(matches);
  });

  it("pairs A1 v B2 and B1 v A2", () => {
    const ps = players(4);
    const { matches, modeState } = fixtures(4);
    const played = playGroups(matches);
    const next = advance({ players: ps, matches: played, config: {}, modeState, rng: seededRng(1) });

    const semis = next.matches.filter((m) => m.stage === "wcko");
    expect(semis).toHaveLength(2);
    expect(semis.every((m) => m.round === 1)).toBe(true);
    expect(next.tab).toBe("knockout");

    const a = groupStandings(ps, played, modeState, "A");
    const b = groupStandings(ps, played, modeState, "B");
    const pairs = semis.map((m) => [m.p1, m.p2].sort().join("|")).sort();
    expect(pairs).toEqual([[a[0].id, b[1].id].sort().join("|"), [b[0].id, a[1].id].sort().join("|")].sort());
  });
});

describe("worldcup.advance — semi-finals to the final", () => {
  const toSemis = () => {
    const ps = players(4);
    const { matches, modeState } = fixtures(4);
    const next = advance({ players: ps, matches: playGroups(matches), config: {}, modeState, rng: seededRng(1) });
    return { ps, modeState, matches: next.matches };
  };

  it("is a no-op while a semi-final is level or unplayed", () => {
    const { ps, modeState, matches } = toSemis();
    const level = matches.map((m) => (m.round === 1 ? { ...m, s1: "1", s2: "1", played: true } : m));
    expect(advance({ players: ps, matches: level, config: {}, modeState, rng: seededRng(2) }).matches).toBe(level);
  });

  it("generates a final and a third-place match once both semis are decided", () => {
    const { ps, modeState, matches } = toSemis();
    const decided = matches.map((m) => (m.round === 1 ? { ...m, s1: "3", s2: "0", played: true } : m));
    const next = advance({ players: ps, matches: decided, config: {}, modeState, rng: seededRng(2) });

    const round2 = next.matches.filter((m) => m.round === 2);
    expect(round2).toHaveLength(2);
    const final = round2.find((m) => !m.thirdPlace);
    const third = round2.find((m) => m.thirdPlace);

    const semiWinners = decided.filter((m) => m.round === 1).map((m) => m.p1);
    const semiLosers = decided.filter((m) => m.round === 1).map((m) => m.p2);
    expect([final.p1, final.p2].sort()).toEqual(semiWinners.sort());
    expect([third.p1, third.p2].sort()).toEqual(semiLosers.sort());
  });

  it("builds a three-leg final, home alternating, with a single third-place match, when wcFinalLegs is 3", () => {
    const { ps, modeState, matches } = toSemis();
    const decided = matches.map((m) => (m.round === 1 ? { ...m, s1: "3", s2: "0", played: true } : m));
    const next = advance({ players: ps, matches: decided, config: { wcFinalLegs: 3 }, modeState, rng: seededRng(2) });

    const round2 = next.matches.filter((m) => m.round === 2);
    const final = round2.filter((m) => !m.thirdPlace);
    const third = round2.filter((m) => m.thirdPlace);
    expect(final).toHaveLength(3);
    expect(third).toHaveLength(1);
    expect(final[1].p1).toBe(final[0].p2);
    expect(final[2].p1).toBe(final[0].p1);
  });

  it("does not generate the final twice", () => {
    const { ps, modeState, matches } = toSemis();
    const decided = matches.map((m) => (m.round === 1 ? { ...m, s1: "3", s2: "0", played: true } : m));
    const once = advance({ players: ps, matches: decided, config: {}, modeState, rng: seededRng(2) }).matches;
    expect(advance({ players: ps, matches: once, config: {}, modeState, rng: seededRng(3) }).matches).toBe(once);
  });
});

describe("worldcup.champion", () => {
  const ko = (round, p1, p2, s1, s2, thirdPlace = false, played = true, leg = 1) =>
    ({ id: `${round}${p1}${p2}${leg}`, stage: "wcko", round, leg, p1, p2, s1: String(s1), s2: String(s2), played, thirdPlace });

  const ps = [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }, { id: "c", name: "Cara" }, { id: "d", name: "Dara" }];
  const champ = (matches) => worldcup.champion({ players: ps, matches, config: {}, modeState: {} });

  it("is null before the final exists", () => {
    expect(champ([ko(1, "a", "b", 2, 0)])).toBeNull();
  });

  it("comes from the final, never the third-place match — first to two legs", () => {
    // a leg series: Alice is first to two, the third leg stays unplayed
    const matches = [
      ko(2, "a", "b", 3, 1, false, true, 1),
      ko(2, "a", "b", 2, 0, false, true, 2),
      ko(2, "a", "b", 0, 0, false, false, 3),
      ko(2, "c", "d", 5, 0, true),
    ];
    expect(champ(matches).name).toBe("Alice");
  });

  it("is null while the final is level or unplayed", () => {
    expect(champ([ko(2, "a", "b", 1, 1)])).toBeNull();
    expect(champ([ko(2, "a", "b", 0, 0, false, false)])).toBeNull();
  });

  it("is null on a one-legged final that's still level, even with a lop-sided third-place score", () => {
    // the third-place match must never leak into the final's series table
    expect(champ([ko(2, "a", "b", 1, 1), ko(2, "c", "d", 9, 0, true)])).toBeNull();
  });
});
