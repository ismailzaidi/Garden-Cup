import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge } from "./_lib/http.js";
import { requireAuth, publicUser } from "./_lib/auth.js";
import { passwordMatches, adminConfigured, createAdminClient } from "./_lib/supabase.js";
import { authErrorResponse } from "./_lib/authErrors.js";
import { rateLimit } from "./_lib/rateLimit.js";

/* My account, for the signed-in user:
 *   PATCH  { displayName }                     change the display name
 *   POST   { currentPassword, newPassword }    change the password
 *   POST   { newPassword }                     set a new one after a reset link
 *   DELETE { password }                        delete the account and all its data
 *
 * Changing the password or deleting the account asks for the current
 * password, so a session left open on a shared device isn't enough. The one
 * exception is the "forgot password" link: it proves the email, and is
 * accepted for an hour after it was sent.
 */
const RESET_WINDOW_MS = 60 * 60 * 1000;

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["PATCH", "POST", "DELETE"])) return;
  if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user, db, raw } = auth;
  const body = req.body || {};
  // a password is checked on POST and DELETE: few tries, so it can't be guessed
  if (!(await rateLimit(res, db, [[req.method === "PATCH" ? "profileUser" : "passwordCheckUser", user.id]]))) return;

  if (req.method === "PATCH") {
    const name = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 60) : "";
    if (!name) return sendError(res, 422, "invalid_display_name", "Enter a display name");
    const { data, error } = await db.auth.updateUser({ data: { display_name: name } });
    if (error) return authErrorResponse(res, error);
    return sendJson(res, 200, { user: publicUser(data.user) });
  }

  if (req.method === "POST") {
    const { currentPassword, newPassword } = body;
    if (typeof newPassword !== "string" || newPassword.length < 10 || newPassword.length > 256) {
      return sendError(res, 422, "invalid_password", "Password must be at least 10 characters");
    }
    if (typeof currentPassword === "string" && currentPassword) {
      const check = await passwordMatches(user.email, currentPassword);
      if (!check.ok) return wrongPassword(res, check.error);
    } else {
      const sentAt = raw.recovery_sent_at ? Date.parse(raw.recovery_sent_at) : NaN;
      if (!(Date.now() - sentAt < RESET_WINDOW_MS)) {
        return sendError(res, 403, "current_password_required", "Enter your current password");
      }
    }
    const { error } = await db.auth.updateUser({ password: newPassword });
    if (error) return authErrorResponse(res, error);
    return res.status(204).end();
  }

  // DELETE
  if (!adminConfigured()) return sendError(res, 503, "not_configured", "Account deletion is not set up on this server");
  if (typeof body.password !== "string" || !body.password) {
    return sendError(res, 422, "invalid_request", "Enter your password to delete your account");
  }
  const check = await passwordMatches(user.email, body.password);
  if (!check.ok) return wrongPassword(res, check.error);

  // Deleting the auth user deletes every row it owns (ON DELETE CASCADE in
  // supabase/migrations), so nothing is left behind.
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) throw error;
  // The session is dead now; this clears its cookies on this device.
  await db.auth.signOut({ scope: "local" }).catch(() => {});
  return res.status(204).end();
});

function wrongPassword(res, error) {
  if (error?.code === "invalid_credentials") return sendError(res, 403, "wrong_password", "That password isn't right");
  return authErrorResponse(res, error);
}
