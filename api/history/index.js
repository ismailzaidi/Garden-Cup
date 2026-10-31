import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";
import { ValidationError } from "../_lib/state.js";
import { parseHistoryRecord, toStoredRecord } from "../_lib/historyRecord.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "POST", "DELETE"])) return;
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user, db } = auth;

  if (req.method === "GET") {
    const { data, error } = await db.from("tournament_history")
      .select("record")
      .eq("user_id", user.id)
      .order("played_at", { ascending: false });
    if (error) throw error;
    return sendJson(res, 200, { history: data.map((r) => r.record) });
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

    // Idempotent on the record's own id: a retry, or the same record sent
    // from two devices, is ignored rather than stored twice.
    const { error } = await db.from("tournament_history").upsert({
      user_id: user.id,
      client_id: parsed.clientId,
      mode: parsed.mode,
      played_at: parsed.playedAt.toISOString(),
      record: toStoredRecord(parsed),
    }, { onConflict: "user_id,client_id", ignoreDuplicates: true });
    if (error) throw error;

    return sendJson(res, 201, { record, saved: true });
  }

  if (req.method === "DELETE") {
    const { error } = await db.from("tournament_history").delete().eq("user_id", user.id);
    if (error) throw error;
    return res.status(204).end();
  }
});
