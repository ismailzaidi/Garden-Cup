import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiError, onUnauthorized } from "../src/lib/apiClient.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("sends JSON with the right method, headers, and same-origin credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/tournaments/current", { method: "PUT", body: { a: 1 } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/tournaments/current");
    expect(opts.method).toBe("PUT");
    expect(opts.credentials).toBe("same-origin");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.body).toBe(JSON.stringify({ a: 1 }));
    expect(opts.headers.Authorization).toBeUndefined(); // cookie auth, never a bearer header
  });

  it("omits the body entirely for a GET with no body given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/auth/me");

    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it("returns the parsed JSON body on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { user: { id: "u1" } })));
    const result = await apiRequest("/auth/me");
    expect(result).toEqual({ user: { id: "u1" } });
  });

  it("returns null for a 204 with no body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" }));
    const result = await apiRequest("/auth/logout", { method: "POST" });
    expect(result).toBeNull();
  });

  it("throws ApiError with the server's error code/message on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(422, { error: "invalid_state", message: "bad match" })));

    await expect(apiRequest("/tournaments/current", { method: "PUT" })).rejects.toMatchObject({
      status: 422,
      code: "invalid_state",
      message: "bad match",
    });
  });

  it("falls back to a generic error when the error response has no JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => { throw new Error("not json"); },
    }));

    await expect(apiRequest("/history")).rejects.toMatchObject({
      status: 500,
      code: "http_error",
      message: "Internal Server Error",
    });
  });

  it("wraps a network failure (fetch throwing) as a status-0 ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(apiRequest("/history")).rejects.toMatchObject({ status: 0, code: "network_error" });
  });

  it("carries the parsed body on the ApiError (used for a 409's {version, state})", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { error: "conflict", version: 3, state: { mode: "king" } })));

    try {
      await apiRequest("/tournaments/current", { method: "PUT" });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.body).toEqual({ error: "conflict", version: 3, state: { mode: "king" } });
    }
  });
});

describe("onUnauthorized", () => {
  // unauthorizedHandlers is module-level state with no reset hook exposed
  // (by design — there's no legitimate runtime reason to clear it). Track
  // every subscription made in this block and unsubscribe it afterwards, so
  // one test's handlers can't fire during another's.
  const unsubs = [];
  const subscribe = (fn) => { const unsub = onUnauthorized(fn); unsubs.push(unsub); return unsub; };
  afterEach(() => { unsubs.splice(0).forEach((unsub) => unsub()); });

  it("notifies every registered handler on a 401, and stops after unsubscribing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "unauthorized" })));

    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const unsubA = subscribe(handlerA);
    subscribe(handlerB);

    await apiRequest("/tournaments/current").catch(() => {});
    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);

    unsubA();
    await apiRequest("/tournaments/current").catch(() => {});
    expect(handlerA).toHaveBeenCalledTimes(1); // unsubscribed, no second call
    expect(handlerB).toHaveBeenCalledTimes(2);
  });

  it("does not notify handlers for a non-401 error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(422, { error: "invalid_state" })));
    const handler = vi.fn();
    subscribe(handler);

    await apiRequest("/tournaments/current").catch(() => {});
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not let one throwing handler stop the others from running", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, {})));
    const throwing = vi.fn(() => { throw new Error("boom"); });
    const after = vi.fn();
    subscribe(throwing);
    subscribe(after);

    await apiRequest("/history").catch(() => {});
    expect(after).toHaveBeenCalledTimes(1);
  });
});
