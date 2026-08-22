/* ---------- API client ----------
 * Thin fetch wrapper for the Vercel functions under api/ (TASK-DATABASE.md
 * §5's endpoint table, same contract regardless of what runs behind it).
 * VITE_API_BASE_URL unset/empty means "no backend configured" — the app
 * runs in local-only mode and nothing in this module is ever called.
 *
 * Auth is a session cookie, not a bearer token: the SPA and the API are the
 * same Vercel deployment (same origin), so `credentials: "same-origin"` is
 * enough for the browser to attach it automatically — no Authorization
 * header, nothing to store in JS at all.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const hasApi = () => Boolean(API_BASE);

export class ApiError extends Error {
  constructor(status, code, message, body = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body; // parsed JSON response body, when there was one (e.g. a 409's {version, state})
  }
}

// Registered by AuthContext and syncEngine so any 401, anywhere, drops the
// session — without every call site having to know about auth. A Set, not a
// single slot, because both modules need to react independently.
const unauthorizedHandlers = new Set();
export const onUnauthorized = (fn) => { unauthorizedHandlers.add(fn); return () => unauthorizedHandlers.delete(fn); };

export async function apiRequest(path, { method = "GET", body, keepalive = false, signal } = {}) {
  const headers = { "Content-Type": "application/json" };

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
      signal,
    });
  } catch (e) {
    throw new ApiError(0, "network_error", e?.message || "Network request failed");
  }

  if (res.status === 401) unauthorizedHandlers.forEach((fn) => { try { fn(); } catch { /* handler's problem */ } });

  if (!res.ok) {
    let parsed = null;
    try { parsed = await res.json(); } catch { /* no body */ }
    throw new ApiError(res.status, parsed?.error ?? "http_error", parsed?.message ?? res.statusText, parsed);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}
