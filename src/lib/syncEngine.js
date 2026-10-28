/* ---------- offline-first sync engine ----------
 * Pushes the write-through localStorage cache (src/lib/storage.js) up to
 * the API under api/. A complete no-op whenever there's no API configured
 * (local-only mode) or no active session (logged out) — every exported
 * function is safe to call unconditionally.
 *
 * Auth rides on the same-origin session cookie (see apiClient.js) — nothing
 * here handles a token directly.
 *
 * Everything that still has to reach the server is persisted, so a reload or
 * a crash can never turn "not synced yet" into "lost":
 *   - `gardenCup:dirty`  — the cached current tournament has changes the
 *     server hasn't acknowledged. The payload isn't stored; a push always
 *     reads the cache fresh, so it can never send something stale.
 *   - `gardenCup:outbox` — every other write (history add / delete / clear,
 *     deleting the current tournament), one entry per operation, in order.
 * A single retry timer drains both. It used to be one "last failing
 * function" slot, so a failing history add and a failing current push
 * overwrote each other and the loser was never sent.
 *
 * The current-tournament debounce lives in useTournament.js (raised to
 * 1500ms there, per §7.2); this module does not add a second timer on top —
 * it just coalesces same-tick bursts by remembering that another change
 * landed while a push is already in flight, so nothing is ever lost.
 */
import { apiRequest, hasApi, onUnauthorized, ApiError } from "./apiClient.js";

const CURRENT_KEY = "gardenCup:current";
const VERSION_KEY = "gardenCup:version";
const DIRTY_KEY = "gardenCup:dirty";
const OUTBOX_KEY = "gardenCup:outbox";
const OWNER_KEY = "gardenCup:syncOwner";
const CONFLICT_KEY = "gardenCup:conflictBackup";
const SESSION_FLAG_KEY = "gardenCup:sessionActive";
export const REMOTE_UPDATE_EVENT = "gardenCup:remote-update";
export const CONFLICT_EVENT = "gardenCup:conflict";

let status = "local";
const listeners = new Set();
function setStatus(next) {
  if (next === status) return;
  status = next;
  listeners.forEach((fn) => { try { fn(status); } catch { /* listener's problem */ } });
}
export const getStatus = () => status;
export const onStatusChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/* ---------- persisted bookkeeping ---------- */
const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
};
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ } };

export const isDirty = () => localStorage.getItem(DIRTY_KEY) === "1";
const markDirty = () => localStorage.setItem(DIRTY_KEY, "1");
const markClean = () => localStorage.removeItem(DIRTY_KEY);

const readOutbox = () => {
  const list = readJson(OUTBOX_KEY, []);
  return Array.isArray(list) ? list : [];
};
const writeOutbox = (list) => {
  if (list.length) writeJson(OUTBOX_KEY, list);
  else localStorage.removeItem(OUTBOX_KEY);
};
let opSeq = 0;
// Ids only need to be unique among what's queued right now.
const nextOpId = () => `${Date.now().toString(36)}-${(opSeq++).toString(36)}`;

/** True when anything — the current tournament or a queued op — still has to reach the server. */
export const hasPending = () => isDirty() || readOutbox().length > 0;

// There's no client-readable token (session lives in an httpOnly cookie) —
// AuthContext calls this after a successful login/register/`/auth/me` check,
// and on logout. It's optimistic across a reload (see the initial value
// below): if the cookie actually expired server-side, the next request 401s
// and onUnauthorized() below corrects it.
let sessionActive = hasApi() && localStorage.getItem(SESSION_FLAG_KEY) === "1";

function clearPending() {
  localStorage.removeItem(VERSION_KEY);
  localStorage.removeItem(OWNER_KEY);
  markClean();
  writeOutbox([]);
  resetRetry();
  pushQueued = false;
}

