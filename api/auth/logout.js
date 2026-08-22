import { withConnection } from "../_lib/db.js";
import { methodGuard, withErrorHandling } from "../_lib/http.js";
import { getSessionToken, hashToken, clearSessionCookie } from "../_lib/auth.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["POST"])) return;
  const token = getSessionToken(req);
  if (token) {
    await withConnection((conn) => conn.query("DELETE FROM auth_tokens WHERE token_hash=?", [hashToken(token)])).catch((e) => console.error(e));
  }
  clearSessionCookie(res, req);
  res.status(204).end();
});
