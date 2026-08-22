/* ---------- saved-state migration ----------
 * v1 kept mode-specific settings (legCount, kingTarget) and the king queue
 * flat at the top level. v2 groups pre-generation settings into `config` and
 * runtime mode data into `modeState`, so a new mode never has to add another
 * top-level field. Run this on every load — people have in-progress
 * tournaments saved from v1 and it must not lose them.
 */
export function migrateState(raw) {
  if (!raw) return null;
  if (raw.schemaVersion === 2) return raw;

  const { legCount, kingTarget, kingQueue, ...rest } = raw;
  return {
    ...rest,
    config: { legCount: legCount ?? 3, kingTarget: kingTarget ?? 3 },
    modeState: raw.mode === "king" ? { queue: kingQueue || [] } : {},
    schemaVersion: 2,
  };
}
