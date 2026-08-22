import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock's factory is hoisted above this file's other top-level code, so
// the mock it returns has to come from vi.hoisted() rather than a plain
// const — referencing an ordinary variable here would hit it before its
// declaration has actually run.
//
// storage.js (which exportImport.js also imports) pulls setCurrent/
// deleteCurrent from this same module, so the mock needs to cover those
// too, even though this file never asserts on them — otherwise storage.set
// crashes calling `undefined` as a function.
const { addHistoryMock } = vi.hoisted(() => ({ addHistoryMock: vi.fn() }));
vi.mock("../src/lib/syncEngine.js", () => ({
  addHistory: (...args) => addHistoryMock(...args),
  setCurrent: () => {},
  deleteCurrent: () => {},
}));

const { exportData, importData } = await import("../src/lib/exportImport.js");

const CURRENT_KEY = "gardenCup:current";
const HISTORY_KEY = "gardenCup:history";

function makeFile(contents) {
  return { text: async () => contents };
}

beforeEach(() => {
  localStorage.clear();
  addHistoryMock.mockClear();
});

describe("exportData", () => {
  it("bundles whatever is in localStorage, current and history included", () => {
    const current = { tournamentId: "t1", mode: "league" };
    const history = [{ id: "h1", champion: "Alice" }];
    localStorage.setItem(CURRENT_KEY, JSON.stringify(current));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    let capturedBlobParts;
    const originalBlob = global.Blob;
    global.Blob = class {
      constructor(parts) { capturedBlobParts = parts; }
    };
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.fn();
    const anchor = { click: clickSpy, remove: vi.fn(), href: "", download: "" };
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(anchor);
    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => {});

    try {
      exportData();
    } finally {
      global.Blob = originalBlob;
      createElementSpy.mockRestore();
      appendSpy.mockRestore();
    }

    const bundle = JSON.parse(capturedBlobParts[0]);
    expect(bundle.app).toBe("garden-cup");
    expect(bundle.current).toEqual(current);
    expect(bundle.history).toEqual(history);
    expect(typeof bundle.exportedAt).toBe("string");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(anchor.download).toMatch(/^gardencup-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("exports current: null and history: [] when nothing is saved yet", () => {
    let capturedBlobParts;
    const originalBlob = global.Blob;
    global.Blob = class {
      constructor(parts) { capturedBlobParts = parts; }
    };
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue({ click: vi.fn(), remove: vi.fn(), href: "", download: "" });
    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => {});

    try {
      exportData();
    } finally {
      global.Blob = originalBlob;
      createElementSpy.mockRestore();
      appendSpy.mockRestore();
    }

    const bundle = JSON.parse(capturedBlobParts[0]);
    expect(bundle.current).toBeNull();
    expect(bundle.history).toEqual([]);
  });
});

describe("importData", () => {
  it("rejects a file that isn't valid JSON", async () => {
    await expect(importData(makeFile("not json"))).rejects.toThrow(/valid JSON/);
  });

  it("rejects valid JSON that doesn't look like a Garden Cup export", async () => {
    await expect(importData(makeFile(JSON.stringify({ foo: "bar" })))).rejects.toThrow(/doesn't look like/);
  });

  it("writes current and history into localStorage, and pushes history through the sync engine", async () => {
    const current = { tournamentId: "t1", mode: "knockout" };
    const history = [{ id: "h1", champion: "Bob" }, { id: "h2", champion: "Alice" }];
    const bundle = { app: "garden-cup", exportedAt: "2026-01-01T00:00:00.000Z", current, history };

    const result = await importData(makeFile(JSON.stringify(bundle)));

    expect(JSON.parse(localStorage.getItem(CURRENT_KEY))).toEqual(current);
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY))).toEqual(history);
    expect(addHistoryMock).toHaveBeenCalledTimes(2);
    expect(addHistoryMock).toHaveBeenCalledWith(history[0]);
    expect(addHistoryMock).toHaveBeenCalledWith(history[1]);
    expect(result).toEqual(bundle);
  });

  it("clears the current-tournament key when the export has none, without touching history import", async () => {
    localStorage.setItem(CURRENT_KEY, JSON.stringify({ stale: true }));
    const bundle = { app: "garden-cup", current: null, history: [] };

    await importData(makeFile(JSON.stringify(bundle)));

    expect(localStorage.getItem(CURRENT_KEY)).toBeNull();
    expect(addHistoryMock).not.toHaveBeenCalled();
  });

  it("accepts a bundle with only a history array (no current key at all)", async () => {
    const bundle = { history: [{ id: "h1" }] };
    await importData(makeFile(JSON.stringify(bundle)));
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY))).toEqual([{ id: "h1" }]);
  });
});
