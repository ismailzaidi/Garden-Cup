import { describe, it, expect } from "vitest";
import { MODES } from "../src/modes/index.js";
import { applyCard, applyRedCard } from "../src/engine/cards.js";
import { validateState, toStoredState, ValidationError } from "../api/_lib/state.js";
import { parseHistoryRecord, toStoredRecord } from "../api/_lib/historyRecord.js";

/* The cloud copy must give back exactly what the client saved. These tests
   play every mode through its real fixture/advance code (so a mode that
   starts keeping a new field on a match or in modeState is caught here) and
   push the result through validate -> the document that is stored. */

// a small deterministic rng, so a failing mode reproduces
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

function defaultConfig(mode) {
  const cfg = {};
  Object.entries(mode.config || {}).forEach(([k, spec]) => { cfg[k] = spec.default; });
  return cfg;
}

const names = ["Sam", "Ali", "Dave", "Mo", "Jess", "Kit"];
function makePlayers(withTeams) {
  return names.map((name, i) => ({
    id: `p${i + 1}`, name,
    ...(withTeams && i < 2 ? { members: [`${name} A`, `${name} B`] } : {}),
  }));
}

/* Plays every match, with a few cards and goals so those fields are set, and
   keeps advancing until the mode has nothing more to add. */
function playOut(mode, players, config, rng) {
  const created = mode.createFixtures({ players, config, rng });
  let matches = created.matches;
  let modeState = created.modeState || {};
  const goals = [];
  for (let round = 0; round < 30; round++) {
    matches = matches.map((m, i) => {
      if (m.played || m.bye || !m.p1 || !m.p2) return m;
      let next = { ...m, s1: String(2 + (i % 2)), s2: String(i % 3 === 0 ? 0 : 1), played: true };
      if (i % 4 === 0) next = applyCard(next, "s1").match;
      if (i % 5 === 0) next = applyRedCard(next, "s2", (mode.goalStages || []).includes(m.stage)).match;
      goals.push({ id: `g${goals.length}`, matchId: m.id, playerId: m.p1, second: 10 + i, duration: 120, stage: m.stage });
      return next;
    });
    if (!mode.advance) break;
    const before = matches.length;
    const result = mode.advance({ players, matches, config, modeState, rng });
    matches = result.matches;
    modeState = result.modeState ?? modeState;
    if (matches.length === before) break;
  }
  return {
    players, matches, goals: goals.filter((g) => matches.some((m) => m.id === g.matchId)),
    mode: mode.key, config, modeState,
    stakes: { prize: "Pick the film", chore: "Set the table" },
    tournamentId: "tourn1", historySaved: false, schemaVersion: 2,
  };
}

// The server writes null/false/"" for a key the client leaves out, and the
// client treats the two the same — compare modulo that, nothing else.
function norm(v) {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") {
    const out = {};
    Object.keys(v).sort().forEach((k) => {
      const n = norm(v[k]);
      if (n !== null && n !== undefined && n !== false) out[k] = n;
    });
    return out;
  }
  return v;
}

// what the server stores, after a JSON round trip as jsonb would give it
function saveAndCompose(state) {
  return { out: JSON.parse(JSON.stringify(toStoredState(validateState(state)))) };
}

describe("the stored state is lossless", () => {
  for (const mode of MODES) {
    for (const withTeams of [false, true]) {
      it(`${mode.key}${withTeams ? " with teams" : ""}`, async () => {
        const players = makePlayers(withTeams);
        const state = playOut(mode, players, defaultConfig(mode), seeded(7));
        expect(state.matches.length).toBeGreaterThan(0);

        const { out } = await saveAndCompose(state);
        expect(norm(out)).toEqual(norm(state));
      });
    }
  }

  it("keeps card badges, docked points, the dealt twist and its tier on a match", async () => {
    const chaos = MODES.find((m) => m.key === "chaos");
    const state = playOut(chaos, makePlayers(false), defaultConfig(chaos), seeded(3));
    const withCards = state.matches.filter((m) => m.c1 || m.r2 || m.d2);
    expect(withCards.length).toBeGreaterThan(0);
    expect(state.matches.every((m) => typeof m.twist === "string")).toBe(true);

    const { out } = await saveAndCompose(state);
    state.matches.forEach((m, i) => {
      ["c1", "c2", "r1", "r2", "d1", "d2", "twist", "tier"].forEach((k) => {
        expect(out.matches[i][k], `${k} on match ${i}`).toEqual(m[k]);
      });
    });
  });

  it("keeps team members, stakes, survivor's lists and the world cup groups", async () => {
    const survivor = MODES.find((m) => m.key === "survivor");
    const s = playOut(survivor, makePlayers(true), defaultConfig(survivor), seeded(5));
    const { out } = await saveAndCompose(s);
    expect(out.players[0].members).toEqual(["Sam A", "Sam B"]);
    expect(out.players[2].members).toBeUndefined();
    expect(out.stakes).toEqual({ prize: "Pick the film", chore: "Set the table" });
    expect(out.modeState.eliminated.length).toBeGreaterThan(0);
    expect(out.modeState.alive).toEqual(s.modeState.alive);

    const wc = MODES.find((m) => m.key === "worldcup");
    const w = playOut(wc, makePlayers(false), defaultConfig(wc), seeded(5));
    const { out: wOut } = await saveAndCompose(w);
    expect(wOut.modeState.groups).toEqual(w.modeState.groups);
    expect(wOut.matches.some((m) => m.thirdPlace === true)).toBe(true);
    expect(wOut.matches.filter((m) => m.stage === "wcgroup").every((m) => m.group === "A" || m.group === "B")).toBe(true);
  });
});

