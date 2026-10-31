import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above these, so the values it closes over must come
// from vi.hoisted() — see the same note in exportImport.test.js.
const { hasApiMock, apiRequestMock, onUnauthorizedMock, MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(status, code, message, body = null, retryAfter = 0) {
      super(message);
      this.status = status;
      this.code = code;
      this.body = body;
      this.retryAfter = retryAfter;
    }
  }
  return {
    hasApiMock: vi.fn(() => true),
    apiRequestMock: vi.fn(),
    onUnauthorizedMock: vi.fn(() => () => {}),
    MockApiError,
  };
});

vi.mock("../src/lib/apiClient.js", () => ({
  hasApi: hasApiMock,
  apiRequest: apiRequestMock,
  onUnauthorized: onUnauthorizedMock,
  ApiError: MockApiError,
  API_BASE: "/api",
}));

const sync = await import("../src/lib/syncEngine.js");

const CURRENT_KEY = "gardenCup:current";
const VERSION_KEY = "gardenCup:version";
const DIRTY_KEY = "gardenCup:dirty";
const OUTBOX_KEY = "gardenCup:outbox";
const CONFLICT_KEY = "gardenCup:conflictBackup";

function setCurrentCache(state) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
}

// Lets every awaited step inside the engine (several promise hops per op) finish.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function flush() {
  // Let queued microtasks (the promise chains inside syncEngine) settle.
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  localStorage.clear();
  apiRequestMock.mockReset();
  hasApiMock.mockReturnValue(true);
  sync.setSessionActive(false); // start every test from a clean, signed-out slate
});

