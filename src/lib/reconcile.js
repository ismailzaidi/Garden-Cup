/* ---------- first-login cloud reconciliation ----------
 * Once signed in, compare what the server has for this account against
 * what's already sitting in this browser's localStorage.
 *   - server has data  -> it's the source of truth (a previous session
 *     already synced it); adopt it into the cache and the running UI.
 *   - server is empty, local has data -> this is "existing device data";
 *     ask before importing (never silently), and never delete the local
 *     copy either way.
 *   - neither has data -> nothing to do.
 * Runs once per sign-in, not on every render.
 */
import { useEffect, useRef, useState } from "react";
import { storage } from "./storage.js";
import { fetchCurrent, fetchHistory, addHistory, REMOTE_UPDATE_EVENT } from "./syncEngine.js";

const CURRENT_KEY = "gardenCup:current";
const HISTORY_KEY = "gardenCup:history";
// Namespaced per user, not a single device-wide flag: on a shared device
// where A signs out and B signs in, a device-wide flag would either offer B
// a stale "import A's data?" prompt, or (once dismissed once) silently
// never offer it again to a legitimate new local user of the same device.
const promptedKey = (userId) => `gardenCup:importPrompted:${userId}`;

export function useCloudReconciliation(mode, user) {
  const [importPrompt, setImportPrompt] = useState(false);
  const ranForUser = useRef(null);

  useEffect(() => {
    if (mode !== "cloud" || !user || ranForUser.current === user.id) return;
    ranForUser.current = user.id;

    (async () => {
      let serverCurrent;
      let serverHistory;
      try {
        [{ state: serverCurrent }, { history: serverHistory }] = await Promise.all([fetchCurrent(), fetchHistory()]);
      } catch {
        return; // offline at login — normal sync retry path takes over once online
      }

      const serverHasData = Boolean(serverCurrent) || serverHistory.length > 0;
      if (serverHasData) {
        if (serverCurrent) localStorage.setItem(CURRENT_KEY, JSON.stringify(serverCurrent));
        else localStorage.removeItem(CURRENT_KEY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(serverHistory));
        window.dispatchEvent(new CustomEvent(REMOTE_UPDATE_EVENT, { detail: { current: serverCurrent, history: serverHistory } }));
        return;
      }

      const localCurrentRaw = localStorage.getItem(CURRENT_KEY);
      const localHistoryRaw = localStorage.getItem(HISTORY_KEY);
      const localHistory = localHistoryRaw ? JSON.parse(localHistoryRaw) : [];
      const localHasData = Boolean(localCurrentRaw) || localHistory.length > 0;
      const alreadyPrompted = localStorage.getItem(promptedKey(user.id)) === "1";

      if (localHasData && !alreadyPrompted) setImportPrompt(true);
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
