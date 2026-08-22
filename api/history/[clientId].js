import { withConnection } from "../_lib/db.js";
import { methodGuard, withErrorHandling } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["DELETE"])) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  const clientId = String(req.query.clientId || "").slice(0, 24);
  await withConnection((conn) => conn.query(
    "DELETE FROM tournament_history WHERE user_id=? AND client_id=?",
    [user.id, clientId]
  ));
  res.status(204).end();
});