describe("local-only mode (hasApi() === false)", () => {
  beforeEach(() => hasApiMock.mockReturnValue(false));

  it("never calls the API, no matter what's called", async () => {
    sync.setSessionActive(true); // even a stale "signed in" flag must not matter
    setCurrentCache({ mode: "league" });
    sync.setCurrent();
    sync.deleteCurrent();
    sync.addHistory({ id: "h1" });
    sync.deleteHistory("h1");
    sync.clearHistory();
    await flush();

    expect(apiRequestMock).not.toHaveBeenCalled();
    expect(sync.getStatus()).toBe("local");
  });

  it("fetchCurrent/fetchHistory resolve to empty defaults without a network call", async () => {
    await expect(sync.fetchCurrent()).resolves.toEqual({ version: 0, state: null });
    await expect(sync.fetchHistory()).resolves.toEqual({ history: [] });
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});

describe("cloud mode, signed out", () => {
  it("is just as inert as local-only mode until setSessionActive(true) is called", async () => {
    setCurrentCache({ mode: "league" });
    sync.setCurrent();
    sync.addHistory({ id: "h1" });
    await flush();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});

describe("cloud mode, signed in — current tournament", () => {
  beforeEach(() => sync.setSessionActive(true));

  it("pushes the cached state with the last known version, and reports synced on success", async () => {
    localStorage.setItem(VERSION_KEY, "4");
    setCurrentCache({ mode: "king", tournamentId: "t1" });
    apiRequestMock.mockResolvedValue({ version: 5 });

    sync.setCurrent();
    await flush();

    expect(apiRequestMock).toHaveBeenCalledWith("/tournaments/current", {
      method: "PUT",
      body: { expectedVersion: 4, state: { mode: "king", tournamentId: "t1" } },
      keepalive: false,
    });
    expect(sync.getStatus()).toBe("synced");
    expect(localStorage.getItem(VERSION_KEY)).toBe("5");
  });

  it("on a 409 with the server's state, adopts it, bumps the version, and announces a remote update", async () => {
    setCurrentCache({ mode: "king" });
    apiRequestMock.mockRejectedValue(
      new MockApiError(409, "conflict", "conflict", { version: 9, state: { mode: "knockout", tournamentId: "server" } })
    );

    const onRemoteUpdate = vi.fn();
    window.addEventListener(sync.REMOTE_UPDATE_EVENT, onRemoteUpdate);
    try {
      sync.setCurrent();
      await flush();
    } finally {
      window.removeEventListener(sync.REMOTE_UPDATE_EVENT, onRemoteUpdate);
    }

    expect(sync.getStatus()).toBe("synced");
    expect(localStorage.getItem(VERSION_KEY)).toBe("9");
    expect(JSON.parse(localStorage.getItem(CURRENT_KEY))).toEqual({ mode: "knockout", tournamentId: "server" });
    expect(onRemoteUpdate).toHaveBeenCalledTimes(1);
    expect(onRemoteUpdate.mock.calls[0][0].detail.current).toEqual({ mode: "knockout", tournamentId: "server" });
  });

  it("on a 409 with no state (defensive path), does not claim synced and retries the push", async () => {
    vi.useFakeTimers();
    try {
      setCurrentCache({ mode: "king" });
      apiRequestMock
        .mockRejectedValueOnce(new MockApiError(409, "conflict", "conflict", { version: 2, state: null }))
        .mockResolvedValueOnce({ version: 3 });

      sync.setCurrent();
      await vi.advanceTimersByTimeAsync(0);
      expect(sync.getStatus()).toBe("offline");
      expect(sync.getStatus()).not.toBe("synced");

      await vi.advanceTimersByTimeAsync(2000); // first retry delay
      expect(apiRequestMock).toHaveBeenCalledTimes(2);
      expect(sync.getStatus()).toBe("synced");
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats a non-retryable 4xx as a real error, not something to retry", async () => {
    vi.useFakeTimers();
    try {
      setCurrentCache({ mode: "king" });
      apiRequestMock.mockRejectedValue(new MockApiError(422, "invalid_state", "bad state"));

      sync.setCurrent();
      await vi.advanceTimersByTimeAsync(0);
      expect(sync.getStatus()).toBe("error");

      await vi.advanceTimersByTimeAsync(60_000);
      expect(apiRequestMock).toHaveBeenCalledTimes(1); // never retried
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a network failure with backoff and eventually succeeds", async () => {
    vi.useFakeTimers();
    try {
      setCurrentCache({ mode: "king" });
      apiRequestMock
        .mockRejectedValueOnce(new MockApiError(0, "network_error", "offline"))
        .mockResolvedValueOnce({ version: 1 });

      sync.setCurrent();
      await vi.advanceTimersByTimeAsync(0);
      expect(sync.getStatus()).toBe("offline");

      await vi.advanceTimersByTimeAsync(2000);
      expect(apiRequestMock).toHaveBeenCalledTimes(2);
      expect(sync.getStatus()).toBe("synced");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a rate-limited (429) save and retries it after Retry-After, not sooner", async () => {
    vi.useFakeTimers();
    try {
      setCurrentCache({ mode: "king" });
      apiRequestMock
        .mockRejectedValueOnce(new MockApiError(429, "too_many_requests", "slow down", null, 30))
        .mockResolvedValueOnce({ version: 1 });

      sync.setCurrent();
      await vi.advanceTimersByTimeAsync(0);
      expect(sync.getStatus()).toBe("offline");
      expect(localStorage.getItem(DIRTY_KEY)).toBe("1"); // not dropped

      await vi.advanceTimersByTimeAsync(5_000); // past the normal first backoff
      expect(apiRequestMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(25_000);
      expect(apiRequestMock).toHaveBeenCalledTimes(2);
      expect(sync.getStatus()).toBe("synced");
    } finally {
      vi.useRealTimers();
    }
  });

  it("coalesces a change that lands while a push is already in flight, rather than dropping it", async () => {
    let resolveFirst;
    apiRequestMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ version: 2 });

    setCurrentCache({ mode: "king", rev: 1 });
    sync.setCurrent();
    await flush();
    expect(sync.getStatus()).toBe("pending");

    // a second change arrives before the first push has resolved
    setCurrentCache({ mode: "king", rev: 2 });
    sync.setCurrent();

    resolveFirst({ version: 1 });
    await flush();
    await flush();

    // the queued second push must have gone out with the newer cached state
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
    expect(apiRequestMock.mock.calls[1][1].body.state).toEqual({ mode: "king", rev: 2 });
  });
});

describe("cloud mode, signed in — history", () => {
  beforeEach(() => sync.setSessionActive(true));

  it("addHistory/deleteHistory/clearHistory call the matching endpoint and report synced", async () => {
    apiRequestMock.mockResolvedValue(null);

    sync.addHistory({ id: "h1" });
    await flush();
    expect(apiRequestMock).toHaveBeenCalledWith("/history", { method: "POST", body: { record: { id: "h1" } } });
    expect(sync.getStatus()).toBe("synced");

    sync.deleteHistory("h1");
    await flush();
    expect(apiRequestMock).toHaveBeenCalledWith("/history/h1", { method: "DELETE" });

    sync.clearHistory();
    await flush();
    expect(apiRequestMock).toHaveBeenCalledWith("/history", { method: "DELETE" });
  });

  it("URL-encodes the history id being deleted", async () => {
    apiRequestMock.mockResolvedValue(null);
    sync.deleteHistory("weird id/with slash");
    await flush();
    expect(apiRequestMock).toHaveBeenCalledWith("/history/weird%20id%2Fwith%20slash", { method: "DELETE" });
  });
});

describe("status pub/sub", () => {
  it("notifies subscribers of status changes and stops after unsubscribing", async () => {
    sync.setSessionActive(true);
    const seen = [];
    const unsub = sync.onStatusChange((s) => seen.push(s));

    apiRequestMock.mockResolvedValue({ version: 1 });
    setCurrentCache({ mode: "king" });
    sync.setCurrent();
    await flush();

    expect(seen).toContain("pending");
    expect(seen).toContain("synced");

    unsub();
    seen.length = 0;
    sync.setCurrent();
    await flush();
    expect(seen).toEqual([]);
  });
});

describe("setSessionActive(false)", () => {
  it("drops back to local status and forgets the last known server version", async () => {
    sync.setSessionActive(true);
    localStorage.setItem(VERSION_KEY, "7");
    apiRequestMock.mockResolvedValue({ version: 8 });
    setCurrentCache({ mode: "king" });
    sync.setCurrent();
    await flush();
    expect(sync.getStatus()).toBe("synced");

    sync.setSessionActive(false);
    expect(sync.getStatus()).toBe("local");
    expect(localStorage.getItem(VERSION_KEY)).toBeNull();

    // and it's inert again, exactly like a fresh sign-out should be
    apiRequestMock.mockClear();
    sync.setCurrent();
    await flush();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});

describe("persisted dirty flag", () => {
  beforeEach(() => sync.setSessionActive(true));

  it("is set while a change is unsynced and cleared once the server accepts it", async () => {
    let resolvePut;
    apiRequestMock.mockImplementationOnce(() => new Promise((r) => { resolvePut = r; }));
    setCurrentCache({ mode: "king" });
    sync.setCurrent();
    await flush();
    expect(localStorage.getItem(DIRTY_KEY)).toBe("1");
    expect(sync.isDirty()).toBe(true);

    resolvePut({ version: 1 });
    await flush();
    expect(localStorage.getItem(DIRTY_KEY)).toBeNull();
  });

  it("survives failed pushes, so a reload still knows the cache is ahead of the server", async () => {
    vi.useFakeTimers();
    setCurrentCache({ mode: "king" });
    apiRequestMock.mockRejectedValue(new MockApiError(0, "network_error", "offline"));
    sync.setCurrent();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.getStatus()).toBe("offline");
    expect(localStorage.getItem(DIRTY_KEY)).toBe("1");
    expect(sync.hasPending()).toBe(true);
  });

  it("a change that lands while a push is in flight keeps the flag set after the first push succeeds", async () => {
    let resolveFirst;
    let resolveSecond;
    apiRequestMock
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r; }));
    setCurrentCache({ mode: "king", rev: 1 });
    sync.setCurrent();
    await flush();
    setCurrentCache({ mode: "king", rev: 2 });
    sync.setCurrent();
    resolveFirst({ version: 1 });
    await settle();
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(DIRTY_KEY)).toBe("1");
    resolveSecond({ version: 2 });
    await settle();
    expect(localStorage.getItem(DIRTY_KEY)).toBeNull();
  });
});

describe("outbox (one retry slot per operation, not one for everything)", () => {
  beforeEach(() => sync.setSessionActive(true));

  it("offline: a failing current push no longer overwrites a failing history add — both are sent on recovery", async () => {
    vi.useFakeTimers();
    setCurrentCache({ mode: "king", tournamentId: "t1" });
    apiRequestMock.mockRejectedValue(new MockApiError(0, "network_error", "offline"));

    sync.addHistory({ id: "h1" }); // finished tournament
    sync.setCurrent();             // the current-tournament push, failing afterwards
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.getStatus()).toBe("offline");
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEY))).toHaveLength(1);

    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ version: 1 });
    await vi.advanceTimersByTimeAsync(2000);

    const calls = apiRequestMock.mock.calls.map(([path, opts]) => `${opts.method} ${path}`);
    expect(calls).toContain("POST /history");
    expect(calls).toContain("PUT /tournaments/current");
    expect(sync.hasPending()).toBe(false);
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    expect(sync.getStatus()).toBe("synced");
  });

  it("sends history writes strictly in order, and a clear drops the earlier ones", async () => {
    let release;
    apiRequestMock.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    apiRequestMock.mockResolvedValue(null);

    sync.addHistory({ id: "h1" });
    await flush();
    sync.addHistory({ id: "h2" });
    sync.deleteHistory("h2");
    sync.clearHistory();
    sync.addHistory({ id: "h3" });
    release(null);
    await new Promise((r) => setTimeout(r, 0));

    expect(apiRequestMock.mock.calls.map(([path, o]) => `${o.method} ${path}`))
      .toEqual(["POST /history", "DELETE /history", "POST /history"]);
    expect(apiRequestMock.mock.calls[2][1].body.record.id).toBe("h3");
  });

  it("drops an op the server rejects for good (4xx) instead of blocking the ones behind it", async () => {
    apiRequestMock
      .mockRejectedValueOnce(new MockApiError(422, "invalid_state", "bad"))
      .mockResolvedValueOnce(null);
    sync.addHistory({ id: "bad" });
    sync.addHistory({ id: "good" });
    await new Promise((r) => setTimeout(r, 0));
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
  });

  it("keeps a rate-limited (429) history write queued instead of dropping it", async () => {
    vi.useFakeTimers();
    try {
      apiRequestMock
        .mockRejectedValueOnce(new MockApiError(429, "too_many_requests", "slow down", null, 10))
        .mockResolvedValue(null);
      sync.addHistory({ id: "h1" });
      await vi.advanceTimersByTimeAsync(0);
      expect(JSON.parse(localStorage.getItem(OUTBOX_KEY))).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(apiRequestMock).toHaveBeenCalledTimes(2);
      expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a delete of the current tournament is queued and retried, and a later setCurrent supersedes it", async () => {
    vi.useFakeTimers();
    apiRequestMock.mockRejectedValue(new MockApiError(500, "server_error", "down"));
    sync.deleteCurrent();
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEY)).map((o) => o.type)).toEqual(["currentDelete"]);

    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ version: 1 });
    setCurrentCache({ mode: "king" });
    sync.setCurrent();
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("drains when the browser comes back online, without waiting for the backoff timer", async () => {
    vi.useFakeTimers();
    apiRequestMock.mockRejectedValueOnce(new MockApiError(0, "network_error", "offline"));
    sync.addHistory({ id: "h1" });
    await vi.advanceTimersByTimeAsync(0);
    apiRequestMock.mockResolvedValue(null);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
  });
});

