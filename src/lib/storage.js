/* ---------- persistent storage ----------
 * localStorage today; TASK-DATABASE.md replaces this with an authenticated
 * API client behind the same get/set/delete interface. The rest of the app
 * talks to this object only — swap the implementation, not the call sites.
 */
export const storage = {
  get: async (key) => {
    const v = localStorage.getItem(key);
    return v === null ? null : { key, value: v };
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return { key, value };
  },
  delete: async (key) => {
    localStorage.removeItem(key);
    return { key, deleted: true };
  },
};
