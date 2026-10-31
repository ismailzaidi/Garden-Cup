import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";
import { rateLimit } from "../_lib/rateLimit.js";
import { validateState, toStoredState, ValidationError } from "../_lib/state.js";

/* The tournament in progress. PUT carries the version the client last saw;
   the database function save_current_tournament checks it and saves in one
   transaction (supabase/migrations). A stale version gets 409 with the
   newer copy, which the client's sync engine turns into the conflict
   banner. */
export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "PUT", "DELETE"])) return;
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user, db } = auth;
  if (!(await rateLimit(res, db, [["dataUser", user.id]]))) return;

  if (req.method === "GET") {
    const { data, error } = await db.from("tournaments")
      .select("version, state")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return sendJson(res, 200, data ? { version: data.version, state: data.state } : { version: 0, state: null });
  }

  if (req.method === "PUT") {
    if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");
    const { expectedVersion, state } = req.body || {};
    if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
      return sendError(res, 422, "invalid_request", "expectedVersion is required");
    }
    let v;
    try {
      v = validateState(state);
    } catch (e) {
      if (e instanceof ValidationError) return sendError(res, 422, "invalid_state", e.message);
      throw e;
    }
    const { data, error } = await db.rpc("save_current_tournament", {
      p_client_id: v.tournamentId,
      p_mode: v.mode,
      p_state: toStoredState(v),
      p_history_saved: v.historySaved,
      p_expected_version: expectedVersion,
    });
    if (error) throw error;
    if (data.conflict) return sendJson(res, 409, { error: "conflict", version: data.version, state: data.state });
    return sendJson(res, 200, { version: data.version });
  }

  if (req.method === "DELETE") {
    const { error } = await db.from("tournaments")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "active");
    if (error) throw error;
    return res.status(204).end();
  }
});
