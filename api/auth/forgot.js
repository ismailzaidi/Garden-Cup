import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge } from "../_lib/http.js";
import { createRequestClient, supabaseConfigured } from "../_lib/supabase.js";
import { authErrorResponse } from "../_lib/authErrors.js";
import { rateLimit, clientIp } from "../_lib/rateLimit.js";

/* "Forgot password?": emails a reset link (the Reset Password template in
   DEPLOYMENT.md points it at /api/auth/confirm). The reply is the same
   whether or not the email has an account, so this can't be used to find
   out who does. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["POST"])) return;
  if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");
  if (!supabaseConfigured()) return sendError(res, 503, "not_configured", "Accounts are not set up on this server");

  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || email.length > 190 || !EMAIL_RE.test(email)) return sendError(res, 422, "invalid_email", "Enter a valid email address");

  const db = createRequestClient(req, res);
  if (!(await rateLimit(res, db, [["forgotIp", clientIp(req)], ["forgotEmail", email]]))) return;
  const { error } = await db.auth.resetPasswordForEmail(email);
  if (error && (error.status === 429 || String(error.code).startsWith("over_"))) return authErrorResponse(res, error);
  if (error) console.error(error);
  sendJson(res, 200, { sent: true });
});
