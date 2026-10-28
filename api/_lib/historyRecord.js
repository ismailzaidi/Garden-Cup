/* ---------- history record <-> rows ----------
 * Validates the record the client POSTs (the shape built in
 * src/engine/useTournament.js) and rebuilds it for GET. Kept out of the route
 * file so the round trip can be tested without a request.
 *
 * The core fields are coerced rather than rejected (a record from an older
 * client must still be accepted). The fields added for teams and stakes are
 * checked strictly: they are new, so there is no old client to be lenient
 * for, and a bad value should fail once with a 422 rather than be stored.
 */
import { MODE_STAGES } from "./modes.js";
import { ValidationError } from "./serializer.js";

const MAX_NAME = 24;
const MAX_MEMBERS = 8;
const MAX_PLAYERS = 64;

const parseJson = (v) => (typeof v === "string" ? JSON.parse(v) : v);
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
    teamsJson: teams ? JSON.stringify(teams) : null,
    prize: optionalText(record.prize, "record.prize"),
    chore: optionalText(record.chore, "record.chore"),
    lastPlaceJson: lastPlace ? JSON.stringify(lastPlace) : null,
  };
}

/** One tournament_history row plus its tournament_history_players rows -> the client's record. */
export function historyRowToRecord(r, players) {
  const record = {
    id: r.client_id,
    date: new Date(r.played_at).toISOString(),
    mode: r.mode,
    players: players.map((p) => p.name),
    champion: r.champion,
    topScorer: r.top_scorer_name ? { name: r.top_scorer_name, goals: r.top_scorer_goals } : null,
    totalGoals: r.total_goals,
  };
  // pre-002 rows never wrote these columns, so every `w` comes back
  // NULL — that's "no results", not "0 wins", so the key is omitted
  // entirely rather than attached with zeroes.
  if (players.some((p) => p.w !== null)) {
    record.results = players.map((p) => ({
      name: p.name, played: p.played ?? 0, w: p.w ?? 0, d: p.d ?? 0, l: p.l ?? 0, gf: p.gf ?? 0, ga: p.ga ?? 0,
    }));
  }
  // like the client, only present when used, so a plain record keeps its old shape
  if (r.teams_json) record.teams = parseJson(r.teams_json);
  if (r.prize) record.prize = r.prize;
  if (r.chore) record.chore = r.chore;
  if (r.last_place_json) record.lastPlace = parseJson(r.last_place_json);
  return record;
}
