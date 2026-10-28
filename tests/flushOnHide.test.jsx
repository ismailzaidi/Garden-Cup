import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../src/lib/apiClient.js", () => ({
  hasApi: () => true,
  apiRequest: apiRequestMock,
  onUnauthorized: () => () => {},
  ApiError: class ApiError extends Error {},
  API_BASE: "/api",
}));

const sync = await import("../src/lib/syncEngine.js");
const { useTournament } = await import("../src/engine/useTournament.js");

const CURRENT = "gardenCup:current";

beforeEach(() => {
  localStorage.clear();
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({ version: 1 });
  sync.setSessionActive(false);
  sync.setSessionActive(true, "u1");
});

/* The save is debounced 1500ms. These all act well inside that window. */
async function typeAPlayer(result, name) {
  await waitFor(() => expect(result.current.loaded).toBe(true));
  act(() => result.current.actions.setNameInput(name));
  act(() => result.current.actions.addPlayer());
  await waitFor(() => expect(result.current.players).toHaveLength(1));
}

describe("useTournament's debounced save", () => {
  it("is not yet in the cache inside the debounce window (the problem being fixed)", async () => {
    const { result } = renderHook(() => useTournament());
    await typeAPlayer(result, "Sam");
    expect(localStorage.getItem(CURRENT)).toBeNull();
  });

  it("is flushed synchronously on pagehide, and that is what gets pushed", async () => {
    const { result } = renderHook(() => useTournament());
    await typeAPlayer(result, "Sam");

    act(() => { window.dispatchEvent(new Event("pagehide")); });

    expect(JSON.parse(localStorage.getItem(CURRENT)).players.map((p) => p.name)).toEqual(["Sam"]);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [path, opts] = apiRequestMock.mock.calls[0];
    expect(path).toBe("/tournaments/current");
    expect(opts.keepalive).toBe(true);
    expect(opts.body.state.players.map((p) => p.name)).toEqual(["Sam"]);
  });

  it("is flushed when the tab is hidden too (iOS/Android often skip pagehide)", async () => {
    const { result } = renderHook(() => useTournament());
    await typeAPlayer(result, "Ali");

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    try {
      act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    } finally {
      delete document.visibilityState;
    }
    expect(JSON.parse(localStorage.getItem(CURRENT)).players.map((p) => p.name)).toEqual(["Ali"]);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it("does not write again when nothing changed since the last write", async () => {
    const { result } = renderHook(() => useTournament());
    await typeAPlayer(result, "Sam");
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    await waitFor(() => expect(sync.isDirty()).toBe(false));
    apiRequestMock.mockClear();
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("a plain reload (identical state) does not mark the tournament unsynced", async () => {
    const first = renderHook(() => useTournament());
    await typeAPlayer(first.result, "Sam");
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    await waitFor(() => expect(sync.isDirty()).toBe(false));
    first.unmount();
    apiRequestMock.mockClear();

    // the next page load: same cache, nothing edited
    const second = renderHook(() => useTournament());
    await waitFor(() => expect(second.result.current.loaded).toBe(true));
    expect(second.result.current.players).toHaveLength(1);
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(sync.isDirty()).toBe(false);
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});