// `userId` tags the unsynced work with whoever it belongs to, so a different
// account signing in on a shared device never pushes the previous person's
// pending writes. `keepPending` is for a session that merely expired (401):
// the work is still the same person's, and is picked up again — not thrown
// away — when they sign back in.
export function setSessionActive(active, userId, { keepPending = false } = {}) {
  sessionActive = Boolean(active);
  if (sessionActive) {
    localStorage.setItem(SESSION_FLAG_KEY, "1");
    if (userId !== undefined && userId !== null) {
      const owner = localStorage.getItem(OWNER_KEY);
      if (owner !== null && owner !== String(userId)) clearPending();
      localStorage.setItem(OWNER_KEY, String(userId));
    }
  } else {
    localStorage.removeItem(SESSION_FLAG_KEY);
    resetRetry();
    // Also drop the last-known server version, the dirty flag and the
    // outbox: they belong to whoever was just signed in, and on a shared
    // device the next sign-in may be a different account entirely. Without
    // this, the first push after a new sign-in would carry a stranger's
    // version number — or a stranger's queued deletes.
    if (!keepPending) clearPending();
    setStatus("local");
  }
}

function authed() { return hasApi() && sessionActive; }

function getVersion() { return Number(localStorage.getItem(VERSION_KEY) || 0); }
function setVersion(v) { localStorage.setItem(VERSION_KEY, String(v)); }
/** Record the server version a state we just adopted corresponds to. */
export const adoptServerVersion = setVersion;

function announceRemoteState(state) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(REMOTE_UPDATE_EVENT, { detail: { current: state } }));
}

/* ---------- retry / backoff (one timer drains everything pending) ---------- */
const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000];
let retryTimer = null;
let retryDelayIndex = 0;

// One timer for everything pending: when several operations fail at once
// (the usual case — it's the network, not the operations), they share it
// rather than each pushing the backoff further out.
function scheduleRetry() {
  if (retryTimer) return;
  const delay = RETRY_DELAYS[Math.min(retryDelayIndex, RETRY_DELAYS.length - 1)];
  retryDelayIndex = Math.min(retryDelayIndex + 1, RETRY_DELAYS.length - 1);
  retryTimer = setTimeout(() => { retryTimer = null; drainAll(); }, delay);
}
// A success only proves the network is back, so the next failure starts the
// backoff over — it must NOT cancel the timer, which may still be what
// retries some other operation that hasn't succeeded yet.
const resetBackoff = () => { retryDelayIndex = 0; };
function resetRetry() {
  resetBackoff();
  clearTimeout(retryTimer);
  retryTimer = null;
}

// Kicks every pending write. Used by the scheduled timeout and by the
// online/visible listeners below. Clearing the timer first means a retry
// that's about to fire on its own and one nudged early by "we're back
// online" can't both run.
function drainAll() {
  clearTimeout(retryTimer);
  retryTimer = null;
  if (!authed()) return;
  if (readOutbox().length) runOutbox();
  if (isDirty() && !pushInFlight) runPushCurrent();
}

/** Resume whatever a previous page load left unsent. */
export function resumePending() {
  if (authed() && hasPending()) drainAll();
}

function settleIfIdle() {
  if (!hasPending()) { resetRetry(); setStatus("synced"); }
}

/* ---------- pre-flush hooks ---------- */
// useTournament debounces its save by 1500ms, so on pagehide the cache is
// stale. Whoever debounces registers a function that writes its pending
// change into the cache synchronously; the flush below runs them first.
const preFlushHooks = new Set();
export const registerPreFlush = (fn) => { preFlushHooks.add(fn); return () => preFlushHooks.delete(fn); };

/* ---------- current tournament (versioned, conflict-aware) ---------- */
let pushInFlight = false;
let pushQueued = false; // another change landed in localStorage while a push was in flight
let keepaliveNext = false; // the next push is the tab-hide flush — ask fetch to outlive the page
let flushing = false;

export function setCurrent() {
  if (!authed()) return;
  markDirty();
  // a re-created tournament supersedes a still-queued delete of the old one
  const outbox = readOutbox();
  if (outbox.some((op) => op.type === "currentDelete")) writeOutbox(outbox.filter((op) => op.type !== "currentDelete"));
  if (flushing) return; // the flush that called the pre-flush hooks pushes right after
  if (pushInFlight) { pushQueued = true; return; }
  runPushCurrent();
}

/* Order-independent form of a state, for "is this the same tournament?":
   the server composes null/false/empty where the client simply omits a key. */
