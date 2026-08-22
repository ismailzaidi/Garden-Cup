/* ---------- offline-first sync engine ----------
 * Pushes the write-through localStorage cache (src/lib/storage.js) up to
 * the API under api/. A complete no-op whenever there's no API configured
 * (local-only mode) or no active session (logged out) — every exported
 * function is safe to call unconditionally.
 *
 * Auth rides on the same-origin session cookie (see apiClient.js) — nothing
 * here handles a token directly.
 *
 * The current-tournament debounce lives in useTournament.js (raised to
 * 1500ms there, per §7.2); this module does not add a second timer on top —
 * it just coalesces same-tick bursts by remembering the latest pending
 * payload while a push is already in flight, so nothing is ever lost.
 */
import { apiRequest, API_BASE, hasApi, onUnauthorized, ApiError } from "./apiClient.js";

const CURRENT_KEY = "gardenCup:current";
const VERSION_KEY = "gardenCup:version";
const SESSION_FLAG_KEY = "gardenCup:sessionActive";
export const REMOTE_UPDATE_EVENT = "gardenCup:remote-update";

let status = "local";
const listeners = new Set();
function setStatus(next) {
  if (next === status) return;
  status = next;
  listeners.forEach((fn) => { try { fn(status); } catch { /* listener's problem */ } });
}
export const getStatus = () => status;
export const onStatusChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// There's no client-readable token (session lives in an httpOnly cookie) —
// AuthContext calls this after a successful login/register/`/auth/me` check,
// and on logout. It's optimistic across a reload (see the initial value
// below): if the cookie actually expired server-side, the next request 401s
// and onUnauthorized() below corrects it.
let sessionActive = hasApi() && localStorage.getItem(SESSION_FLAG_KEY) === "1";
export function setSessionActive(active) {
  sessionActive = Boolean(active);
  if (sessionActive) {
    localStorage.setItem(SESSION_FLAG_KEY, "1");
  } else {
    localStorage.removeItem(SESSION_FLAG_KEY);
    // Also drop the last-known server version: it belongs to whoever was
    // just signed in, and on a shared device the next sign-in may be a
    // different account entirely. Without this, the first push after a new
    // sign-in would carry a stranger's version number.
    localStorage.removeItem(VERSION_KEY);
    resetRetry();
    pushQueued = false;
    dirty = false;
    setStatus("local");
  }
}

function authed() { return hasApi() && sessionActive; }

function getVersion() { return Number(localStorage.getItem(VERSION_KEY) || 0); }
function setVersion(v) { localStorage.setItem(VERSION_KEY, String(v)); }

function announceRemoteState(state) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(REMOTE_UPDATE_EVENT, { detail: { current: state } }));
}

/* ---------- retry / backoff (shared by whatever the last failing op was) ---------- */
const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000];
let retryTimer = null;
let retryDelayIndex = 0;
let pendingRetryFn = null;

function scheduleRetry(fn) {
  pendingRetryFn = fn;
  clearTimeout(retryTimer);
  const delay = RETRY_DELAYS[Math.min(retryDelayIndex, RETRY_DELAYS.length - 1)];
  retryDelayIndex = Math.min(retryDelayIndex + 1, RETRY_DELAYS.length - 1);
  retryTimer = setTimeout(() => { pendingRetryFn?.(); }, delay);
}
function resetRetry() {
  retryDelayIndex = 0;
  clearTimeout(retryTimer);
  retryTimer = null;
  pendingRetryFn = null;
}

// Used by both the scheduled timeout and the online/visibilitychange
// listeners below, so a retry that's about to fire on its own timer and one
// nudged early by "we're back online" can't both run — without clearing the
// timer and consuming pendingRetryFn here, both fire and race.
function fireRetryNow() {
  if (!pendingRetryFn) return;
  clearTimeout(retryTimer);
  const fn = pendingRetryFn;
  pendingRetryFn = null;
  fn();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", fireRetryNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") fireRetryNow();
  });
}

/* ---------- current tournament (versioned, conflict-aware) ---------- */
let pushInFlight = false;
let pushQueued = false; // another change landed in localStorage while a push was in flight
let dirty = false; // localStorage may not match the server yet — read by the pagehide flush

