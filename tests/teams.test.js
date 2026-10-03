import { describe, it, expect } from "vitest";
import { parseMembers, teamsOf, membersOf } from "../src/engine/teams.js";
import { computeWinsTable } from "../src/engine/wins.js";

describe("parseMembers", () => {
  it("splits on commas, plus signs and ampersands, trimming each name", () => {
    expect(parseMembers("Sam, Ali")).toEqual(["Sam", "Ali"]);
    expect(parseMembers(" Sam + Ali ")).toEqual(["Sam", "Ali"]);
    expect(parseMembers("Sam & Ali,Zak")).toEqual(["Sam", "Ali", "Zak"]);
  });

  it("drops blanks and a name typed twice, whatever its case", () => {
    expect(parseMembers("Sam,, sam , Ali,")).toEqual(["Sam", "Ali"]);
    expect(parseMembers("")).toEqual([]);
    expect(parseMembers(undefined)).toEqual([]);
  });

  it("caps a name at 24 characters, like a player name", () => {
    expect(parseMembers("x".repeat(40))[0]).toHaveLength(24);
  });
});

describe("teamsOf", () => {
  it("maps each team's name to its members, leaving solo players out", () => {
    const players = [
      { id: "a", name: "Tigers", members: ["Sam", "Ali"] },
      { id: "b", name: "Zak" },
    ];
    expect(teamsOf(players)).toEqual({ Tigers: ["Sam", "Ali"] });
  });

  it("is null when nobody played as a team", () => {
    expect(teamsOf([{ id: "a", name: "Sam" }])).toBeNull();
  });
});

describe("membersOf", () => {
  const record = { teams: { Tigers: ["Sam", "Ali"] } };

  it("resolves a team to its members, ignoring case and stray spaces", () => {
    expect(membersOf(record, "Tigers")).toEqual(["Sam", "Ali"]);
    expect(membersOf(record, " tigers ")).toEqual(["Sam", "Ali"]);
  });

  it("leaves a solo player as themselves", () => {
    expect(membersOf(record, "Zak")).toEqual(["Zak"]);
    expect(membersOf({}, "Zak")).toEqual(["Zak"]);
  });

  it("reads an old 'Sam + Ali' name as the two people in it", () => {
    expect(membersOf({}, "Sam + Ali")).toEqual(["Sam", "Ali"]);
  });
});

describe("computeWinsTable with teams", () => {
  const row = (table, name) => table.find((r) => r.name === name);

  it("credits a team's title, entry and match results to every member", () => {
    const table = computeWinsTable([{
      champion: "Tigers",
      players: ["Tigers", "Lions"],
      teams: { Tigers: ["Sam", "Ali"], Lions: ["Zak", "Bea"] },
      results: [
        { name: "Tigers", played: 3, w: 2, d: 0, l: 1 },
        { name: "Lions", played: 3, w: 1, d: 0, l: 2 },
      ],
    }]);
    expect(table.map((r) => r.name).sort()).toEqual(["Ali", "Bea", "Sam", "Zak"]);
    expect(row(table, "Sam")).toMatchObject({ titles: 1, entered: 1, played: 3, w: 2, l: 1 });
    expect(row(table, "Ali")).toMatchObject({ titles: 1, entered: 1, played: 3, w: 2, l: 1 });
    expect(row(table, "Zak")).toMatchObject({ titles: 0, entered: 1, w: 1, l: 2 });
  });

  it("adds team wins to the same row as that player's solo wins", () => {
    const table = computeWinsTable([
      { champion: "Tigers", players: ["Tigers", "Zak"], teams: { Tigers: ["Sam", "Ali"] } },
      { champion: "Sam", players: ["Sam", "Zak"] },
      { champion: "Lions", players: ["Lions", "Zak"], teams: { Lions: ["sam", "Bea"] } },
    ]);
    expect(row(table, "Sam")).toMatchObject({ titles: 3, entered: 3 });
    expect(row(table, "Ali")).toMatchObject({ titles: 1, entered: 1 });
    expect(row(table, "Zak")).toMatchObject({ titles: 0, entered: 3 });
    expect(row(table, "Tigers")).toBeUndefined();
  });

  it("splits a pair typed as one name before teams existed", () => {
    const table = computeWinsTable([{ champion: "Sam + Ali", players: ["Sam + Ali", "Zak"] }]);
    expect(row(table, "Sam").titles).toBe(1);
    expect(row(table, "Ali").titles).toBe(1);
    expect(row(table, "Sam + Ali")).toBeUndefined();
  });
});
