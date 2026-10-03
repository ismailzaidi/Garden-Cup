import { describe, it, expect } from "vitest";
import horror from "../src/modes/horror.jsx";
import { HORROR_TWISTS, RETIRED_HORRORS, TIER_2 as H_TIER_2, TIER_3 as H_TIER_3, tierOf as hTierOf, tipOf as hTipOf, FATES, FATE_VERDICT, isSecret, dealHorrors, horrorOf, fateOutcome, computeHorrorStandings } from "../src/engine/horror.js";

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const EVERY_RULE = [...HORROR_TWISTS, ...RETIRED_HORRORS];
const keyWithFate = (fate) => EVERY_RULE.find((t) => t.fate === fate).key;
const match = (p1, p2, s1, s2, fate) => ({ id: `${p1}${p2}${fate}`, stage: "horror", p1, p2, s1: String(s1), s2: String(s2), played: true, twist: keyWithFate(fate) });
const row = (standings, id) => standings.find((r) => r.id === id);

describe("the horror deck", () => {
  it("deals from 92 rules and still resolves the 34 retired ones", () => {
    expect(HORROR_TWISTS).toHaveLength(92);
    expect(RETIRED_HORRORS).toHaveLength(34);
    // a saved tournament dealt a retired rule keeps its banner and its fate
    expect(RETIRED_HORRORS.every((t) => horrorOf(t.key) === t)).toBe(true);
  });

  it("has unique keys and labels, retired rules included", () => {
    expect(new Set(EVERY_RULE.map((t) => t.key)).size).toBe(EVERY_RULE.length);
    expect(new Set(EVERY_RULE.map((t) => t.label)).size).toBe(EVERY_RULE.length);
  });

  it("only uses known fates, and has a verdict for each secret fate", () => {
    expect(EVERY_RULE.every((t) => FATES.includes(t.fate))).toBe(true);
    for (const fate of FATES) expect(EVERY_RULE.some((t) => t.fate === fate)).toBe(true);
    for (const fate of FATES.filter((f) => f !== "normal")) expect(FATE_VERDICT[fate]).toBeTruthy();
  });

  it("has no mercy: nothing in the live deck pities the loser", () => {
    expect(HORROR_TWISTS.filter((t) => t.fate === "pity")).toEqual([]);
    expect(HORROR_TWISTS.filter((t) => /\b(mercy|pity|pitied|sympathy)\b/i.test(t.detail))).toEqual([]);
  });

  it("always leaves a winning side: no live rule voids a match or makes both players lose", () => {
    expect(HORROR_TWISTS.filter((t) => t.fate === "void" || t.fate === "both-lose")).toEqual([]);
    // every live fate still pays the winner of a decided match more than the loser
    const liveFates = [...new Set(HORROR_TWISTS.map((t) => t.fate))];
    for (const fate of liveFates) {
      const [home, away] = fateOutcome(fate, 3, 0);
      expect(home.pts).not.toBe(away.pts);
      expect([home.r, away.r].sort()).toEqual(["l", "w"]);
    }
  });

  it("asks no player to make noises, put on a voice, or tell a story", () => {
    const performing = /\b(moan\w*|groan\w*|scream\w*|cackl\w*|laugh\w*|oooo\w*|creak\w*|catchphrase|story|stories|speech|compliment\w*|commentat\w*|narrat\w*|talk like|sing\w*|song)\b/i;
    expect(HORROR_TWISTS.filter((t) => performing.test(`${t.label} ${t.detail}`)).map((t) => t.key)).toEqual([]);
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

  it("splits into secret rules (change the result) and open rules (everyone acts them out)", () => {
    const secret = HORROR_TWISTS.filter(isSecret);
    const open = HORROR_TWISTS.filter((t) => !isSecret(t));
    expect(secret).toHaveLength(33);
    expect(open).toHaveLength(59);
    expect(secret.every((t) => t.fate !== "normal" && FATE_VERDICT[t.fate])).toBe(true);
    expect(open.every((t) => t.fate === "normal")).toBe(true);
  });

  it("has skill rules: a fake shot, two fakes in a row, and a skill finish", () => {
    for (const key of ["phantom-shot", "double-phantom", "spellbound-goal"]) {
      expect(HORROR_TWISTS.find((t) => t.key === key)).toMatchObject({ fate: "normal" });
    }
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
    const n = HORROR_TWISTS.length;
    expect(new Set(dealHorrors(n, seededRng(11))).size).toBe(n);
  });

  it("reshuffles once the deck runs dry", () => {
    const dealt = dealHorrors(105, seededRng(13));
    expect(dealt).toHaveLength(105);
    expect(dealt.every((k) => horrorOf(k) !== null)).toBe(true);
  });

  it("deals every secret effect once before any of them comes round again", () => {
    const liveSecretFates = new Set(HORROR_TWISTS.filter(isSecret).map((t) => t.fate));
    for (const seed of [1, 2, 3, 4, 5]) {
      const secrets = dealHorrors(HORROR_TWISTS.length, seededRng(seed)).map(horrorOf).filter(isSecret);
      const firstRound = secrets.slice(0, liveSecretFates.size).map((t) => t.fate);
      expect(new Set(firstRound).size).toBe(liveSecretFates.size);
    }
  });

  it("never deals a retired rule", () => {
    const retired = new Set(RETIRED_HORRORS.map((t) => t.key));
    expect(dealHorrors(300, seededRng(17)).filter((k) => retired.has(k))).toEqual([]);
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

  it("draw6 and draw10: the loser is hit for 6 or 10, the winner keeps 3", () => {
    const six = computeHorrorStandings(two, [match("p0", "p1", 1, 0, "draw6")]);
    expect(row(six, "p0").pts).toBe(3);
    expect(row(six, "p1")).toMatchObject({ l: 1, pts: -6 });
    const ten = computeHorrorStandings(two, [match("p0", "p1", 0, 2, "draw10")]);
    expect(row(ten, "p1").pts).toBe(3);
    expect(row(ten, "p0").pts).toBe(-10);
    // a draw is nobody's loss
    expect(computeHorrorStandings(two, [match("p0", "p1", 1, 1, "draw10")]).map((r) => r.pts)).toEqual([1, 1]);
  });

  it("wipeout: only a loss by three or more costs 6", () => {
    expect(row(computeHorrorStandings(two, [match("p0", "p1", 3, 0, "wipeout")]), "p1").pts).toBe(-6);
    expect(row(computeHorrorStandings(two, [match("p0", "p1", 2, 0, "wipeout")]), "p1").pts).toBe(0);
  });

  it("skip-all: every player who wasn't in the match loses a point", () => {
    const t = computeHorrorStandings(players(4), [match("p0", "p1", 1, 0, "skip-all")]);
    expect(["p0", "p1", "p2", "p3"].map((id) => row(t, id).pts)).toEqual([3, 0, -1, -1]);
    // nobody won, so nobody is skipped
    const drawn = computeHorrorStandings(players(4), [match("p0", "p1", 1, 1, "skip-all")]);
    expect(["p2", "p3"].map((id) => row(drawn, id).pts)).toEqual([0, 0]);
  });

  it("swap: the two players trade whole totals, whichever order the matches sit in", () => {
    const ps = players(3);
    const swap = match("p0", "p1", 0, 0, "swap");           // 1 each, then traded
    const win = match("p0", "p2", 2, 0, "normal");          // p0 earns 3
    for (const matches of [[swap, win], [win, swap]]) {
      const t = computeHorrorStandings(ps, matches);
      // before the swap p0 has 4 and p1 has 1
      expect(row(t, "p0").pts).toBe(1);
      expect(row(t, "p1").pts).toBe(4);
      expect(row(t, "p2").pts).toBe(0);
    }
  });

  it("rotate: every total passes to the next player on the list", () => {
    const ps = players(3);
    const t = computeHorrorStandings(ps, [match("p0", "p1", 2, 0, "rotate")]);
    // earned: p0 3, p1 0, p2 0 — then p1 takes p0's, p2 takes p1's, p0 takes p2's
    expect(["p0", "p1", "p2"].map((id) => row(t, id).pts)).toEqual([0, 3, 0]);
    expect(row(t, "p0")).toMatchObject({ w: 1, gf: 2 });
  });

  it("docks a red card's points, before a swap moves the totals", () => {
    const docked = computeHorrorStandings(two, [{ ...match("p0", "p1", 1, 0, "normal"), d1: 3 }]);
    expect(row(docked, "p0").pts).toBe(0);
    const swapped = computeHorrorStandings(two, [{ ...match("p0", "p1", 1, 0, "swap"), d1: 3 }]);
    expect(row(swapped, "p0").pts).toBe(0);
    expect(row(swapped, "p1").pts).toBe(0);
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

describe("horror tiers and the climbing deal", () => {
  const live = new Set(HORROR_TWISTS.map((t) => t.key));
  const tierRules = (tier) => HORROR_TWISTS.filter((t) => hTierOf(t.key) === tier);

  it("only lists live rules in the tier sets, so a typo can't hide", () => {
    for (const key of [...H_TIER_2, ...H_TIER_3]) expect(live.has(key), key).toBe(true);
    expect([...H_TIER_2].filter((k) => H_TIER_3.has(k))).toEqual([]);
  });

  it("ramps the secret effects: kind first, the No Mercy set last", () => {
    const fatesIn = (tier) => new Set(tierRules(tier).filter(isSecret).map((t) => t.fate));
    expect([...fatesIn(1)].sort()).toEqual(["double", "truce"]);
    expect([...fatesIn(3)].sort()).toEqual(["draw10", "draw6", "rotate", "skip-all", "swap", "wipeout"]);
    expect(fatesIn(2).has("reverse")).toBe(true);
  });

  it("has enough in every tier to fill a third of a long tournament", () => {
    for (const tier of [1, 2, 3]) expect(tierRules(tier).length).toBeGreaterThanOrEqual(12);
  });

  it("borrows a how-to for each skill rule, and only for live rules", () => {
    for (const key of ["phantom-shot", "double-phantom", "spellbound-goal", "chain-of-curses"]) expect(hTipOf(key)).toBeTruthy();
    expect(hTipOf("possessed-keeper")).toBeNull();
  });

  it("deals the easy tier first and the hard tier last", () => {
    for (const seed of [1, 2, 3]) {
      const tiers = dealHorrors(30, seededRng(seed), "climb").map(hTierOf);
      expect(tiers.slice(0, 10).every((t) => t === 1)).toBe(true);
      expect(tiers.slice(10, 20).every((t) => t === 2)).toBe(true);
      expect(tiers.slice(20).every((t) => t === 3)).toBe(true);
    }
  });

  it("never repeats a rule while a tier has an unused one, and never deals a retired rule", () => {
    const dealt = dealHorrors(36, seededRng(7), "climb");
    expect(new Set(dealt).size).toBe(36);
    const retired = new Set(RETIRED_HORRORS.map((t) => t.key));
    expect(dealt.filter((k) => retired.has(k))).toEqual([]);
  });

  it("horror.createFixtures climbs by default, stamps the level, and keeps every match winnable", () => {
    const { matches } = horror.createFixtures({ players: players(4), config: { horrorLegs: 1 }, rng: seededRng(3) });
    expect(matches.map((m) => m.tier)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(matches.every((m) => hTierOf(m.twist) === m.tier)).toBe(true);
    const mixed = horror.createFixtures({ players: players(4), config: { horrorLegs: 1, horrorOrder: "random" }, rng: seededRng(3) });
    expect(mixed.matches.every((m) => m.tier === undefined)).toBe(true);
  });
});