describe("sign-out vs session expiry", () => {
  it("an explicit sign-out clears the dirty flag, the outbox and the version", async () => {
    sync.setSessionActive(true, "u1");
    apiRequestMock.mockRejectedValue(new MockApiError(0, "network_error", "offline"));
    setCurrentCache({ mode: "king" });
    sync.setCurrent();
    sync.addHistory({ id: "h1" });
    await settle();
    expect(sync.hasPending()).toBe(true);

    sync.setSessionActive(false);
    expect(sync.hasPending()).toBe(false);
    expect(localStorage.getItem(DIRTY_KEY)).toBeNull();
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    expect(localStorage.getItem(VERSION_KEY)).toBeNull();
  });

  it("an expired session keeps the unsynced work for the same user, and drops it for a different one", async () => {
    sync.setSessionActive(true, "u1");
    apiRequestMock.mockRejectedValue(new MockApiError(0, "network_error", "offline"));
    sync.addHistory({ id: "h1" });
    await settle();

    sync.setSessionActive(false, undefined, { keepPending: true });
    expect(sync.hasPending()).toBe(true);
    sync.setSessionActive(true, "u1");
    expect(sync.hasPending()).toBe(true);

    sync.setSessionActive(false, undefined, { keepPending: true });
    sync.setSessionActive(true, "someone-else");
    expect(sync.hasPending()).toBe(false);
  });
});

