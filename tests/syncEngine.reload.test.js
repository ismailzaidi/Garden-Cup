import { beforeEach, describe, expect, it, vi } from "vitest";

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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/* "Reload" = a brand-new copy of the module over the same localStorage. It
   lives in its own file because every module instance registers window
   listeners that nothing can remove. */
describe("a page load after unsent writes", () => {
  beforeEach(() => {
    localStorage.clear();
    apiRequestMock.mockReset();
    vi.resetModules();
  });

  it("finds the outbox and the dirty flag, and resumePending() sends them", async () => {
    let sync = await import("../src/lib/syncEngine.js");
    sync.setSessionActive(true, "u1");
    apiRequestMock.mockRejectedValue(new MockApiError(0, "network_error", "offline"));
    localStorage.setItem("gardenCup:current", JSON.stringify({ mode: "king" }));
    sync.addHistory({ id: "h1", champion: "Sam" });
    sync.deleteHistory("h0");
    sync.setCurrent();
    await settle();
    expect(JSON.parse(localStorage.getItem("gardenCup:outbox")).map((o) => o.type)).toEqual(["historyAdd", "historyDelete"]);

    vi.resetModules();
    sync = await import("../src/lib/syncEngine.js");
    expect(sync.hasPending()).toBe(true);
    expect(sync.isDirty()).toBe(true);

    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ version: 1 });
    sync.resumePending();
    await settle();

    const calls = apiRequestMock.mock.calls.map(([path, o]) => `${o.method} ${path}`);
    expect(calls).toEqual(expect.arrayContaining(["POST /history", "DELETE /history/h0", "PUT /tournaments/current"]));
    expect(calls.indexOf("POST /history")).toBeLessThan(calls.indexOf("DELETE /history/h0"));
    expect(sync.hasPending()).toBe(false);
  });

  it("does nothing when signed out, even with a stale outbox", async () => {
    localStorage.setItem("gardenCup:outbox", JSON.stringify([{ id: "a", type: "historyClear" }]));
    const sync = await import("../src/lib/syncEngine.js");
    sync.resumePending();
    await settle();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});
