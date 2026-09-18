import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTimers } from "../src/engine/useTimers.js";

vi.mock("../src/engine/audio.js", () => ({
  unlockAudio: vi.fn(),
  playBeep: vi.fn(),
  playCountdownTick: vi.fn(),
  playPauseReminder: vi.fn(),
  cancelSpeech: vi.fn(),
}));

import { playBeep, playCountdownTick, playPauseReminder, cancelSpeech } from "../src/engine/audio.js";

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// The interval fires a second after the timer starts, so a timer started at N
// seconds first reports N-1: ticks are the seconds the clock is *seen*
// crossing, never the one it was started on.
describe("useTimers countdown ticks", () => {
  it("ticks once per second through the final ten, then beeps once at zero", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(15));
    act(() => result.current.timerControls("m1").onStart());

    // 15s -> 11s remaining: still outside the final ten
    act(() => { vi.advanceTimersByTime(4000); });
    expect(playCountdownTick).not.toHaveBeenCalled();

    // crosses into the final ten
    act(() => { vi.advanceTimersByTime(1000); });
    expect(playCountdownTick).toHaveBeenCalledTimes(1);
    expect(playCountdownTick).toHaveBeenCalledWith(10);

    // one tick for every remaining second — 10 down to 1 — then full time,
    // each call carrying the second it's announcing rather than a bare tick
    act(() => { vi.advanceTimersByTime(10000); });
    expect(playCountdownTick).toHaveBeenCalledTimes(10);
    expect(playCountdownTick.mock.calls.map((c) => c[0])).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(playBeep).toHaveBeenCalledTimes(1);

    // time already elapsed — nothing fires again
    act(() => { vi.advanceTimersByTime(3000); });
    expect(playCountdownTick).toHaveBeenCalledTimes(10);
    expect(playBeep).toHaveBeenCalledTimes(1);
  });

  it("ticks ten times and beeps once for the 30-second preset", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(30));
    act(() => result.current.timerControls("m1").onStart());
    act(() => { vi.advanceTimersByTime(30000); });

    // same shape as the 15s case above: the final ten seconds each tick once,
    // then the full-time beep — the preset value itself isn't special-cased
    // anywhere in useTimers, so this just confirms it wires up like any other
    expect(playCountdownTick).toHaveBeenCalledTimes(10);
    expect(playBeep).toHaveBeenCalledTimes(1);
  });

  it("ticks from the first second when the duration is under ten seconds", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(5));
    act(() => result.current.timerControls("m1").onStart());
    act(() => { vi.advanceTimersByTime(5000); });

    // 4, 3, 2, 1 — every second the clock is seen at — then full time
    expect(playCountdownTick).toHaveBeenCalledTimes(4);
    expect(playBeep).toHaveBeenCalledTimes(1);
  });

  it("stops ticking while paused and picks the countdown up where it left off", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(15));
    act(() => result.current.timerControls("m1").onStart());

    // run down to 7 seconds remaining: ticks at 10, 9, 8, 7
    act(() => { vi.advanceTimersByTime(8000); });
    expect(playCountdownTick).toHaveBeenCalledTimes(4);
    expect(playCountdownTick.mock.calls.map((c) => c[0])).toEqual([10, 9, 8, 7]);

    act(() => result.current.timerControls("m1").onPause());
    act(() => { vi.advanceTimersByTime(5000); });
    expect(playCountdownTick).toHaveBeenCalledTimes(4); // silent while paused

    // resuming continues at 6, 5, 4, 3, 2, 1 rather than restarting the
    // countdown — ten ticks for the run, however often it was paused, each
    // still carrying the correct second
    act(() => result.current.timerControls("m1").onStart());
    act(() => { vi.advanceTimersByTime(7000); });
    expect(playCountdownTick).toHaveBeenCalledTimes(10);
    expect(playCountdownTick.mock.calls.map((c) => c[0])).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(playBeep).toHaveBeenCalledTimes(1);
  });

  it("ticks again for a fresh run after a reset", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(12));
    act(() => result.current.timerControls("m1").onStart());
    act(() => { vi.advanceTimersByTime(12000); });
    expect(playCountdownTick).toHaveBeenCalledTimes(10);

    act(() => result.current.timerControls("m1").onReset());
    act(() => result.current.timerControls("m1").onStart());
    act(() => { vi.advanceTimersByTime(12000); });
    expect(playCountdownTick).toHaveBeenCalledTimes(20);
    expect(playBeep).toHaveBeenCalledTimes(2);
  });

  it("counts each running timer down independently", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => {
      result.current.timerControls("m1").onSetDuration(15);
      result.current.timerControls("m2").onSetDuration(12);
    });
    act(() => {
      result.current.timerControls("m1").onStart();
      result.current.timerControls("m2").onStart();
    });

    act(() => { vi.advanceTimersByTime(12000); });

    // m1 is at 3 seconds (8 ticks); m2 has run out (10 ticks and a beep)
    expect(playCountdownTick).toHaveBeenCalledTimes(18);
    expect(playBeep).toHaveBeenCalledTimes(1);
  });
});

