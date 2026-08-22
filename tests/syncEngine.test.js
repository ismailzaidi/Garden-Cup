import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above these, so the values it closes over must come
// from vi.hoisted() — see the same note in exportImport.test.js.
const { hasApiMock, apiRequestMock, onUnauthorizedMock, MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(status, code, message, body = null) {
      super(message);
      this.status = status;
      this.code = code;
      this.body = body;
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

function setCurrentCache(state) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
}

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

afterEach(() => {
  vi.useRealTimers();
  hasApiMock.mockReturnValue(true);
});
