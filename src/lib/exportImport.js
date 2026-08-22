/* ---------- manual export / import ----------
 * The fallback for anyone without a configured backend: a JSON file they can
 * save and later re-import, on this device or another one. Works the same
 * whether or not a backend is configured — when one is, importing also
 * pushes the restored data up through the normal write-through path in
 * src/lib/storage.js.
 */
import { storage } from "./storage.js";
import { addHistory } from "./syncEngine.js";

const CURRENT_KEY = "gardenCup:current";
const HISTORY_KEY = "gardenCup:history";

export function exportData() {
  const current = localStorage.getItem(CURRENT_KEY);
  const history = localStorage.getItem(HISTORY_KEY);

  const bundle = {
    app: "garden-cup",
    exportedAt: new Date().toISOString(),
    current: current ? JSON.parse(current) : null,
    history: history ? JSON.parse(history) : [],
  };

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gardencup-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importData(file) {
  const text = await file.text();
  let bundle;
  try {
    bundle = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!bundle || typeof bundle !== "object" || (!("current" in bundle) && !("history" in bundle))) {
    throw new Error("That file doesn't look like a Garden Cup export.");
  }

  if (bundle.current) {
    await storage.set(CURRENT_KEY, JSON.stringify(bundle.current));
  } else {
    await storage.delete(CURRENT_KEY);
  }
  const history = bundle.history || [];
  await storage.set(HISTORY_KEY, JSON.stringify(history));
  // storage.set only forwards the current-tournament key to the sync engine
  // (history syncs through these finer-grained calls instead — see
  // src/engine/useTournament.js) — so importing history needs its own push,
  // same as a normal history-save does. Safe to call unconditionally: a
  // no-op in local-only mode or when signed out.
  history.forEach((record) => addHistory(record));

  return bundle;
}
