import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import MatchTimer from "../src/components/MatchTimer.jsx";
import { C } from "../src/lib/theme.js";

afterEach(() => {
  cleanup();
});

function untouched(overrides = {}) {
  return { duration: 180, remaining: 180, running: false, ...overrides };
}

function noop() {}

describe("MatchTimer preset row", () => {
  it("shows all five presets, in order, only while the timer is untouched", () => {
    render(<MatchTimer timer={untouched()} onStart={noop} onPause={noop} onReset={noop} onSetDuration={noop} />);
    const labels = ["30s", "1m", "2m", "3m", "5m"];
    labels.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());

    // array order is render order — same buttons row, left to right
    const buttons = labels.map((label) => screen.getByText(label));
    const row = buttons[0].parentElement;
    expect(Array.from(row.children)).toEqual(buttons);
  });

  it("calls onSetDuration with the preset's seconds when 30s is clicked", () => {
    const onSetDuration = vi.fn();
    render(<MatchTimer timer={untouched()} onStart={noop} onPause={noop} onReset={noop} onSetDuration={onSetDuration} />);
    screen.getByText("30s").click();
    expect(onSetDuration).toHaveBeenCalledWith(30);
  });

  it("reads 00:30 and highlights the 30s button when the timer is set to 30 seconds", () => {
    render(<MatchTimer timer={untouched({ duration: 30, remaining: 30 })} onStart={noop} onPause={noop} onReset={noop} onSetDuration={noop} />);
    expect(screen.getByText("00:30")).toBeInTheDocument();

    const selected = screen.getByText("30s");
    const other = screen.getByText("1m");
    // jsdom normalises inline hex colours to rgb() on read-back, so compare
    // against a span styled with the same hex rather than the hex literal
    const swatch = document.createElement("span");
    swatch.style.backgroundColor = C.pitchLight;
    // the active preset is styled with the highlight colour used elsewhere
    // for a selected control; every other preset gets the muted one
    expect(selected.style.backgroundColor).toBe(swatch.style.backgroundColor);
    expect(other.style.backgroundColor).not.toBe(swatch.style.backgroundColor);
  });

  it("hides the preset row once the timer has been touched (running or counted down)", () => {
    render(<MatchTimer timer={{ duration: 180, remaining: 120, running: false }} onStart={noop} onPause={noop} onReset={noop} onSetDuration={noop} />);
    expect(screen.queryByText("30s")).not.toBeInTheDocument();
  });
});
