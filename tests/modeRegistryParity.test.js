import { describe, it, expect } from "vitest";
import { MODES } from "../src/modes/index.js";
import { MODE_STAGES } from "../api/_lib/modes.js";

// api/_lib/modes.js can't import this client registry (it's JSX, and the
// API is a separate Node runtime), so it's a hand-kept mirror instead. This
// test is the thing that's supposed to catch drift: without it, adding a
// mode here without updating the server mirror fails silently — every save
// for that mode 422s, and the sync engine treats that as non-retryable, so
// the user just sees a stuck "Sync error" pill with no further clue.
describe("api/_lib/modes.js stays in sync with src/modes/index.js", () => {
  it("declares the same set of modes", () => {
    const clientKeys = MODES.map((m) => m.key).sort();
    const serverKeys = Object.keys(MODE_STAGES).sort();
    expect(serverKeys).toEqual(clientKeys);
  });

  it("declares the same stages for every mode", () => {
    for (const mode of MODES) {
      expect(MODE_STAGES[mode.key], `api/_lib/modes.js is missing mode "${mode.key}"`).toBeDefined();
      expect([...MODE_STAGES[mode.key]].sort()).toEqual([...mode.stages].sort());
    }
  });
});
