import { describe, it, expect } from "vitest";
import { formatTime, formatPreset } from "../src/engine/format.js";

describe("formatTime", () => {
  it("pads minutes and seconds to two digits", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(5)).toBe("00:05");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(600)).toBe("10:00");
  });

  it("floors a fractional input and never goes negative", () => {
    expect(formatTime(59.6)).toBe("01:00"); // rounds, then splits into m/s
    expect(formatTime(-5)).toBe("00:00");
  });
});

describe("formatPreset", () => {
  it("labels sub-minute presets in seconds", () => {
    expect(formatPreset(30)).toBe("30s");
  });

  it("labels minute-and-up presets as Nm", () => {
    expect(formatPreset(60)).toBe("1m");
    expect(formatPreset(300)).toBe("5m");
  });
});
