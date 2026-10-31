import { methodGuard, withErrorHandling } from "../_lib/http.js";
import { createRequestClient, supabaseConfigured } from "../_lib/supabase.js";
import { checkLimits, clientIp } from "../_lib/rateLimit.js";

/* The links in the "confirm your email" and "reset your password" messages
   land here (see the email templates in DEPLOYMENT.md). A good link signs
   the user in by setting the session cookies; every outcome goes back to the
   app, which reads the query string to show the right screen. */
const TYPES = new Set(["email", "signup", "recovery"]);

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["GET"])) return;
  const tokenHash = typeof req.query?.token_hash === "string" ? req.query.token_hash : "";
  const type = typeof req.query?.type === "string" ? req.query.type : "";

  let ok = false;
  if (supabaseConfigured() && tokenHash && TYPES.has(type)) {
    const db = createRequestClient(req, res);
    // over the limit: treated like a bad link, so the app shows its message
    const limit = await checkLimits(db, [["confirmIp", clientIp(req)]]);
    if (limit.ok) {
      const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });
      ok = !error;
      if (error) console.error(error);
    }
  }
  res.setHeader("Cache-Control", "no-store");
  const done = type === "recovery" ? "/?reset=1" : "/?confirmed=1";
  res.setHeader("Location", ok ? done : "/?confirm_error=1");
  res.status(303).end();
});
