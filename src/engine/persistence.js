/* ---------- saved-state migration ----------
 * v1 kept mode-specific settings (legCount, kingTarget) and the king queue
 * flat at the top level. v2 groups pre-generation settings into `config` and
 * runtime mode data into `modeState`, so a new mode never has to add another
 * top-level field. Run this on every load — people have in-progress
 * tournaments saved from v1 and it must not lose them.
 */
/* A saved tournament whose mode has since been retired (RETIRED_MODES in
   modes/index.js). A Pure League is exactly a League with no final — same
   stage, same table — so it carries on as one. The other two have no
   equivalent: the roster and the stakes are kept, the fixtures are not.
   `knownModes` is passed in rather than imported, so this module stays free
   of the mode registry (and of JSX). */
export function retireMode(state, knownModes) {
  if (!state || knownModes.includes(state.mode)) return state;
  if (state.mode === "roundrobin") {
    return { ...state, mode: "league", config: { ...(state.config || {}), finalLegs: 0 } };
  }
  return { ...state, mode: "league", matches: [], goals: [], modeState: {}, historySaved: false };
}

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
