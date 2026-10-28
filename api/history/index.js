import { withConnection, withTransaction } from "../_lib/db.js";
import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";
import { ulid } from "../_lib/id.js";
import { ValidationError } from "../_lib/serializer.js";
import { parseHistoryRecord, historyRowToRecord } from "../_lib/historyRecord.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "POST", "DELETE"])) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const history = await withConnection(async (conn) => {
      const rows = await conn.query(
        `SELECT id, client_id, played_at, mode, champion, top_scorer_name, top_scorer_goals, total_goals,
                teams_json, prize, chore, last_place_json
         FROM tournament_history WHERE user_id=? ORDER BY played_at DESC`,
        [user.id]
      );
      const out = [];
      for (const r of rows) {
        const players = await conn.query(
          "SELECT name, played, w, d, l, gf, ga FROM tournament_history_players WHERE history_id=? ORDER BY sort_order",
          [r.id]
        );
        const record = historyRowToRecord(r, players);
        out.push(record);
      }
      return out;
    });
    return sendJson(res, 200, { history });
  }

  if (req.method === "POST") {
    if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");
    const record = req.body?.record;
    if (!record || typeof record !== "object") return sendError(res, 422, "invalid_request", "record is required");

    let parsed;
    try {
      parsed = parseHistoryRecord(record);
    } catch (e) {
      if (e instanceof ValidationError) return sendError(res, 422, "invalid_state", e.message);
      throw e;
    }
    const {
      clientId, mode, players, resultByName, champion, totalGoals, topScorerName, topScorerGoals, playedAt,
      teamsJson, prize, chore, lastPlaceJson,
    } = parsed;

    // A single INSERT ... ON DUPLICATE KEY UPDATE rather than SELECT-then-
    // INSERT: the select-then-insert version has a race (two devices
    // posting the same record concurrently both pass the SELECT, then the
    // second INSERT hits uq_history) and isn't atomic with the player-row
    // inserts (a failure between them left an orphaned header row with a
    // truncated player list — and since this endpoint is idempotent on
    // client_id, a retry of that broken write was a permanent no-op).
    // `id = id` is a no-op update, which is what makes MariaDB report
    // affectedRows === 1 only for a genuine insert (0 for an already-
    // existing row) — that's how we know whether to also write the player
    // rows, without a separate read.
    const saved = await withTransaction(async (conn) => {
      const historyId = ulid();
      const res = await conn.query(
        `INSERT INTO tournament_history
           (id, user_id, client_id, played_at, mode, champion, top_scorer_name, top_scorer_goals, total_goals,
            teams_json, prize, chore, last_place_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE id = id`,
        [historyId, user.id, clientId, playedAt, mode, champion, topScorerName, topScorerGoals, totalGoals,
         teamsJson, prize, chore, lastPlaceJson]
      );
      const inserted = Number(res.affectedRows) === 1;
      if (inserted) {
        for (let i = 0; i < players.length; i++) {
          const r = resultByName.get(players[i]) || null;
          await conn.query(
            `INSERT INTO tournament_history_players (history_id, sort_order, name, played, w, d, l, gf, ga)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [historyId, i, players[i], r?.played ?? null, r?.w ?? null, r?.d ?? null, r?.l ?? null, r?.gf ?? null, r?.ga ?? null]
          );
        }
      }
      return true;
    });

    return sendJson(res, 201, { record, saved });
  }

  if (req.method === "DELETE") {
    await withConnection((conn) => conn.query("DELETE FROM tournament_history WHERE user_id=?", [user.id]));
    return res.status(204).end();
  }
});
