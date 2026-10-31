/* ---------- the saved tournament: validate, then store as is ----------
 * The client PUTs its whole tournament (src/engine/useTournament.js's saved
 * shape). It is validated here and stored as one jsonb document
 * (supabase/migrations), then handed back unchanged on GET. Two traps a
 * change here can silently break:
 *   1. s1/s2 must come back as STRINGS: the client does
 *      String(Number(m[side]) + 1) and renders it directly.
 *   2. Array order is data: goals[] drives undo, matches[] drives fixture
 *      display, modeState.queue[] decides who plays next. Never sort them.
 *
 * Nothing the client keeps may be silently dropped: a field is either
 * validated below or rejected. tests/state.test.js plays every mode through
 * and checks the round trip is lossless, so a new mode that invents a field
 * fails there instead of losing data in production.
 */
import { MODE_STAGES, isValidStage } from "./modes.js";

export class ValidationError extends Error {}

function str(v, max, field) {
  if (typeof v !== "string" || v.length === 0 || v.length > max) throw new ValidationError(`invalid ${field}`);
  return v;
}
function strOrNull(v, max, field) {
  if (v === null || v === undefined) return null;
  return str(v, max, field);
}
// Every number is bounded (65535 unless a field says otherwise). An
// unbounded value would be stored and then break the client later; a 422
// now fails once, clearly, instead of the sync engine retrying forever.
function nonNegInt(v, field, max = 65535) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new ValidationError(`invalid ${field}`);
  return Math.trunc(n);
}
function intOrNull(v, field, max = 65535) {
  return v === null || v === undefined ? null : nonNegInt(v, field, max);
}
function assertNoDuplicates(ids, label) {
  if (new Set(ids).size !== ids.length) throw new ValidationError(`duplicate ${label} id`);
}

/* ---------- the JSON-column fields ---------- */
const MAX_MEMBERS = 8; // engine/teams.js

function validateMembers(v) {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_MEMBERS) throw new ValidationError("invalid player.members");
  return v.map((m) => str(m, 24, "player.members[]"));
}

// The per-match fields beyond the columns: the red/yellow card badges and
// docked points (engine/cards.js), the dealt rule and its tier (chaos and
// horror; engine/twists.js, engine/tiers.js) and the World Cup's group and
// third-place flag. Whitelisted by name — anything else on a match is not
// stored — and every value is type- and range-checked.
const MATCH_EXTRA_FIELDS = {
  c1: (v) => nonNegInt(v, "match.c1"),
  c2: (v) => nonNegInt(v, "match.c2"),
  r1: (v) => nonNegInt(v, "match.r1"),
  r2: (v) => nonNegInt(v, "match.r2"),
  d1: (v) => nonNegInt(v, "match.d1"),
  d2: (v) => nonNegInt(v, "match.d2"),
  twist: (v) => {
    if (typeof v !== "string" || !/^[a-z0-9-]{1,32}$/.test(v)) throw new ValidationError("invalid match.twist");
    return v;
  },
  tier: (v) => {
    const n = nonNegInt(v, "match.tier", 3);
    if (n < 1) throw new ValidationError("invalid match.tier");
    return n;
  },
  group: (v) => str(v, 8, "match.group"),
  thirdPlace: (v) => {
    if (typeof v !== "boolean") throw new ValidationError("invalid match.thirdPlace");
    return v;
  },
};

function validateMatchExtra(m) {
  const extra = {};
  for (const [key, check] of Object.entries(MATCH_EXTRA_FIELDS)) {
    if (m[key] !== undefined && m[key] !== null) extra[key] = check(m[key]);
  }
  return Object.keys(extra).length ? extra : null;
}

// What the tournament is played for (engine/stakes.js): both text boxes are
// capped at 40 characters client-side.
function validateStakes(v) {
  const stakes = { prize: "", chore: "" };
  if (v === undefined || v === null) return stakes;
  if (typeof v !== "object" || Array.isArray(v)) throw new ValidationError("invalid stakes");
  for (const key of ["prize", "chore"]) {
    if (v[key] === undefined || v[key] === null) continue;
    if (typeof v[key] !== "string" || v[key].length > 40) throw new ValidationError(`invalid stakes.${key}`);
    stakes[key] = v[key];
  }
  return stakes;
}

// modeState is open-ended per mode (src/modes/contract.md). Besides king's
// `queue` (checked in validateState), these are the other keys the built-in modes keep: survivor's
// alive/eliminated and the World Cup's group draw. A key not listed here is
// not stored — add it here (and to tests/state.test.js) with the mode.
function validateModeStateExtra(modeState, playerIds) {
  const out = {};
  const ids = (list, label) => {
    if (!Array.isArray(list) || list.length > 64) throw new ValidationError(`invalid modeState.${label}`);
    return list.map((pid) => {
      str(pid, 24, `modeState.${label}[]`);
      if (!playerIds.has(pid)) throw new ValidationError(`modeState.${label} references an unknown player`);
      return pid;
    });
  };
  if (modeState.alive !== undefined) out.alive = ids(modeState.alive, "alive");
  if (modeState.eliminated !== undefined) {
    if (!Array.isArray(modeState.eliminated) || modeState.eliminated.length > 64) throw new ValidationError("invalid modeState.eliminated");
    out.eliminated = modeState.eliminated.map((e) => {
      if (!e || typeof e !== "object") throw new ValidationError("invalid modeState.eliminated[]");
      const id = str(e.id, 24, "modeState.eliminated[].id");
      if (!playerIds.has(id)) throw new ValidationError("modeState.eliminated references an unknown player");
      return { id, round: nonNegInt(e.round, "modeState.eliminated[].round", 255) };
    });
  }
  if (modeState.groups !== undefined) {
    const g = modeState.groups;
    if (!g || typeof g !== "object" || Array.isArray(g) || Object.keys(g).length > 4) throw new ValidationError("invalid modeState.groups");
    out.groups = {};
    for (const key of Object.keys(g)) out.groups[str(key, 8, "modeState.groups key")] = ids(g[key], "groups[]");
  }
  return Object.keys(out).length ? out : null;
}

