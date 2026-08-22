import { withConnection, withTransaction } from "../_lib/db.js";
import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";
import { composeCurrentTournament, saveCurrentTournament, ValidationError } from "../_lib/serializer.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "PUT", "DELETE"])) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const result = await withConnection((conn) => composeCurrentTournament(conn, user.id));
    return sendJson(res, 200, result);
  }

  if (req.method === "PUT") {
    if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");
    const { expectedVersion, state } = req.body || {};
    if (typeof expectedVersion !== "number") {
      return sendError(res, 422, "invalid_request", "expectedVersion is required");
    }
    try {
      const result = await withTransaction((conn) => saveCurrentTournament(conn, user.id, expectedVersion, state));
      return sendJson(res, 200, result);
    } catch (e) {
      if (e && e.conflict) return sendJson(res, 409, { error: "conflict", version: e.version, state: e.state });
      if (e instanceof ValidationError) return sendError(res, 422, "invalid_state", e.message);
      throw e;
    }
  }

  if (req.method === "DELETE") {
    await withConnection((conn) => conn.query(
      "UPDATE tournaments SET status='archived' WHERE user_id=? AND status='active'",
      [user.id]
    ));
    return res.status(204).end();
  }
});