describe("409 conflict keeps this device's version", () => {
  beforeEach(() => sync.setSessionActive(true));

  it("backs up the local state, announces the conflict, and 'restore my version' pushes it back", async () => {
    const mine = { mode: "king", tournamentId: "t1", matches: [{ id: "m1", s1: "3", s2: "0", played: true }] };
    const theirs = { mode: "king", tournamentId: "t1", matches: [{ id: "m1", s1: "0", s2: "0", played: false }] };
    setCurrentCache(mine);
    apiRequestMock.mockRejectedValueOnce(new MockApiError(409, "conflict", "conflict", { version: 6, state: theirs }));

    const onConflict = vi.fn();
    window.addEventListener(sync.CONFLICT_EVENT, onConflict);
    try {
      sync.setCurrent();
      await settle();
    } finally {
      window.removeEventListener(sync.CONFLICT_EVENT, onConflict);
    }

    expect(onConflict).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(CONFLICT_KEY)).state).toEqual(mine);
    expect(sync.getConflictBackup().state).toEqual(mine);
    expect(JSON.parse(localStorage.getItem(CURRENT_KEY))).toEqual(theirs); // server's copy adopted

    apiRequestMock.mockResolvedValueOnce({ version: 7 });
    const onRemote = vi.fn();
    window.addEventListener(sync.REMOTE_UPDATE_EVENT, onRemote);
    try {
      sync.restoreConflictBackup();
      await settle();
    } finally {
      window.removeEventListener(sync.REMOTE_UPDATE_EVENT, onRemote);
    }
    expect(onRemote.mock.calls[0][0].detail.current).toEqual(mine);
    expect(JSON.parse(localStorage.getItem(CURRENT_KEY))).toEqual(mine);
    expect(localStorage.getItem(CONFLICT_KEY)).toBeNull();
    // pushed with the server's version, so it is accepted rather than conflicting again
    expect(apiRequestMock).toHaveBeenLastCalledWith("/tournaments/current", expect.objectContaining({
      body: { expectedVersion: 6, state: mine },
    }));
  });

  it("makes no backup when the server's copy is the same tournament (e.g. our own keepalive write landed)", async () => {
    const state = { mode: "king", tournamentId: "t1", players: [{ id: "p1", name: "Sam" }], matches: [{ id: "m1", bye: false, leg: undefined }] };
    const serverView = { mode: "king", tournamentId: "t1", players: [{ id: "p1", name: "Sam" }], matches: [{ id: "m1", bye: false, leg: null }], modeState: {}, stakes: { prize: "", chore: "" } };
    setCurrentCache(state);
    apiRequestMock.mockRejectedValueOnce(new MockApiError(409, "conflict", "conflict", { version: 3, state: serverView }));
    sync.setCurrent();
    await settle();
    expect(localStorage.getItem(CONFLICT_KEY)).toBeNull();
    expect(sync.getStatus()).toBe("synced");
  });

  it("dismissing forgets the backup", async () => {
    localStorage.setItem(CONFLICT_KEY, JSON.stringify({ savedAt: "x", state: { mode: "king" } }));
    sync.dismissConflictBackup();
    expect(sync.getConflictBackup()).toBeNull();
  });
});

