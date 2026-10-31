import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge } from "../_lib/http.js";
import { createRequestClient, supabaseConfigured } from "../_lib/supabase.js";
import { publicUser } from "../_lib/auth.js";
import { authErrorResponse } from "../_lib/authErrors.js";

/* Supabase Auth checks the password and rate-limits attempts; a success
   writes the session cookies through the request client. */
export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["POST"])) return;
  if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");
  if (!supabaseConfigured()) return sendError(res, 503, "not_configured", "Accounts are not set up on this server");

  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return sendError(res, 422, "invalid_request", "Email and password are required");
  }

  const db = createRequestClient(req, res);
  const { data, error } = await db.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return authErrorResponse(res, error);

  sendJson(res, 200, { user: publicUser(data.user) });
});