// The 2-second cadence lives in useTimers' own PAUSE_REMINDER_INTERVAL_MS
// constant; these advance fake time by exactly that much so a change to
// the constant would fail these tests loudly rather than silently.
describe("useTimers pause reminder", () => {
  it("announces once immediately when paused, then again every interval for as long as it stays paused", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(30));
    act(() => result.current.timerControls("m1").onStart());
    act(() => result.current.timerControls("m1").onPause());

    expect(playPauseReminder).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(playPauseReminder).toHaveBeenCalledTimes(2);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(playPauseReminder).toHaveBeenCalledTimes(3);
  });

  it("stops the repeat the instant play is pressed, with nothing left queued behind it", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(30));
    act(() => result.current.timerControls("m1").onStart());
    act(() => result.current.timerControls("m1").onPause());
    expect(playPauseReminder).toHaveBeenCalledTimes(1);

    act(() => result.current.timerControls("m1").onStart());
    expect(cancelSpeech).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(10000); });
    expect(playPauseReminder).toHaveBeenCalledTimes(1); // no further reminders after resuming
  });

  it("stops the repeat on reset and cancels the in-flight utterance", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(30));
    act(() => result.current.timerControls("m1").onStart());
    act(() => result.current.timerControls("m1").onPause());
    expect(playPauseReminder).toHaveBeenCalledTimes(1);

    act(() => result.current.timerControls("m1").onReset());
    expect(cancelSpeech).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(10000); });
    expect(playPauseReminder).toHaveBeenCalledTimes(1);
  });

  it("stops the repeat when the duration changes while paused", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(30));
    act(() => result.current.timerControls("m1").onStart());
    act(() => result.current.timerControls("m1").onPause());
    expect(playPauseReminder).toHaveBeenCalledTimes(1);

    act(() => result.current.timerControls("m1").onSetDuration(60));
    expect(cancelSpeech).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(10000); });
    expect(playPauseReminder).toHaveBeenCalledTimes(1);
  });

  it("stops every running reminder when clearTimers runs", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => {
      result.current.timerControls("m1").onSetDuration(30);
      result.current.timerControls("m2").onSetDuration(30);
    });
    act(() => {
      result.current.timerControls("m1").onStart();
      result.current.timerControls("m2").onStart();
    });
    act(() => {
      result.current.timerControls("m1").onPause();
      result.current.timerControls("m2").onPause();
    });
    expect(playPauseReminder).toHaveBeenCalledTimes(2);

    act(() => result.current.clearTimers());
    expect(cancelSpeech).toHaveBeenCalledTimes(2);

    act(() => { vi.advanceTimersByTime(10000); });
    expect(playPauseReminder).toHaveBeenCalledTimes(2);
  });

  it("does not announce for a timer that was never running", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onPause()); // never started
    expect(playPauseReminder).not.toHaveBeenCalled();
    expect(cancelSpeech).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(10000); });
    expect(playPauseReminder).not.toHaveBeenCalled();
  });

  it("does not announce a second time for a timer that is already paused", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTimers());

    act(() => result.current.timerControls("m1").onSetDuration(30));
    act(() => result.current.timerControls("m1").onStart());
    act(() => result.current.timerControls("m1").onPause());
    expect(playPauseReminder).toHaveBeenCalledTimes(1);

    act(() => result.current.timerControls("m1").onPause()); // already paused
    expect(playPauseReminder).toHaveBeenCalledTimes(1); // no extra immediate announce

    // still only the one repeat cycle, not two overlapping ones
    act(() => { vi.advanceTimersByTime(2000); });
    expect(playPauseReminder).toHaveBeenCalledTimes(2);
  });
});
