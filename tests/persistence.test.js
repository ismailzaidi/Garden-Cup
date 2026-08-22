import { describe, it, expect } from "vitest";
import { migrateState } from "../src/engine/persistence.js";

describe("migrateState", () => {
  it("passes through a v2 blob unchanged", () => {
    const v2 = { players: [], matches: [], goals: [], mode: "league", config: { legCount: 2 }, modeState: {}, schemaVersion: 2 };
    expect(migrateState(v2)).toBe(v2);
  });

  it("returns null for no saved state", () => {
    expect(migrateState(null)).toBeNull();
  });

  it("lifts legCount/kingTarget into config for a league v1 blob", () => {
    const v1 = { players: [{ id: "a", name: "Alice" }], matches: [], goals: [], mode: "league", legCount: 4, kingTarget: 3, kingQueue: [], tournamentId: "t1", historySaved: false };
    const migrated = migrateState(v1);
    expect(migrated.config).toEqual({ legCount: 4, kingTarget: 3 });
    expect(migrated.modeState).toEqual({});
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated).not.toHaveProperty("legCount");
    expect(migrated).not.toHaveProperty("kingTarget");
    expect(migrated).not.toHaveProperty("kingQueue");
    expect(migrated.players).toEqual(v1.players);
  });

  it("lifts legCount into config for a roundrobin v1 blob (kingTarget defaults)", () => {
    const v1 = { players: [], matches: [], goals: [], mode: "roundrobin", legCount: 1, kingQueue: [], tournamentId: "t2", historySaved: true };
    const migrated = migrateState(v1);
    expect(migrated.config).toEqual({ legCount: 1, kingTarget: 3 });
    expect(migrated.modeState).toEqual({});
  });

  it("migrates a knockout v1 blob with an empty modeState", () => {
    const v1 = { players: [], matches: [{ id: "m1", stage: "knockout", round: 1 }], goals: [], mode: "knockout", legCount: 3, kingTarget: 3, kingQueue: [], tournamentId: "t3", historySaved: false };
    const migrated = migrateState(v1);
    expect(migrated.modeState).toEqual({});
    expect(migrated.matches).toEqual(v1.matches);
  });

  it("lifts kingQueue into modeState.queue for a king v1 blob", () => {
    const v1 = { players: [], matches: [], goals: [], mode: "king", legCount: 3, kingTarget: 3, kingQueue: ["p1", "p2"], tournamentId: "t4", historySaved: false };
    const migrated = migrateState(v1);
    expect(migrated.modeState).toEqual({ queue: ["p1", "p2"] });
    expect(migrated.config).toEqual({ legCount: 3, kingTarget: 3 });
  });

  it("defaults a missing kingQueue to an empty array", () => {
    const v1 = { players: [], matches: [], goals: [], mode: "king", tournamentId: "t5", historySaved: false };
    const migrated = migrateState(v1);
    expect(migrated.modeState).toEqual({ queue: [] });
    expect(migrated.config).toEqual({ legCount: 3, kingTarget: 3 });
  });
});
