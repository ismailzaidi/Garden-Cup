import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { apiRequestMock, MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(status, code, message, body = null) {
      super(message);
      this.status = status;
      this.code = code;
      this.body = body;
    }
  }
  return { apiRequestMock: vi.fn(), MockApiError };
});

vi.mock("../src/lib/apiClient.js", () => ({
  hasApi: () => true,
  apiRequest: apiRequestMock,
  onUnauthorized: () => () => {},
  ApiError: MockApiError,
  API_BASE: "/api",
}));

const sync = await import("../src/lib/syncEngine.js");
const { useCloudReconciliation, mergeHistory } = await import("../src/lib/reconcile.js");

const CURRENT = "gardenCup:current";
const HISTORY = "gardenCup:history";
const user = { id: "u1" };

/* Stands in for the server: GET returns what's configured, writes are recorded. */
function server({ current = null, version = 0, history = [], putResult = { version: 99 } } = {}) {
  const writes = [];
  apiRequestMock.mockImplementation(async (path, opts = {}) => {
    const method = opts.method || "GET";
    if (method === "GET" && path === "/tournaments/current") return { version, state: current };
    if (method === "GET" && path === "/history") return { history };
    writes.push({ method, path, body: opts.body });
    if (method === "PUT" && putResult instanceof Error) throw putResult;
    return method === "PUT" ? putResult : null;
  });
  return writes;
}

const h = (id, date) => ({ id, date, mode: "league", players: [], champion: "x", topScorer: null, totalGoals: 0 });
const remoteEvents = () => {
  const events = [];
  const on = (e) => events.push(e.detail);
  window.addEventListener(sync.REMOTE_UPDATE_EVENT, on);
  return { events, off: () => window.removeEventListener(sync.REMOTE_UPDATE_EVENT, on) };
};

beforeEach(() => {
  localStorage.clear();
  apiRequestMock.mockReset();
  sync.setSessionActive(false);
  sync.setSessionActive(true, "u1");
});

