/* ---------- state <-> rows ----------
 * Decomposes the JSON blob the client PUTs (src/engine/useTournament.js's
 * saved shape) into normalised rows, and recomposes it on GET. Two traps
 * that a change here can silently break:
 *   1. s1/s2 must come back as STRINGS — the client does
 *      String(Number(m[side]) + 1) and renders it directly.
 *   2. Array order is data — goals[] drives undo, matches[] drives fixture
 *      display, modeState.queue[] decides who plays next. Always write and
 *      read sort_order (position for mode_queue) from the array index.
 *
 * Nothing the client keeps may be silently dropped: a field either has a
 * column, lives in one of the validated JSON columns added by
 * migrations/003_lossless_state.sql (team members, stakes, per-match extras,
 * the non-queue part of modeState), or is rejected. tests/serializer.test.js
 * plays every mode through and checks the round trip is lossless, so a new
 * mode that invents a field fails there instead of losing data in production.
 */
import { ulid } from "./id.js";
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
// max defaults to SMALLINT UNSIGNED's ceiling — every numeric column this
// feeds is either that or TINYINT UNSIGNED (leg, max 255), so an explicit
// max is only needed for that one caller. Without a bound here, a
// column-busting value throws an uncaught SQL error deep in a transaction,
// which surfaces as a 500 that the client's sync engine treats as
// retryable — i.e. an unbounded number silently wedges that write into an
// infinite retry loop instead of failing once with a clear 422.
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

// mariadb returns a JSON column as text, MySQL as an already-parsed value
const parseJson = (v) => (typeof v === "string" ? JSON.parse(v) : v);

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

// modeState is open-ended per mode (src/modes/contract.md). `queue` has its
// own table; these are the other keys the built-in modes keep: survivor's
// alive/eliminated and the World Cup's group draw. A key not listed here is
// not stored — add it here (and to tests/serializer.test.js) with the mode.
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
      leg: intOrNull(m.leg, "match.leg", 255), // TINYINT UNSIGNED
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

/* ---------- row <-> object (pure; the SQL below only moves these around) ---------- */
export const matchExtraJson = (m) => (m.extra ? stringifyChecked(m.extra, 512, "match extras") : null);
export const membersJson = (p) => (p.members ? JSON.stringify(p.members) : null);

export const playerFromRow = (p) => {
  const members = p.members_json ? parseJson(p.members_json) : null;
  return { id: p.client_id, name: p.name, ...(members ? { members } : {}) };
};

export const matchFromRow = (m) => ({
  id: m.client_id,
  stage: m.stage,
  leg: m.leg,
  round: m.round,
  seq: m.seq,
  p1: m.p1_client_id,
  p2: m.p2_client_id,
  s1: String(m.s1),
  s2: String(m.s2),
  played: Boolean(m.played),
  bye: Boolean(m.bye),
  ...(m.extra_json ? parseJson(m.extra_json) : {}),
});

