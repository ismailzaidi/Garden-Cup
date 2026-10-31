import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge } from "../_lib/http.js";
import { createRequestClient, supabaseConfigured } from "../_lib/supabase.js";
import { publicUser } from "../_lib/auth.js";
import { authErrorResponse } from "../_lib/authErrors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Creates the account in Supabase Auth. With email confirmation on (it
   should be, in production) there is no session yet: the reply is 202 and
   the user signs in from the link in the email (api/auth/confirm.js).
   Supabase doesn't reveal whether the email was already registered in that
   case, so this route can't be used to find out who has an account. */
export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["POST"])) return;
  if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");
  if (!supabaseConfigured()) return sendError(res, 503, "not_configured", "Accounts are not set up on this server");

  const { email, password, displayName } = req.body || {};
  if (typeof email !== "string" || email.length > 190 || !EMAIL_RE.test(email.trim())) {
    return sendError(res, 422, "invalid_email", "Enter a valid email address");
  }
  if (typeof password !== "string" || password.length < 10 || password.length > 256) {
    return sendError(res, 422, "invalid_password", "Password must be at least 10 characters");
  }
  const name = typeof displayName === "string" ? displayName.trim().slice(0, 60) : "";
  if (!name) return sendError(res, 422, "invalid_display_name", "Enter a display name");

  const db = createRequestClient(req, res);
  const { data, error } = await db.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { display_name: name } },
  });
  if (error) return authErrorResponse(res, error);

  if (!data.session) return sendJson(res, 202, { confirmationRequired: true });
  sendJson(res, 201, { user: publicUser(data.user) });
});