const stringifyChecked = (value, max, field) => {
  const json = JSON.stringify(value);
  if (json.length > max) throw new ValidationError(`${field} is larger than expected`);
  return json;
};

export function validateState(state) {
  if (!state || typeof state !== "object") throw new ValidationError("state must be an object");

  const mode = str(state.mode, 24, "mode");
  if (!MODE_STAGES[mode]) throw new ValidationError(`unknown mode "${mode}"`);
  const tournamentId = str(state.tournamentId, 24, "tournamentId");

  if (!Array.isArray(state.players)) throw new ValidationError("players must be an array");
  if (!Array.isArray(state.matches)) throw new ValidationError("matches must be an array");
  if (!Array.isArray(state.goals)) throw new ValidationError("goals must be an array");
  if (state.players.length > 64 || state.matches.length > 2000 || state.goals.length > 5000) {
    throw new ValidationError("state is larger than a real tournament should be");
  }

  const players = state.players.map((p) => {
    const members = validateMembers(p.members);
    return { id: str(p.id, 24, "player.id"), name: str(p.name, 24, "player.name"), ...(members ? { members } : {}) };
  });
  assertNoDuplicates(players.map((p) => p.id), "player");
  const playerIds = new Set(players.map((p) => p.id));

  const matches = state.matches.map((m) => {
    const stage = str(m.stage, 24, "match.stage");
    if (!isValidStage(mode, stage)) throw new ValidationError(`stage "${stage}" is not valid for mode "${mode}"`);
    const p1 = strOrNull(m.p1, 24, "match.p1");
    const p2 = strOrNull(m.p2, 24, "match.p2");
    if (p1 !== null && !playerIds.has(p1)) throw new ValidationError("match.p1 references an unknown player");
    if (p2 !== null && !playerIds.has(p2)) throw new ValidationError("match.p2 references an unknown player");
    return {
      id: str(m.id, 24, "match.id"),
      stage,
      leg: intOrNull(m.leg, "match.leg", 255),
      round: intOrNull(m.round, "match.round"),
      seq: intOrNull(m.seq, "match.seq"),
      p1, p2,
      s1: nonNegInt(m.s1, "match.s1"),
      s2: nonNegInt(m.s2, "match.s2"),
      played: Boolean(m.played),
      bye: Boolean(m.bye),
      extra: validateMatchExtra(m),
    };
  });
  assertNoDuplicates(matches.map((m) => m.id), "match");
  const matchIds = new Set(matches.map((m) => m.id));

  const goals = state.goals.map((g) => {
    const stage = str(g.stage, 24, "goal.stage");
    if (!isValidStage(mode, stage)) throw new ValidationError(`goal stage "${stage}" is not valid for mode "${mode}"`);
    const matchId = str(g.matchId, 24, "goal.matchId");
    if (!matchIds.has(matchId)) throw new ValidationError("goal.matchId references an unknown match");
    const playerId = str(g.playerId, 24, "goal.playerId");
    if (!playerIds.has(playerId)) throw new ValidationError("goal.playerId references an unknown player");
    return {
      id: str(g.id, 24, "goal.id"),
      matchId, playerId,
      second: nonNegInt(g.second, "goal.second"),
      duration: nonNegInt(g.duration, "goal.duration"),
      stage,
    };
  });
  assertNoDuplicates(goals.map((g) => g.id), "goal");

  let configJson;
  try {
    configJson = JSON.stringify(state.config ?? {});
  } catch {
    throw new ValidationError("config must be JSON-serialisable");
  }
  if (configJson.length > 8192) throw new ValidationError("config is larger than expected");

  const modeState = state.modeState && typeof state.modeState === "object" ? state.modeState : {};
  const queueRaw = Array.isArray(modeState.queue) ? modeState.queue : [];
  const queue = queueRaw.map((pid) => str(pid, 24, "modeState.queue[]"));
  for (const pid of queue) if (!playerIds.has(pid)) throw new ValidationError("modeState.queue references an unknown player");
  const modeStateExtra = validateModeStateExtra(modeState, playerIds);
  const modeStateJson = modeStateExtra ? stringifyChecked(modeStateExtra, 4096, "modeState") : null;

  const stakesJson = JSON.stringify(validateStakes(state.stakes));

  return { mode, tournamentId, players, matches, goals, configJson, queue, stakesJson, modeStateJson, historySaved: Boolean(state.historySaved) };
}

/* The validated state, in exactly the shape the client keeps: this is what
   is stored, and what GET and a 409 conflict hand back. */
export function toStoredState(v) {
  return {
    players: v.players,
    matches: v.matches.map(({ extra, ...m }) => ({ ...m, s1: String(m.s1), s2: String(m.s2), ...(extra || {}) })),
    goals: v.goals,
    mode: v.mode,
    config: JSON.parse(v.configJson),
    modeState: {
      ...(v.queue.length ? { queue: v.queue } : {}),
      ...(v.modeStateJson ? JSON.parse(v.modeStateJson) : {}),
    },
    stakes: JSON.parse(v.stakesJson),
    tournamentId: v.tournamentId,
    historySaved: v.historySaved,
    schemaVersion: 2,
  };
}
