/* ---------- a finished tournament's history record ----------
 * Validates the record the client POSTs (the shape built in
 * src/engine/useTournament.js) and builds the clean copy that is stored as
 * jsonb and handed back on GET. Kept out of the route file so the round trip
 * can be tested without a request.
 *
 * The core fields are coerced rather than rejected (a record from an older
 * client must still be accepted). The fields added for teams and stakes are
 * checked strictly: they are new, so there is no old client to be lenient
 * for, and a bad value should fail once with a 422 rather than be stored.
 */
import { MODE_STAGES } from "./modes.js";
import { ValidationError } from "./state.js";

const MAX_NAME = 24;
const MAX_MEMBERS = 8;
const MAX_PLAYERS = 64;

const clampCount = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(65535, Math.trunc(v))) : 0;
};
const name = (v, field) => {
  if (typeof v !== "string" || v.length === 0 || v.length > MAX_NAME) throw new ValidationError(`invalid ${field}`);
  return v;
};

/** `{ "Tigers": ["Sam","Ali"] }` -> same, validated; null when absent. */
function validateTeams(teams) {
  if (teams === undefined || teams === null) return null;
  if (typeof teams !== "object" || Array.isArray(teams)) throw new ValidationError("invalid record.teams");
  const keys = Object.keys(teams);
  if (keys.length === 0) return null;
  if (keys.length > MAX_PLAYERS) throw new ValidationError("invalid record.teams");
  const out = {};
  for (const key of keys) {
    const members = teams[key];
    if (!Array.isArray(members) || members.length === 0 || members.length > MAX_MEMBERS) throw new ValidationError("invalid record.teams");
    out[name(key, "record.teams key")] = members.map((m) => name(m, "record.teams[]"));
  }
  return out;
}

function validateLastPlace(list) {
  if (list === undefined || list === null) return null;
  if (!Array.isArray(list) || list.length > MAX_PLAYERS) throw new ValidationError("invalid record.lastPlace");
  return list.length ? list.map((n) => name(n, "record.lastPlace[]")) : null;
}

function optionalText(v, field) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.length > 40) throw new ValidationError(`invalid ${field}`);
  return v;
}

export function parseHistoryRecord(record) {
  const clientId = String(record.id || "").slice(0, 24);
  if (!clientId) throw new ValidationError("record.id is required");
  const mode = String(record.mode || "");
  if (!Object.prototype.hasOwnProperty.call(MODE_STAGES, mode)) throw new ValidationError(`unknown mode "${mode}"`);

  const players = Array.isArray(record.players) ? record.players.slice(0, MAX_PLAYERS).map((n) => String(n).slice(0, MAX_NAME)) : [];

  // per-player match record, keyed by name since player ids are per-tournament
  const resultByName = new Map();
  (Array.isArray(record.results) ? record.results.slice(0, MAX_PLAYERS) : []).forEach((r) => {
    if (!r || typeof r !== "object" || !r.name) return;
    resultByName.set(String(r.name).slice(0, MAX_NAME), {
      played: clampCount(r.played), w: clampCount(r.w), d: clampCount(r.d),
      l: clampCount(r.l), gf: clampCount(r.gf), ga: clampCount(r.ga),
    });
  });

  const teams = validateTeams(record.teams);
  const lastPlace = validateLastPlace(record.lastPlace);

  return {
    clientId,
    mode,
    players,
    resultByName,
    champion: String(record.champion || "").slice(0, MAX_NAME),
    totalGoals: Number.isFinite(Number(record.totalGoals)) ? Math.trunc(Number(record.totalGoals)) : 0,
    topScorerName: record.topScorer && record.topScorer.name ? String(record.topScorer.name).slice(0, MAX_NAME) : null,
    topScorerGoals: record.topScorer && Number.isFinite(Number(record.topScorer.goals)) ? Math.trunc(Number(record.topScorer.goals)) : null,
    playedAt: record.date && !Number.isNaN(Date.parse(record.date)) ? new Date(record.date) : new Date(),
    teams,
    prize: optionalText(record.prize, "record.prize"),
    chore: optionalText(record.chore, "record.chore"),
    lastPlace,
  };
}

/** The parsed record -> the clean record that is stored and given back. */
export function toStoredRecord(p) {
  const record = {
    id: p.clientId,
    date: p.playedAt.toISOString(),
    mode: p.mode,
    players: p.players,
    champion: p.champion,
    topScorer: p.topScorerName ? { name: p.topScorerName, goals: p.topScorerGoals } : null,
    totalGoals: p.totalGoals,
  };
  // An older client sends no results at all: that's "no results", not
  // "0 wins", so the key is left out rather than filled with zeroes.
  if (p.players.some((name) => p.resultByName.has(name))) {
    record.results = p.players.map((name) => {
      const r = p.resultByName.get(name);
      return { name, played: r?.played ?? 0, w: r?.w ?? 0, d: r?.d ?? 0, l: r?.l ?? 0, gf: r?.gf ?? 0, ga: r?.ga ?? 0 };
    });
  }
  // like the client, only present when used, so a plain record keeps its old shape
  if (p.teams) record.teams = p.teams;
  if (p.prize) record.prize = p.prize;
  if (p.chore) record.chore = p.chore;
  if (p.lastPlace) record.lastPlace = p.lastPlace;
  return record;
}
