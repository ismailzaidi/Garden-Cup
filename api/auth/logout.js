import { methodGuard, withErrorHandling } from "../_lib/http.js";
import { createRequestClient, supabaseConfigured } from "../_lib/supabase.js";

/* Ends this device's session only (other devices stay signed in). The
   client clears its cookies even if Supabase can't be reached. */
export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["POST"])) return;
  if (supabaseConfigured()) {
    const db = createRequestClient(req, res);
    const { error } = await db.auth.signOut({ scope: "local" });
    if (error) console.error(error);
  }
  res.status(204).end();
});