export function setCurrent() {
  if (!authed()) return;
  dirty = true;
  if (pushInFlight) { pushQueued = true; return; }
  runPushCurrent();
}

// Deliberately takes no argument — always reads the current cache fresh
// rather than closing over a snapshot, so a retry firing minutes later (or
// a second push queued behind an in-flight one) can never send a stale
// payload over a newer one.
async function runPushCurrent() {
  pushInFlight = true;
  pushQueued = false;
  setStatus("pending");
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw === null) { resetRetry(); dirty = false; setStatus(hasApi() ? "synced" : "local"); return; }
    const state = JSON.parse(raw);
    const res = await apiRequest("/tournaments/current", {
      method: "PUT",
      body: { expectedVersion: getVersion(), state },
    });
    setVersion(res.version);
    resetRetry();
    dirty = false;
    setStatus("synced");
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && e.body) {
      setVersion(e.body.version);
      if (e.body.state) {
        announceRemoteState(e.body.state);
        resetRetry();
        dirty = false;
        setStatus("synced");
      } else {
        // Defensive only: api/_lib/serializer.js always composes the actual
        // conflicting row now, so this shouldn't happen. If it ever does,
        // the corrected version above is still good — just retry the push
        // rather than claiming "synced" for a write that didn't land.
        setStatus("offline");
        scheduleRetry(runPushCurrent);
      }
    } else if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
      // Not retryable — the server rejected the write itself (validation, etc.)
      dirty = false;
      setStatus("error");
    } else {
      // network_error (status 0), 401 (session drop is handled by onUnauthorized), or 5xx — retry
      setStatus("offline");
      scheduleRetry(runPushCurrent);
    }
  } finally {
    pushInFlight = false;
    if (pushQueued) runPushCurrent();
  }
}

export function deleteCurrent() {
  if (!authed()) return;
  (async () => {
    setStatus("pending");
    try {
      await apiRequest("/tournaments/current", { method: "DELETE" });
      setVersion(0);
      resetRetry();
      setStatus("synced");
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
        setStatus("error");
      } else {
        setStatus("offline");
        scheduleRetry(deleteCurrent);
      }
    }
  })();
}

export async function fetchCurrent() {
  if (!authed()) return { version: 0, state: null };
  const res = await apiRequest("/tournaments/current");
  setVersion(res.version);
  return res;
}

/* ---------- history (append/delete-by-id, no version conflicts) ---------- */
export function addHistory(record) {
  if (!authed()) return;
  apiRequest("/history", { method: "POST", body: { record } })
    .then(() => setStatus("synced"))
    .catch((e) => handleFireAndForgetError(e, () => addHistory(record)));
}

export function deleteHistory(id) {
  if (!authed()) return;
  apiRequest(`/history/${encodeURIComponent(id)}`, { method: "DELETE" })
    .then(() => setStatus("synced"))
    .catch((e) => handleFireAndForgetError(e, () => deleteHistory(id)));
}

export function clearHistory() {
  if (!authed()) return;
  apiRequest("/history", { method: "DELETE" })
    .then(() => setStatus("synced"))
    .catch((e) => handleFireAndForgetError(e, () => clearHistory()));
}

export async function fetchHistory() {
  if (!authed()) return { history: [] };
  return apiRequest("/history");
}

function handleFireAndForgetError(e, retryFn) {
  if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
    setStatus("error");
    return;
  }
  setStatus("offline");
  scheduleRetry(retryFn);
}

/* ---------- session drop ---------- */
onUnauthorized(() => setSessionActive(false));

/* ---------- flush on tab close/hide ----------
 * pagehide handlers can't reliably await a promise, so this fires a best-effort
 * keepalive request and doesn't wait for the result. sendBeacon is not an
 * option here — it only ever sends POST, and this needs to be a PUT with a
 * JSON body to /tournaments/current; a keepalive fetch is the only way to
 * get both the right method and the session cookie attached.
 */
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    // On iOS, pagehide fires on every screen lock and app switch — the
    // brief's exact use case — so without the dirty check, every lock would
    // re-PUT unchanged state and bump the server version for no reason.
    if (!authed() || !dirty) return;
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return;
    try {
      const state = JSON.parse(raw);
      fetch(`${API_BASE}/tournaments/current`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ expectedVersion: getVersion(), state }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* malformed cache entry, nothing to flush */ }
  });
}
