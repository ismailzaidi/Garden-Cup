import { methodGuard, withErrorHandling } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["DELETE"])) return;
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { user, db } = auth;

  const clientId = String(req.query.clientId || "").slice(0, 24);
  const { error } = await db.from("tournament_history").delete().eq("user_id", user.id).eq("client_id", clientId);
  if (error) throw error;
  res.status(204).end();
});
