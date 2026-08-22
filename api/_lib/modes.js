/* ---------- mode/stage allow-list ----------
 * The server can't import src/modes/index.js (that's client JSX), so this
 * table is a hand-kept mirror of it. Update it here whenever a mode is
 * added there — see TASK-DATABASE.md §4 point 3 for why this is a plain
 * allow-list rather than a SQL ENUM: a new mode should never need a schema
 * migration.
 */
export const MODE_STAGES = {
  league: ["group", "final"],
  knockout: ["knockout"],
  king: ["king"],
  roundrobin: ["group"],
  bestofn: ["bestofn"],
};

export function isValidMode(mode) {
  return Object.prototype.hasOwnProperty.call(MODE_STAGES, mode);
}

export function isValidStage(mode, stage) {
  return isValidMode(mode) && MODE_STAGES[mode].includes(stage);
}
