/* ---------- persistent storage ----------
 * localStorage is always the write-through cache — every write lands here
 * synchronously first, so the app works with zero network (the actual use
 * case: a phone in a garden with poor signal) and works identically whether
 * or not a backend is configured at all (the DB is optional; see
 * src/lib/syncEngine.js).
 *
 * When a backend *is* configured and the user is signed in, `set`/`delete`
 * on the current-tournament key also fire a background sync via syncEngine.
 * History is intentionally NOT special-cased here — its finer-grained sync
 * (append/delete-by-id rather than whole-array replace) is called directly
 * from the three history call sites in src/engine/useTournament.js.
 */
import { setCurrent as syncSetCurrent, deleteCurrent as syncDeleteCurrent } from "./syncEngine.js";

const CURRENT_KEY = "gardenCup:current";

export const storage = {
  get: async (key) => {
    const v = localStorage.getItem(key);
    return v === null ? null : { key, value: v };
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    if (key === CURRENT_KEY) syncSetCurrent();
    return { key, value };
  },
  delete: async (key) => {
    localStorage.removeItem(key);
    if (key === CURRENT_KEY) syncDeleteCurrent();
    return { key, deleted: true };
  },
};
