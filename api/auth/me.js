import { methodGuard, withErrorHandling } from "../_lib/http.js";
import { requireAuth } from "../_lib/auth.js";

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["GET"])) return;
  const user = await requireAuth(req, res);
  if (!user) return; // requireAuth already sent 401
  res.status(200).json({ user });
});