describe("useCloudReconciliation", () => {
  it("adopts the server's tournament when this device has nothing unsynced", async () => {
    localStorage.setItem(CURRENT, JSON.stringify({ mode: "league", tournamentId: "old" }));
    server({ current: { mode: "king", tournamentId: "srv" }, version: 5 });
    const { events, off } = remoteEvents();

    renderHook(() => useCloudReconciliation("cloud", user));
    await waitFor(() => expect(events).toHaveLength(1));
    off();

    expect(JSON.parse(localStorage.getItem(CURRENT))).toEqual({ mode: "king", tournamentId: "srv" });
    expect(localStorage.getItem("gardenCup:version")).toBe("5");
    expect(events[0].current).toEqual({ mode: "king", tournamentId: "srv" });
  });

  it("pushes unsynced local work FIRST instead of replacing it with the server copy", async () => {
    const mine = { mode: "league", tournamentId: "t1", matches: [{ id: "m1", s1: "4" }] };
    localStorage.setItem(CURRENT, JSON.stringify(mine));
    localStorage.setItem("gardenCup:dirty", "1"); // persisted from before the reload
    localStorage.setItem("gardenCup:version", "3");
    const writes = server({ current: { mode: "league", tournamentId: "t1", matches: [] }, version: 3 });
    const { events, off } = remoteEvents();

    renderHook(() => useCloudReconciliation("cloud", user));
    await waitFor(() => expect(writes.some((w) => w.method === "PUT")).toBe(true));
    off();

    expect(JSON.parse(localStorage.getItem(CURRENT))).toEqual(mine);
    expect(events.every((e) => e.current === undefined)).toBe(true); // UI state never replaced
    const put = writes.find((w) => w.method === "PUT");
    expect(put.body).toEqual({ expectedVersion: 3, state: mine }); // the version it was based on, not the server's current one
  });

  it("if the server moved on meanwhile, the unsynced local work is backed up, not lost", async () => {
    const mine = { mode: "league", tournamentId: "t1", matches: [{ id: "m1", s1: "4", s2: "0", played: true }] };
    const theirs = { mode: "league", tournamentId: "t1", matches: [{ id: "m1", s1: "0", s2: "0", played: false }] };
    localStorage.setItem(CURRENT, JSON.stringify(mine));
    localStorage.setItem("gardenCup:dirty", "1");
    localStorage.setItem("gardenCup:version", "3");
    server({ current: theirs, version: 7, putResult: new MockApiError(409, "conflict", "c", { version: 7, state: theirs }) });

    renderHook(() => useCloudReconciliation("cloud", user));
    await waitFor(() => expect(sync.getConflictBackup()).not.toBeNull());
    expect(sync.getConflictBackup().state).toEqual(mine);
  });

  it("merges history by id: a record finished offline survives the reload, and so does a remote one", async () => {
    localStorage.setItem(HISTORY, JSON.stringify([h("local-only", "2026-03-01"), h("both", "2026-02-01")]));
    server({ history: [h("both", "2026-02-01"), h("remote-only", "2026-01-01")] });
    const { events, off } = remoteEvents();

    renderHook(() => useCloudReconciliation("cloud", user));
    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    off();

    const merged = JSON.parse(localStorage.getItem(HISTORY));
    expect(merged.map((r) => r.id)).toEqual(["local-only", "both", "remote-only"]);
  });

  it("does not resurrect a history record whose delete is still queued, nor anything behind a queued clear", async () => {
    apiRequestMock.mockRejectedValue(new MockApiError(0, "network_error", "offline"));
    sync.deleteHistory("gone");
    await new Promise((r) => setTimeout(r, 0));
    server({ history: [h("gone", "2026-02-01"), h("kept", "2026-01-01")] });

    const { events, off } = remoteEvents();
    renderHook(() => useCloudReconciliation("cloud", user));
    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    off();
    expect(JSON.parse(localStorage.getItem(HISTORY)).map((r) => r.id)).toEqual(["kept"]);
  });

  it("server has history but no current tournament: the local in-progress tournament is kept", async () => {
    const mine = { mode: "league", tournamentId: "t1", matches: [{ id: "m1" }] };
    localStorage.setItem(CURRENT, JSON.stringify(mine));
    server({ current: null, history: [h("old", "2026-01-01")] });

    const { result } = renderHook(() => useCloudReconciliation("cloud", user));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(HISTORY) || "[]")).toHaveLength(1));

    expect(JSON.parse(localStorage.getItem(CURRENT))).toEqual(mine);
    // not this account's own unsynced work, so it asks before importing it
    await waitFor(() => expect(result.current.importPrompt).toBe(true));
  });

  it("server has history but no current tournament, and the local one is unsynced: it is pushed, not asked about", async () => {
    const mine = { mode: "league", tournamentId: "t1" };
    localStorage.setItem(CURRENT, JSON.stringify(mine));
    localStorage.setItem("gardenCup:dirty", "1");
    const writes = server({ current: null, history: [h("old", "2026-01-01")] });

    const { result } = renderHook(() => useCloudReconciliation("cloud", user));
    await waitFor(() => expect(writes.some((w) => w.method === "PUT")).toBe(true));
    expect(JSON.parse(localStorage.getItem(CURRENT))).toEqual(mine);
    expect(result.current.importPrompt).toBe(false);
  });

  it("offline at load: touches nothing and resumes the queued writes", async () => {
    localStorage.setItem(CURRENT, JSON.stringify({ mode: "league", tournamentId: "t1" }));
    localStorage.setItem("gardenCup:dirty", "1");
    apiRequestMock.mockRejectedValue(new MockApiError(0, "network_error", "offline"));
    renderHook(() => useCloudReconciliation("cloud", user));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(JSON.parse(localStorage.getItem(CURRENT)).tournamentId).toBe("t1");
    expect(sync.isDirty()).toBe(true);
  });

  it("does nothing outside cloud mode", async () => {
    server();
    renderHook(() => useCloudReconciliation("local", null));
    await new Promise((r) => setTimeout(r, 0));
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});

describe("mergeHistory", () => {
  it("unions by id, newest first, preferring the server's copy of a shared record", () => {
    const merged = mergeHistory([{ ...h("a", "2026-01-01"), champion: "server" }], [{ ...h("a", "2026-01-01"), champion: "local" }, h("b", "2026-05-01")]);
    expect(merged.map((r) => r.id)).toEqual(["b", "a"]);
    expect(merged[1].champion).toBe("server");
  });
});
