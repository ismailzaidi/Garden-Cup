/* ---------- cloud reconciliation ----------
 * Once signed in (on every page load, not just the first), compare what the
 * server has for this account against this browser's localStorage. The one
 * rule: nothing the server holds may silently replace work it hasn't seen.
 *   - local has unsynced changes (the persisted dirty flag) -> push local
 *     first. The push carries the version the local copy was based on, so
 *     if another device moved the server on, it 409s and the sync engine
 *     keeps a "restore my version" backup instead of overwriting.
 *   - otherwise the server's current tournament is the source of truth;
 *     adopt it into the cache and the running UI.
 *   - the server has no current tournament -> the local one is never
 *     deleted. Unsynced, it is pushed; otherwise it is "existing device
 *     data", and we ask before importing (never silently).
 *   - history is a union by record id, not a replacement: a record this
 *     device finished offline survives the reload, and so does one another
 *     device added. Writes still queued in the outbox are applied on top.
 */
import { useEffect, useRef, useState } from "react";
import { storage } from "./storage.js";
import {
  fetchCurrent, fetchHistory, addHistory, setCurrent, adoptServerVersion, applyPendingToHistory,
  isDirty, resumePending, REMOTE_UPDATE_EVENT,
} from "./syncEngine.js";

const CURRENT_KEY = "gardenCup:current";
const HISTORY_KEY = "gardenCup:history";
// Namespaced per user, not a single device-wide flag: on a shared device
// where A signs out and B signs in, a device-wide flag would either offer B
// a stale "import A's data?" prompt, or (once dismissed once) silently
// never offer it again to a legitimate new local user of the same device.
const promptedKey = (userId) => `gardenCup:importPrompted:${userId}`;

function readLocalHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/* Union by record id, newest first. A record on both sides keeps the server's copy. */
export function mergeHistory(serverList, localList) {
  const byId = new Map();
  localList.forEach((h) => { if (h && h.id) byId.set(h.id, h); });
  serverList.forEach((h) => { if (h && h.id) byId.set(h.id, h); });
  return [...byId.values()].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export function useCloudReconciliation(mode, user) {
  const [importPrompt, setImportPrompt] = useState(false);
  const ranForUser = useRef(null);

  useEffect(() => {
    if (mode !== "cloud" || !user || ranForUser.current === user.id) return;
    ranForUser.current = user.id;

    (async () => {
      let serverCurrent;
      let serverVersion;
      let serverHistory;
      try {
        [{ state: serverCurrent, version: serverVersion }, { history: serverHistory }] = await Promise.all([fetchCurrent(), fetchHistory()]);
      } catch {
        resumePending(); // offline at load — the retry path picks up whatever is still queued
        return;
      }

      const localCurrentRaw = localStorage.getItem(CURRENT_KEY);
      const dirty = isDirty();
      const mergedHistory = mergeHistory(applyPendingToHistory(serverHistory), readLocalHistory());
      const historyChanged = JSON.stringify(mergedHistory) !== JSON.stringify(readLocalHistory());
      if (historyChanged) localStorage.setItem(HISTORY_KEY, JSON.stringify(mergedHistory));

      if (localCurrentRaw && dirty) {
        // Local first. The version is deliberately NOT adopted from the
        // server here — it stays the one this copy was based on, so a
        // moved-on server is caught as a conflict rather than overwritten.
        window.dispatchEvent(new CustomEvent(REMOTE_UPDATE_EVENT, { detail: { history: mergedHistory } }));
        setCurrent();
        resumePending();
        return;
      }

      if (serverCurrent) {
        adoptServerVersion(serverVersion);
        localStorage.setItem(CURRENT_KEY, JSON.stringify(serverCurrent));
        window.dispatchEvent(new CustomEvent(REMOTE_UPDATE_EVENT, { detail: { current: serverCurrent, history: mergedHistory } }));
        resumePending();
        return;
      }

      // No current tournament on the server: never touch the local one.
      adoptServerVersion(0);
      if (historyChanged) window.dispatchEvent(new CustomEvent(REMOTE_UPDATE_EVENT, { detail: { history: mergedHistory } }));
      resumePending();

      const localHasData = Boolean(localCurrentRaw) || readLocalHistory().length > 0;
      const alreadyPrompted = localStorage.getItem(promptedKey(user.id)) === "1";
      const serverHasData = serverHistory.length > 0;
      // With server history already present, only an in-progress local
      // tournament is worth asking about; local history was just merged in.
      if ((serverHasData ? Boolean(localCurrentRaw) : localHasData) && !alreadyPrompted) setImportPrompt(true);
    })();
  }, [mode, user]);

  const confirmImport = async () => {
    setImportPrompt(false);
    localStorage.setItem(promptedKey(user.id), "1");
    const currentRaw = localStorage.getItem(CURRENT_KEY);
    const historyRaw = localStorage.getItem(HISTORY_KEY);
    if (currentRaw) await storage.set(CURRENT_KEY, currentRaw); // re-fires the normal sync push
    if (historyRaw) {
      const list = JSON.parse(historyRaw);
      list.forEach((record) => addHistory(record));
    }
  };

  const dismissImport = () => {
    setImportPrompt(false);
    localStorage.setItem(promptedKey(user.id), "1");
  };

  return { importPrompt, confirmImport, dismissImport };
}