function canon(value) {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).sort().forEach((k) => {
      const v = canon(value[k]);
      const empty = v === null || v === undefined || v === false || v === ""
        || (Array.isArray(v) && v.length === 0)
        || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
      if (!empty) out[k] = v;
    });
    return out;
  }
  return value;
}
const sameState = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// A 409 means the server holds a different version than the one this device
// last saw. Adopting the server's copy is the safe default for the tournament
// in progress, but it throws this device's edits away — so keep them first,
// and let the UI offer to bring them back (see ConflictBanner).
function backUpLocalForConflict(localState, serverState) {
  if (!localState || sameState(localState, serverState)) return;
  writeJson(CONFLICT_KEY, { savedAt: new Date().toISOString(), state: localState });
  window.dispatchEvent(new CustomEvent(CONFLICT_EVENT));
}

export const getConflictBackup = () => {
  const b = readJson(CONFLICT_KEY, null);
  return b && b.state ? b : null;
};
export function dismissConflictBackup() {
  localStorage.removeItem(CONFLICT_KEY);
  window.dispatchEvent(new CustomEvent(CONFLICT_EVENT));
}
// The version cached by the 409 is the server's current one, so this push is
// accepted and deliberately overwrites what the other device wrote.
export function restoreConflictBackup() {
  const b = getConflictBackup();
  if (!b) return;
  localStorage.removeItem(CONFLICT_KEY);
  localStorage.setItem(CURRENT_KEY, JSON.stringify(b.state));
  window.dispatchEvent(new CustomEvent(REMOTE_UPDATE_EVENT, { detail: { current: b.state } }));
  window.dispatchEvent(new CustomEvent(CONFLICT_EVENT));
  setCurrent();
}

// Deliberately reads the current cache fresh rather than closing over a
// snapshot, so a retry firing minutes later (or a second push queued behind
// an in-flight one) can never send a stale payload over a newer one.
async function runPushCurrent() {
  pushInFlight = true;
  pushQueued = false;
  const keepalive = keepaliveNext;
  keepaliveNext = false;
  setStatus("pending");
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw === null) { markClean(); settleIfIdle(); return; }
    const state = JSON.parse(raw);
    const res = await apiRequest("/tournaments/current", {
      method: "PUT",
      body: { expectedVersion: getVersion(), state },
      keepalive,
    });
    setVersion(res.version);
    if (!pushQueued) markClean(); // else a newer change is already waiting to go out
    resetBackoff();
    if (!pushQueued) settleIfIdle();
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && e.body) {
      setVersion(e.body.version);
      if (e.body.state) {
        let local = null;
        try { local = JSON.parse(localStorage.getItem(CURRENT_KEY)); } catch { /* unreadable cache: nothing to back up */ }
        backUpLocalForConflict(local, e.body.state);
        announceRemoteState(e.body.state);
        markClean();
        resetBackoff();
        settleIfIdle();
      } else {
        // Defensive only: api/_lib/serializer.js always composes the actual
        // conflicting row now, so this shouldn't happen. If it ever does,
        // the corrected version above is still good — just retry the push
        // rather than claiming "synced" for a write that didn't land.
        setStatus("offline");
        scheduleRetry();
      }
    } else if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
      // Not retryable — the server rejected the write itself (validation, etc.)
      markClean();
      setStatus("error");
    } else {
      // network_error (status 0), 401 (session drop is handled by onUnauthorized), or 5xx — retry
      setStatus("offline");
      scheduleRetry();
    }
  } finally {
    pushInFlight = false;
    if (pushQueued) runPushCurrent();
  }
}

export function deleteCurrent() {
  if (!authed()) return;
  // nothing left to push, and the delete must not be undone by a stale put
  markClean();
  enqueue({ type: "currentDelete" });
}

// Adopting the server's version is the caller's job (adoptServerVersion): a
// local copy with unsynced edits must keep the version it was based on, or
// the next push would sail past a conflict and silently overwrite the other
// device (see reconcile.js).
export async function fetchCurrent() {
  if (!authed()) return { version: 0, state: null };
  return apiRequest("/tournaments/current");
}

/* ---------- outbox: history writes + current delete, in order ---------- */
function enqueue(op) {
  let list = readOutbox();
  // A clear makes every earlier history write moot (and a queued delete of
  // the current tournament stays — it's a different resource).
  if (op.type === "historyClear") list = list.filter((o) => !o.type.startsWith("history"));
  if (op.type === "currentDelete") list = list.filter((o) => o.type !== "currentDelete");
  list.push({ id: nextOpId(), ...op });
  writeOutbox(list);
  runOutbox();
}

