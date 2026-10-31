import { methodGuard, withErrorHandling } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["GET"])) return;
  const auth = await requireAuth(req, res);
  if (!auth) return; // requireAuth already replied
  res.status(200).json({ user: auth.user });
});
