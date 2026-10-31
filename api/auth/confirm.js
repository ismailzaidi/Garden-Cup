import { methodGuard, withErrorHandling } from "../_lib/http.js";
import { createRequestClient, supabaseConfigured } from "../_lib/supabase.js";

/* The link in the "confirm your email" message lands here (see the email
   template in DEPLOYMENT.md). A good link signs the user in by setting the
   session cookies, then both outcomes go back to the app, which reads the
   query string to show the right message. */
const TYPES = new Set(["email", "signup"]);

export default withErrorHandling(async (req, res) => {
  if (!methodGuard(req, res, ["GET"])) return;
  const tokenHash = typeof req.query?.token_hash === "string" ? req.query.token_hash : "";
  const type = typeof req.query?.type === "string" ? req.query.type : "";

  let ok = false;
  if (supabaseConfigured() && tokenHash && TYPES.has(type)) {
    const db = createRequestClient(req, res);
    const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
    if (error) console.error(error);
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", ok ? "/?confirmed=1" : "/?confirm_error=1");
  res.status(303).end();
});
