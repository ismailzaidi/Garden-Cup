import { withConnection } from "../_lib/db.js";
import { sendJson, sendError, methodGuard, withErrorHandling, bodyTooLarge, getClientIp } from "../_lib/http.js";
import {
  verifyPassword, hashPassword, needsRehash, newSessionToken, hashToken, setSessionCookie,
  checkEmailRateLimit, checkIpRateLimit, recordLoginAttempt, DUMMY_HASH,
} from "../_lib/auth.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["POST"])) return;
  if (bodyTooLarge(req)) return sendError(res, 413, "payload_too_large", "Request body too large");

  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return sendError(res, 422, "invalid_request", "Email and password are required");
  }
  const normalizedEmail = email.trim().toLowerCase();
  const ip = getClientIp(req);

  await withConnection(async (conn) => {
    // Sequential, not Promise.all: both queries would run on this same
    // connection, and a single MariaDB connection can't safely have two
    // queries in flight on it at once.
    const emailOk = await checkEmailRateLimit(conn, normalizedEmail);
    const ipOk = await checkIpRateLimit(conn, ip);
    if (!emailOk || !ipOk) return sendError(res, 429, "too_many_attempts", "Too many attempts. Try again later.");

    const rows = await conn.query("SELECT id, password_hash FROM users WHERE email=? LIMIT 1", [normalizedEmail]);
    const user = rows[0];
    // Always run a real scrypt verify, even for an unknown email, against a
    // fixed dummy hash — so the two failure modes take the same code path
    // and roughly the same time, and the response never reveals which one it was.
    const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    await recordLoginAttempt(conn, normalizedEmail, ip, Boolean(user && ok));

    if (!user || !ok) return sendError(res, 401, "invalid_credentials", "Invalid email or password");

    if (needsRehash(user.password_hash)) {
      const rehashed = await hashPassword(password);
      await conn.query("UPDATE users SET password_hash=? WHERE id=?", [rehashed, user.id]);
    }

    const token = newSessionToken();
    const days = Number(process.env.TOKEN_TTL_DAYS || 90);
    await conn.query(
      "INSERT INTO auth_tokens (token_hash, user_id, expires_at, user_agent) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? DAY, ?)",
      [hashToken(token), user.id, days, String(req.headers["user-agent"] || "").slice(0, 255)]
    );
    await conn.query("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id=?", [user.id]);

    setSessionCookie(res, req, token);
    sendJson(res, 200, { user: { id: user.id, email: normalizedEmail } });
  });
});
