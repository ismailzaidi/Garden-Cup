import { describe, it, expect } from "vitest";
import horror from "../src/modes/horror.jsx";
import { HORROR_TWISTS, FATES, FATE_VERDICT, dealHorrors, horrorOf, fateOutcome, computeHorrorStandings } from "../src/engine/horror.js";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const keyWithFate = (fate) => HORROR_TWISTS.find((t) => t.fate === fate).key;
const match = (p1, p2, s1, s2, fate) => ({ id: `${p1}${p2}${fate}`, stage: "horror", p1, p2, s1: String(s1), s2: String(s2), played: true, twist: keyWithFate(fate) });
const row = (standings, id) => standings.find((r) => r.id === id);

describe("the horror deck", () => {
  it("has exactly 100 rules", () => {
    expect(HORROR_TWISTS).toHaveLength(100);
  });

  it("has unique keys and labels", () => {
    expect(new Set(HORROR_TWISTS.map((t) => t.key)).size).toBe(100);
    expect(new Set(HORROR_TWISTS.map((t) => t.label)).size).toBe(100);
  });

  it("only uses known fates, uses every one, and has a verdict for each secret fate", () => {
    expect(HORROR_TWISTS.every((t) => FATES.includes(t.fate))).toBe(true);
    for (const fate of FATES) expect(HORROR_TWISTS.some((t) => t.fate === fate)).toBe(true);
    for (const fate of FATES.filter((f) => f !== "normal")) expect(FATE_VERDICT[fate]).toBeTruthy();
  });

  it("keeps everything players read child-friendly", () => {
    // Keys are exempt: they're storage ids that can never be renamed.
    const banned = /\b(roast\w*|shame\w*|devil\w*|souls?|grovel\w*|death|dead|die|dies|kill\w*|blood\w*|beg|begging|poison\w*|reaper|eulogy|crying|stupid|idiot|loser'?s? curse|worthless|not worthy)\b/i;
    const texts = [
      ...HORROR_TWISTS.flatMap((t) => [t.label, t.detail]),
      ...Object.values(FATE_VERDICT),
      horror.label, horror.desc, horror.generateLabel,
    ];
    const offenders = texts.filter((s) => banned.test(s));
    expect(offenders).toEqual([]);
  });

  it("every rule has an emoji, label and detail", () => {
    expect(HORROR_TWISTS.every((t) => t.emoji && t.label && t.detail)).toBe(true);
  });
});

describe("dealHorrors", () => {
  it("is deterministic under a seeded rng", () => {
    expect(dealHorrors(12, seededRng(7))).toEqual(dealHorrors(12, seededRng(7)));
  });

  it("never repeats within one pass through the deck", () => {
    expect(new Set(dealHorrors(100, seededRng(11))).size).toBe(100);
  });

  it("reshuffles once the deck runs dry", () => {
    const dealt = dealHorrors(105, seededRng(13));
    expect(dealt).toHaveLength(105);
    expect(dealt.every((k) => horrorOf(k) !== null)).toBe(true);
  });
});

describe("horror.createFixtures", () => {
  it("stamps stage 'horror' and a resolvable rule on every match", () => {
    const { matches } = horror.createFixtures({ players: players(4), config: { horrorLegs: 1 }, rng: seededRng(3) });
    expect(matches).toHaveLength(6);
    expect(matches.every((m) => m.stage === "horror")).toBe(true);
    expect(matches.every((m) => horrorOf(m.twist) !== null)).toBe(true);
  });

  it("keeps the leg field for grouping", () => {
    const { matches } = horror.createFixtures({ players: players(3), config: { horrorLegs: 2 }, rng: seededRng(5) });
    expect(matches.filter((m) => m.leg === 1)).toHaveLength(3);
    expect(matches.filter((m) => m.leg === 2)).toHaveLength(3);
  });
});

describe("fateOutcome", () => {
  it("plays normal results straight", () => {
    expect(fateOutcome("normal", 2, 1)).toEqual([{ r: "w", pts: 3 }, { r: "l", pts: 0 }]);
    expect(fateOutcome("normal", 1, 1)).toEqual([{ r: "d", pts: 1 }, { r: "d", pts: 1 }]);
  });
});

describe("computeHorrorStandings", () => {
  const two = players(2);

  it("reverse: the on-pitch winner takes the loss", () => {
    const t = computeHorrorStandings(two, [match("p0", "p1", 3, 0, "reverse")]);
    expect(row(t, "p0")).toMatchObject({ w: 0, l: 1, pts: 0, gf: 3, ga: 0 });
    expect(row(t, "p1")).toMatchObject({ w: 1, l: 0, pts: 3 });
    expect(t[0].id).toBe("p1");
  });

  it("void: played, but no points and no result", () => {
    const t = computeHorrorStandings(two, [match("p0", "p1", 3, 0, "void")]);
    expect(row(t, "p0")).toMatchObject({ played: 1, w: 0, d: 0, l: 0, pts: 0 });
    expect(row(t, "p1")).toMatchObject({ played: 1, w: 0, d: 0, l: 0, pts: 0 });
  });

  it("both-lose: two losses, no points", () => {
    const t = computeHorrorStandings(two, [match("p0", "p1", 2, 2, "both-lose")]);
    expect(row(t, "p0")).toMatchObject({ l: 1, pts: 0 });
    expect(row(t, "p1")).toMatchObject({ l: 1, pts: 0 });
  });

  it("truce: a draw pays 3 each, a win pays 1", () => {
    const drawn = computeHorrorStandings(two, [match("p0", "p1", 1, 1, "truce")]);
    expect(row(drawn, "p0").pts).toBe(3);
    expect(row(drawn, "p1").pts).toBe(3);
    const won = computeHorrorStandings(two, [match("p0", "p1", 2, 1, "truce")]);
    expect(row(won, "p0")).toMatchObject({ w: 1, pts: 1 });
    expect(row(won, "p1")).toMatchObject({ l: 1, pts: 0 });
  });

  it("double, pity and drain", () => {
    expect(row(computeHorrorStandings(two, [match("p0", "p1", 1, 0, "double")]), "p0").pts).toBe(6);
    const pity = computeHorrorStandings(two, [match("p0", "p1", 1, 0, "pity")]);
    expect(row(pity, "p1")).toMatchObject({ l: 1, pts: 3 });
    const drain = computeHorrorStandings(two, [match("p0", "p1", 0, 1, "drain")]);
    expect(row(drain, "p1").pts).toBe(3);
    expect(row(drain, "p0").pts).toBe(-3);
  });

  it("ignores unplayed matches", () => {
    const t = computeHorrorStandings(two, [{ ...match("p0", "p1", 5, 0, "double"), played: false }]);
    expect(t.every((r) => r.played === 0 && r.pts === 0)).toBe(true);
  });
});

describe("horror.champion", () => {
  it("a player who won every match on the pitch can still lose the title", () => {
    const ps = players(3);
    const matches = [
      match("p0", "p1", 2, 0, "reverse"), // p0 wins on the pitch, p1 takes the points
      match("p0", "p2", 2, 0, "normal"),
      match("p1", "p2", 3, 0, "normal"),
    ];
    // p0: 3 pts, p1: 6 pts, p2: 0 pts
    expect(horror.champion({ players: ps, matches }).id).toBe("p1");
  });

  it("is null until every match is played, and null on a tie at the top", () => {
    const ps = players(2);
    expect(horror.champion({ players: ps, matches: [{ ...match("p0", "p1", 1, 0, "normal"), played: false }] })).toBeNull();
    expect(horror.champion({ players: ps, matches: [match("p0", "p1", 2, 0, "both-lose")] })).toBeNull();
  });
});