/** Runs inside a transaction. Throws {conflict:true, version, state} on a version mismatch. */
export async function saveCurrentTournament(conn, userId, expectedVersion, rawState) {
  const v = validateState(rawState);

  const existing = await conn.query(
    "SELECT id, version FROM tournaments WHERE user_id = ? AND client_id = ? FOR UPDATE",
    [userId, v.tournamentId]
  );

  let tournamentRowId;
  let newVersion;

  if (existing.length) {
    const row = existing[0];
    if (Number(row.version) !== Number(expectedVersion)) {
      // Compose *this* row, not "whatever is currently active for the
      // user" — those can differ (e.g. this row was since archived by a
      // newer tournament on another device), and composing the wrong one
      // used to hand back {state: null} for an active-but-different
      // tournament, which the client then misread as "synced" while the
      // write had actually gone nowhere. The row is still guaranteed to
      // exist here: it's locked by the FOR UPDATE above, in the same
      // transaction.
      const current = await composeTournamentRow(conn, row.id);
      const err = new Error("conflict");
      err.conflict = true;
      err.version = Number(row.version);
      err.state = current;
      throw err;
    }
    tournamentRowId = row.id;
    newVersion = Number(row.version) + 1;
    await conn.query(
      `UPDATE tournaments SET mode=?, config_json=?, stakes_json=?, mode_state_json=?, history_saved=?, status='active', version=?
       WHERE id=?`,
      [v.mode, v.configJson, v.stakesJson, v.modeStateJson, v.historySaved ? 1 : 0, newVersion, tournamentRowId]
    );
  } else {
    tournamentRowId = ulid();
    newVersion = 1;
    await conn.query(
      `INSERT INTO tournaments (id, user_id, client_id, mode, config_json, stakes_json, mode_state_json, history_saved, status, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [tournamentRowId, userId, v.tournamentId, v.mode, v.configJson, v.stakesJson, v.modeStateJson, v.historySaved ? 1 : 0, newVersion]
    );
  }

  // Exactly one "active" tournament per user, so GET /tournaments/current always resolves to one row.
  await conn.query("UPDATE tournaments SET status='archived' WHERE user_id=? AND id<>? AND status='active'", [userId, tournamentRowId]);

  await conn.query("DELETE FROM players WHERE tournament_id=?", [tournamentRowId]);
  await conn.query("DELETE FROM matches WHERE tournament_id=?", [tournamentRowId]);
  await conn.query("DELETE FROM goals WHERE tournament_id=?", [tournamentRowId]);
  await conn.query("DELETE FROM mode_queue WHERE tournament_id=?", [tournamentRowId]);

  for (let i = 0; i < v.players.length; i++) {
    const p = v.players[i];
    await conn.query(
      "INSERT INTO players (tournament_id, client_id, name, members_json, sort_order) VALUES (?,?,?,?,?)",
      [tournamentRowId, p.id, p.name, membersJson(p), i]
    );
  }
  for (let i = 0; i < v.matches.length; i++) {
    const m = v.matches[i];
    await conn.query(
      `INSERT INTO matches (tournament_id, client_id, stage, leg, \`round\`, seq, p1_client_id, p2_client_id, s1, s2, played, bye, extra_json, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [tournamentRowId, m.id, m.stage, m.leg, m.round, m.seq, m.p1, m.p2, m.s1, m.s2, m.played ? 1 : 0, m.bye ? 1 : 0, matchExtraJson(m), i]
    );
  }
  for (let i = 0; i < v.goals.length; i++) {
    const g = v.goals[i];
    await conn.query(
      `INSERT INTO goals (tournament_id, client_id, match_client_id, player_client_id, goal_second, duration, stage, sort_order)
       VALUES (?,?,?,?,?,?,?,?)`,
      [tournamentRowId, g.id, g.matchId, g.playerId, g.second, g.duration, g.stage, i]
    );
  }
  for (let i = 0; i < v.queue.length; i++) {
    await conn.query("INSERT INTO mode_queue (tournament_id, queue_key, position, player_client_id) VALUES (?, 'queue', ?, ?)", [tournamentRowId, i, v.queue[i]]);
  }

  return { version: newVersion };
}

// Composes one tournament row by its server-side id, regardless of its
// status — used both for "the user's current tournament" (below) and for
// "the specific row a 409 conflicted on" (saveCurrentTournament above),
// which is not always the same row.
export async function composeTournamentRow(conn, tournamentRowId) {
  const trows = await conn.query(
    "SELECT id, client_id, mode, config_json, stakes_json, mode_state_json, history_saved FROM tournaments WHERE id=? LIMIT 1",
    [tournamentRowId]
  );
  if (!trows.length) return null;
  const t = trows[0];

  const players = await conn.query("SELECT client_id, name, members_json FROM players WHERE tournament_id=? ORDER BY sort_order", [t.id]);
  const matches = await conn.query(
    `SELECT client_id, stage, leg, \`round\`, seq, p1_client_id, p2_client_id, s1, s2, played, bye, extra_json
     FROM matches WHERE tournament_id=? ORDER BY sort_order`,
    [t.id]
  );
  const goals = await conn.query(
    "SELECT client_id, match_client_id, player_client_id, goal_second, duration, stage FROM goals WHERE tournament_id=? ORDER BY sort_order",
    [t.id]
  );
  const queue = await conn.query(
    "SELECT player_client_id FROM mode_queue WHERE tournament_id=? AND queue_key='queue' ORDER BY position",
    [t.id]
  );

  return {
    players: players.map(playerFromRow),
    matches: matches.map(matchFromRow),
    goals: goals.map((g) => ({
      id: g.client_id,
      matchId: g.match_client_id,
      playerId: g.player_client_id,
      second: g.goal_second,
      duration: g.duration,
      stage: g.stage,
    })),
    mode: t.mode,
    config: JSON.parse(t.config_json || "{}"),
    modeState: {
      ...(queue.length ? { queue: queue.map((q) => q.player_client_id) } : {}),
      ...(t.mode_state_json ? parseJson(t.mode_state_json) : {}),
    },
    stakes: { prize: "", chore: "", ...(t.stakes_json ? parseJson(t.stakes_json) : {}) },
    tournamentId: t.client_id,
    historySaved: Boolean(t.history_saved),
    schemaVersion: 2,
  };
}

export async function composeCurrentTournament(conn, userId) {
  const trows = await conn.query(
    "SELECT id, version FROM tournaments WHERE user_id=? AND status='active' LIMIT 1",
    [userId]
  );
  if (!trows.length) return { version: 0, state: null };
  const state = await composeTournamentRow(conn, trows[0].id);
  return { version: Number(trows[0].version), state };
}
