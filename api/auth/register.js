import { withConnection } from "../_lib/db.js";
import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge, getClientIp } from "../_lib/http.js";
import { hashPassword, newSessionToken, hashToken, setSessionCookie, checkIpRateLimit, recordLoginAttempt, safeEqual } from "../_lib/auth.js";
import { ulid } from "../_lib/id.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["POST"])) return;
  if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");

  const { email, password, displayName, inviteCode } = req.body || {};
  const ip = getClientIp(req);

  // Shares its budget with login's per-IP limit (both write to
  // login_attempts) — without this, registration is an unthrottled
  // "does this email exist" oracle via the 409 below, and (when
  // SIGNUP_INVITE_CODE is unset) an unthrottled account-creation endpoint.
  const ipOk = await withConnection((conn) => checkIpRateLimit(conn, ip));
  if (!ipOk) return sendError(res, 429, "too_many_attempts", "Too many attempts. Try again later.");

  if (typeof email !== "string" || email.length > 190 || !EMAIL_RE.test(email.trim())) {
    return sendError(res, 422, "invalid_email", "Enter a valid email address");
  }
  if (typeof password !== "string" || password.length < 10 || password.length > 256) {
    return sendError(res, 422, "invalid_password", "Password must be at least 10 characters");
  }
  const name = typeof displayName === "string" ? displayName.trim().slice(0, 60) : "";
  if (!name) return sendError(res, 422, "invalid_display_name", "Enter a display name");

  const requiredInvite = process.env.SIGNUP_INVITE_CODE;
  if (requiredInvite && !safeEqual(inviteCode, requiredInvite)) {
    return sendError(res, 403, "invite_required", "A valid invite code is required to sign up");
  }

  const normalizedEmail = email.trim().toLowerCase();

  await withConnection(async (conn) => {
    const passwordHash = await hashPassword(password);
    const userId = ulid();
    try {
      await conn.query(
        "INSERT INTO users (id, email, password_hash, display_name) VALUES (?,?,?,?)",
        [userId, normalizedEmail, passwordHash, name]
      );
    } catch (e) {
      if (e && (e.errno === 1062 || e.code === "ER_DUP_ENTRY")) {
        await recordLoginAttempt(conn, normalizedEmail, ip, false);
        sendError(res, 409, "email_taken", "That email is already registered");
        return;
      }
      throw e;
    }
    await recordLoginAttempt(conn, normalizedEmail, ip, true);

    const token = newSessionToken();
    const days = Number(process.env.TOKEN_TTL_DAYS || 90);
    await conn.query(
      "INSERT INTO auth_tokens (token_hash, user_id, expires_at, user_agent) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? DAY, ?)",
      [hashToken(token), userId, days, String(req.headers["user-agent"] || "").slice(0, 255)]
    );

    setSessionCookie(res, req, token);
    sendJson(res, 201, { user: { id: userId, email: normalizedEmail, displayName: name } });
  });
});