function sendOp(op) {
  switch (op.type) {
    case "historyAdd": return apiRequest("/history", { method: "POST", body: { record: op.record } });
    case "historyDelete": return apiRequest(`/history/${encodeURIComponent(op.recordId)}`, { method: "DELETE" });
    case "historyClear": return apiRequest("/history", { method: "DELETE" });
    case "currentDelete": return apiRequest("/tournaments/current", { method: "DELETE" });
    default: return Promise.resolve(null); // an op from a future version: drop it rather than wedge the queue
  }
}

let outboxRunning = false;
let outboxAgain = false;

// Strictly one at a time and in order: a "clear" racing an earlier "add"
// would otherwise resurrect the record on the server.
async function runOutbox() {
  if (!authed()) return;
  if (outboxRunning) { outboxAgain = true; return; }
  outboxRunning = true;
  try {
    do {
      outboxAgain = false;
      for (;;) {
        if (!authed()) return;
        const op = readOutbox()[0];
        if (!op) break;
        setStatus("pending");
        try {
          await sendOp(op);
          if (op.type === "currentDelete") setVersion(0);
        } catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
            // the server rejected this write itself — retrying can't help
            setStatus("error");
          } else {
            setStatus("offline");
            scheduleRetry();
            return;
          }
        }
        // by id, not position: a clear may have rewritten the queue while this was in flight
        writeOutbox(readOutbox().filter((o) => o.id !== op.id));
      }
    } while (outboxAgain);
    resetBackoff();
    if (!isDirty() && !pushInFlight && status !== "error") settleIfIdle();
  } finally {
    outboxRunning = false;
  }
}

/* ---------- history (append/delete-by-id, no version conflicts) ---------- */
export function addHistory(record) {
  if (!authed()) return;
  enqueue({ type: "historyAdd", record });
}

export function deleteHistory(id) {
  if (!authed()) return;
  enqueue({ type: "historyDelete", recordId: id });
}

export function clearHistory() {
  if (!authed()) return;
  enqueue({ type: "historyClear" });
}

export async function fetchHistory() {
  if (!authed()) return { history: [] };
  return apiRequest("/history");
}

/** A server history list with the not-yet-sent history writes applied on top. */
export function applyPendingToHistory(serverHistory) {
  let list = [...serverHistory];
  readOutbox().forEach((op) => {
    if (op.type === "historyAdd" && op.record && !list.some((h) => h.id === op.record.id)) list = [op.record, ...list];
    else if (op.type === "historyDelete") list = list.filter((h) => h.id !== op.recordId);
    else if (op.type === "historyClear") list = [];
  });
  return list;
}

/* ---------- session drop ---------- */
onUnauthorized(() => setSessionActive(false, undefined, { keepPending: true }));

/* ---------- flush on tab close/hide ----------
 * pagehide handlers can't reliably await a promise, so this fires a
 * best-effort keepalive request and doesn't wait for the result. sendBeacon
 * is not an option here — it only ever sends POST, and this needs to be a
 * PUT with a JSON body to /tournaments/current; a keepalive fetch is the
 * only way to get both the right method and the session cookie attached.
 *
 * It goes through the normal push (runPushCurrent) rather than a bare fetch:
 * `visibilitychange` to hidden fires on every tab switch, where the page
 * lives on and the response must still bump the cached version — otherwise
 * the next push would collide with this device's own write.
 */
function flushOnHide() {
  // Whatever is still sitting in a debounce window has to reach the cache
  // before this reads it.
  flushing = true;
  try {
    preFlushHooks.forEach((fn) => { try { fn(); } catch { /* a hook's problem */ } });
  } finally {
    flushing = false;
  }
  // On iOS, pagehide fires on every screen lock and app switch — the
  // brief's exact use case — so without the dirty check, every lock would
  // re-PUT unchanged state and bump the server version for no reason.
  if (!authed() || !isDirty()) return;
  if (pushInFlight) { pushQueued = true; keepaliveNext = true; return; }
  keepaliveNext = true;
  runPushCurrent();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushOnHide);
  window.addEventListener("online", drainAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnHide();
    else drainAll();
  });
}