describe("validation of the new fields", () => {
  const base = () => {
    const mode = MODES[0];
    return playOut(mode, makePlayers(false), defaultConfig(mode), seeded(2));
  };
  const rejects = (mutate, message) => {
    const s = base();
    mutate(s);
    expect(() => validateState(s)).toThrow(ValidationError);
    expect(() => validateState(s)).toThrow(message);
  };

  it("rejects bad team members", () => {
    rejects((s) => { s.players[0].members = "Sam"; }, "player.members");
    rejects((s) => { s.players[0].members = []; }, "player.members");
    rejects((s) => { s.players[0].members = Array(9).fill("x"); }, "player.members");
    rejects((s) => { s.players[0].members = ["x".repeat(25)]; }, "player.members");
  });

  it("rejects bad stakes", () => {
    rejects((s) => { s.stakes = { prize: "x".repeat(41), chore: "" }; }, "stakes.prize");
    rejects((s) => { s.stakes = { prize: 5 }; }, "stakes.prize");
    rejects((s) => { s.stakes = []; }, "stakes");
  });

  it("rejects bad match extras", () => {
    rejects((s) => { s.matches[0].c1 = -1; }, "match.c1");
    rejects((s) => { s.matches[0].d2 = 70000; }, "match.d2");
    rejects((s) => { s.matches[0].twist = "Not A Key!"; }, "match.twist");
    rejects((s) => { s.matches[0].tier = 4; }, "match.tier");
    rejects((s) => { s.matches[0].tier = 0; }, "match.tier");
    rejects((s) => { s.matches[0].thirdPlace = "yes"; }, "match.thirdPlace");
  });

  it("rejects bad modeState extras", () => {
    rejects((s) => { s.modeState = { alive: ["nobody"] }; }, "unknown player");
    rejects((s) => { s.modeState = { eliminated: [{ id: "p1", round: 999 }] }; }, "eliminated");
    rejects((s) => { s.modeState = { groups: { A: ["nobody"] } }; }, "unknown player");
    rejects((s) => { s.modeState = { groups: [1] }; }, "groups");
  });

  it("does not store unknown keys on a match or in modeState", async () => {
    const s = base();
    s.matches[0].somethingNew = "x";
    s.modeState = { somethingNew: 1 };
    const { out } = await saveAndCompose(s);
    expect(out.matches[0].somethingNew).toBeUndefined();
    expect(out.modeState.somethingNew).toBeUndefined();
  });
});

describe("history record round trip", () => {
  // parseHistoryRecord -> the record the route stores (after jsonb)
  function viaRows(record) {
    return JSON.parse(JSON.stringify(toStoredRecord(parseHistoryRecord(record))));
  }

  const full = {
    id: "t1", date: "2026-01-02T03:04:05.000Z", mode: "league",
    players: ["Tigers", "Lions", "Dave"], champion: "Tigers",
    topScorer: { name: "Tigers", goals: 4 }, totalGoals: 9,
    results: [
      { name: "Tigers", played: 4, w: 3, d: 1, l: 0, gf: 8, ga: 2 },
      { name: "Lions", played: 4, w: 1, d: 1, l: 2, gf: 3, ga: 5 },
      { name: "Dave", played: 4, w: 0, d: 2, l: 2, gf: 2, ga: 6 },
    ],
    teams: { Tigers: ["Sam", "Ali"], Lions: ["Jess", "Kit"] },
    prize: "Pick the film", chore: "Set the table", lastPlace: ["Dave"],
  };

  it("keeps teams, prize, chore and lastPlace", () => {
    expect(viaRows(full)).toEqual(full);
  });

  it("a plain record keeps its old shape (no teams/prize/chore/lastPlace keys)", () => {
    const { teams, prize, chore, lastPlace, ...plain } = full; // eslint-disable-line no-unused-vars
    const out = viaRows(plain);
    expect(out).toEqual(plain);
    ["teams", "prize", "chore", "lastPlace"].forEach((k) => expect(k in out).toBe(false));
  });

  it("rejects malformed teams, stakes and lastPlace", () => {
    expect(() => parseHistoryRecord({ ...full, teams: { Tigers: "Sam" } })).toThrow("record.teams");
    expect(() => parseHistoryRecord({ ...full, teams: { Tigers: Array(9).fill("x") } })).toThrow("record.teams");
    expect(() => parseHistoryRecord({ ...full, prize: "x".repeat(41) })).toThrow("record.prize");
    expect(() => parseHistoryRecord({ ...full, chore: 7 })).toThrow("record.chore");
    expect(() => parseHistoryRecord({ ...full, lastPlace: "Dave" })).toThrow("record.lastPlace");
    expect(() => parseHistoryRecord({ ...full, mode: "nope" })).toThrow("unknown mode");
  });
});
