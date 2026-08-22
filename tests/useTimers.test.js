import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTimers } from "../src/engine/useTimers.js";

vi.mock("../src/engine/audio.js", () => ({
  unlockAudio: vi.fn(),
  playBeep: vi.fn(),
  playCountdownRing: vi.fn(),
}));

import { playBeep, playCountdownRing } from "../src/engine/audio.js";

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useTimers", () => {
  it("rings once when a running timer crosses 10 seconds remaining, then beeps once at 0", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(15));
    act(() => result.current.timerControls("m1").onStart());

    // 0s -> 10s remaining: no ring yet
    act(() => { vi.advanceTimersByTime(4000); });
    expect(playCountdownRing).not.toHaveBeenCalled();

    // crosses into the final 10 seconds
    act(() => { vi.advanceTimersByTime(1000); });
    expect(playCountdownRing).toHaveBeenCalledTimes(1);

    // stays within the final 10 seconds, then hits 0 — full-time beep fires
    act(() => { vi.advanceTimersByTime(10000); });
    expect(playCountdownRing).toHaveBeenCalledTimes(1);
    expect(playBeep).toHaveBeenCalledTimes(1);

    // time already elapsed — no further firing
    act(() => { vi.advanceTimersByTime(2000); });
    expect(playCountdownRing).toHaveBeenCalledTimes(1);
    expect(playBeep).toHaveBeenCalledTimes(1);
  });
});
