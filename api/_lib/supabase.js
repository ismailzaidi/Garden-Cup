/* ---------- a Supabase client for one request ----------
 * Every route builds its client here, from the request's cookies. The client
 * acts as the signed-in user (anon key + their session), never with the
 * service key, so the database's row-level security applies to every query
 * on top of the checks in the handlers.
 *
 * The session lives in cookies that @supabase/ssr reads and writes. We force
 * them httpOnly: nothing in the browser ever needs to read them (the SPA
 * only talks to /api), so script on the page can't either. A refreshed
 * session is written back through setAll before the handler replies.
 */
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

// Secure by default; the one exception is `vercel dev` on localhost over
// http, where a Secure cookie would never be sent back. Keyed off the Host
// header only ever to *drop* Secure for an unambiguous localhost request.
export function wantsSecureCookie(req) {
  const host = String(req.headers.host || "");
  const isLocalhost = host === "localhost" || host === "127.0.0.1"
    || host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
  return !isLocalhost;
}

function appendSetCookie(res, serialized) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) res.setHeader("Set-Cookie", serialized);
  else res.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, serialized] : [existing, serialized]);
}

/** The cookie adapter on its own, so it can be tested without Supabase. */
export function cookieMethods(req, res) {
  const secure = wantsSecureCookie(req);
  return {
    getAll() {
      return parseCookieHeader(String(req.headers.cookie || "")).map(({ name, value }) => ({ name, value: value ?? "" }));
    },
    setAll(cookiesToSet, headers = {}) {
      if (res.headersSent) return; // too late to change anything; the next request refreshes again
      cookiesToSet.forEach(({ name, value, options }) => {
        appendSetCookie(res, serializeCookieHeader(name, value, {
          ...options, httpOnly: true, secure, sameSite: "lax", path: "/",
        }));
      });
      // @supabase/ssr asks for no-store whenever it sets a session cookie
      Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    },
  };
}

export function createRequestClient(req, res) {
  return createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    cookies: cookieMethods(req, res),
  });
}
