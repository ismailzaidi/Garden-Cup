import { withConnection, withTransaction } from "../_lib/db.js";
import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";
import { ulid } from "../_lib/id.js";
import { MODE_STAGES } from "../_lib/modes.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "POST", "DELETE"])) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const history = await withConnection(async (conn) => {
      const rows = await conn.query(
        `SELECT id, client_id, played_at, mode, champion, top_scorer_name, top_scorer_goals, total_goals
         FROM tournament_history WHERE user_id=? ORDER BY played_at DESC`,
        [user.id]
      );
      const out = [];
      for (const r of rows) {
        const players = await conn.query(
          "SELECT name FROM tournament_history_players WHERE history_id=? ORDER BY sort_order",
          [r.id]
        );
        out.push({
          id: r.client_id,
          date: new Date(r.played_at).toISOString(),
          mode: r.mode,
          players: players.map((p) => p.name),
          champion: r.champion,
          topScorer: r.top_scorer_name ? { name: r.top_scorer_name, goals: r.top_scorer_goals } : null,
          totalGoals: r.total_goals,
        });
      }
      return out;
    });
    return sendJson(res, 200, { history });
  }

  if (req.method === "POST") {
    if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");
    const record = req.body?.record;
    if (!record || typeof record !== "object") return sendError(res, 422, "invalid_request", "record is required");

    const clientId = String(record.id || "").slice(0, 24);
    if (!clientId) return sendError(res, 422, "invalid_request", "record.id is required");
    const mode = String(record.mode || "");
    if (!MODE_STAGES[mode]) return sendError(res, 422, "invalid_state", `unknown mode "${mode}"`);
    const players = Array.isArray(record.players) ? record.players.slice(0, 64).map((n) => String(n).slice(0, 24)) : [];
    const champion = String(record.champion || "").slice(0, 24);
    const totalGoals = Number.isFinite(Number(record.totalGoals)) ? Math.trunc(Number(record.totalGoals)) : 0;
    const topScorerName = record.topScorer && record.topScorer.name ? String(record.topScorer.name).slice(0, 24) : null;
    const topScorerGoals = record.topScorer && Number.isFinite(Number(record.topScorer.goals)) ? Math.trunc(Number(record.topScorer.goals)) : null;
    const playedAt = record.date && !Number.isNaN(Date.parse(record.date)) ? new Date(record.date) : new Date();

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
           (id, user_id, client_id, played_at, mode, champion, top_scorer_name, top_scorer_goals, total_goals)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE id = id`,
        [historyId, user.id, clientId, playedAt, mode, champion, topScorerName, topScorerGoals, totalGoals]
      );
      const inserted = Number(res.affectedRows) === 1;
      if (inserted) {
        for (let i = 0; i < players.length; i++) {
          await conn.query(
            "INSERT INTO tournament_history_players (history_id, sort_order, name) VALUES (?,?,?)",
            [historyId, i, players[i]]
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
