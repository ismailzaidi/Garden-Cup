/* ---------- rate limits ----------
 * Counted in Postgres (rate_limit_hit in supabase/migrations), so every
 * serverless instance shares one count. Buckets are SHA-256 hashes: the
 * table never holds an email or IP address.
 *
 * Supabase Auth has its own limits too, but it sees every request coming
 * from Vercel's servers, not from each person, so per-person limits have to
 * be here, keyed on the real client IP, the email or the account.
 *
 * If the limiter itself can't be reached, requests are let through (and
 * logged): a database hiccup shouldn't lock everyone out of a game, and
 * Supabase Auth's own limits still stand behind the sign-in routes.
 */
import { createHash } from "node:crypto";
import { sendError } from "./http.js";

const MIN = 60;
const HOUR = 60 * MIN;

/** [max requests, window in seconds] for each kind of request. */
export const LIMITS = {
  loginIp: [30, 15 * MIN],
  loginEmail: [10, 15 * MIN],
  registerIp: [5, HOUR],
  forgotIp: [5, HOUR],
  forgotEmail: [3, HOUR],
  confirmIp: [20, 15 * MIN],
  passwordCheckUser: [10, 15 * MIN], // changing the password, deleting the account
  profileUser: [20, HOUR],
  dataUser: [600, 5 * MIN], // syncing tournaments and history: far above real play
};

/* The address the request really came from. On Vercel, x-vercel-forwarded-for
   and x-real-ip are set by Vercel itself (a client can't fake them);
   x-forwarded-for is the fallback for `vercel dev`. */
export function clientIp(req) {
  const h = req.headers || {};
  const first = (v) => (typeof v === "string" && v ? v.split(",")[0].trim() : "");
  return first(h["x-vercel-forwarded-for"]) || first(h["x-real-ip"]) || first(h["x-forwarded-for"])
    || req.socket?.remoteAddress || "unknown";
}

export const bucketOf = (name, value) => createHash("sha256").update(`${name}:${String(value).toLowerCase()}`).digest("hex");

/* Counts one request against each [name, value] given, using `db` (any
   Supabase client). Resolves to { ok, retryAfter }. */
export async function checkLimits(db, checks) {
  const results = await Promise.all(checks.map(async ([name, value]) => {
    const [max, windowSeconds] = LIMITS[name];
    const { data, error } = await db.rpc("rate_limit_hit", {
      p_bucket: bucketOf(name, value), p_limit: max, p_window_seconds: windowSeconds,
    });
    if (error || !data) {
      console.error("rate limit check failed; letting the request through", error);
      return 0;
    }
    return data.allowed ? 0 : Number(data.retry_after) || windowSeconds;
  }));
  const retryAfter = Math.max(0, ...results);
  return { ok: retryAfter === 0, retryAfter };
}

/* checkLimits for a JSON route: true to carry on, or it has already replied
   429 with Retry-After and the caller just returns. */
export async function rateLimit(res, db, checks) {
  const { ok, retryAfter } = await checkLimits(db, checks);
  if (ok) return true;
  res.setHeader("Retry-After", String(retryAfter));
  sendError(res, 429, "too_many_requests", "Too many attempts. Wait a little and try again.");
  return false;
}
