/* ---------- who is asking ----------
 * Accounts and sessions belong to Supabase Auth (password hashing, email
 * confirmation, rate limits on sign-in and sign-up). This file only turns a
 * request into "this user, and a database client acting as them".
 */
import { createRequestClient, supabaseConfigured } from "./supabase.js";
import { sendError } from "./http.js";

/** The user shape every /api/auth route returns. */
export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.user_metadata?.display_name ?? "",
  };
}

// Returns { user, db } on success. On failure it has already written the
// response, so the caller just checks for null and returns.
export async function requireAuth(req, res) {
  if (!supabaseConfigured()) {
    sendError(res, 503, "not_configured", "Accounts are not set up on this server");
    return null;
  }
  const db = createRequestClient(req, res);
  // getUser() asks Supabase Auth to check the token (and refreshes an
  // expired one through the cookies); never trust the cookie on its own.
  const { data, error } = await db.auth.getUser();
  if (error || !data?.user) {
    sendError(res, 401, "unauthorized", "Sign in required");
    return null;
  }
  return { user: publicUser(data.user), db };
}