describe("flush on pagehide / hidden", () => {
  beforeEach(() => sync.setSessionActive(true));

  it("runs the registered pre-flush hook first, so the PUT carries the not-yet-debounced state", async () => {
    setCurrentCache({ mode: "king", rev: "stale" });
    sync.setCurrent(); // an earlier change, still dirty
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ version: 2 });
    await flush();
    apiRequestMock.mockClear();
    localStorage.setItem(DIRTY_KEY, "1");

    const hook = vi.fn(() => { setCurrentCache({ mode: "king", rev: "fresh" }); sync.setCurrent(); });
    const off = sync.registerPreFlush(hook);
    try {
      window.dispatchEvent(new Event("pagehide"));
      await settle();
    } finally {
      off();
    }

    expect(hook).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledTimes(1); // the hook's setCurrent did not start a second push
    expect(apiRequestMock.mock.calls[0][1].body.state).toEqual({ mode: "king", rev: "fresh" });
    expect(apiRequestMock.mock.calls[0][1].keepalive).toBe(true);
  });

  it("also flushes when the tab becomes hidden, and does nothing when nothing is unsynced", async () => {
    const original = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    try {
      apiRequestMock.mockResolvedValue({ version: 1 });
      document.dispatchEvent(new Event("visibilitychange"));
      await flush();
      expect(apiRequestMock).not.toHaveBeenCalled(); // not dirty

      setCurrentCache({ mode: "king" });
      localStorage.setItem(DIRTY_KEY, "1");
      document.dispatchEvent(new Event("visibilitychange"));
      await settle();
      expect(apiRequestMock).toHaveBeenCalledTimes(1);
      expect(apiRequestMock.mock.calls[0][1].keepalive).toBe(true);
    } finally {
      delete document.visibilityState;
      if (original) Object.defineProperty(Document.prototype, "visibilityState", original);
    }
  });
});

afterEach(() => {
  vi.useRealTimers();
  hasApiMock.mockReturnValue(true);
});
