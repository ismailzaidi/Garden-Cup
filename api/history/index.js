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
          "SELECT name, played, w, d, l, gf, ga FROM tournament_history_players WHERE history_id=? ORDER BY sort_order",
          [r.id]
        );
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

    // record.results is step B: per-player match record, keyed by name
    // since player ids are per-tournament. Older clients never send it.
    const clampCount = (n) => {
      const v = Number(n);
      return Number.isFinite(v) ? Math.max(0, Math.min(65535, Math.trunc(v))) : 0;
    };
    const resultByName = new Map();
    (Array.isArray(record.results) ? record.results.slice(0, 64) : []).forEach((r) => {
      if (!r || typeof r !== "object" || !r.name) return;
      resultByName.set(String(r.name).slice(0, 24), {
        played: clampCount(r.played), w: clampCount(r.w), d: clampCount(r.d),
        l: clampCount(r.l), gf: clampCount(r.gf), ga: clampCount(r.ga),
      });
    });

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
