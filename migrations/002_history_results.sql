-- Adds per-player match results to tournament_history_players, so the
-- Wins tab can show match wins (not just titles) once a tournament finishes
-- after this migration. NULL means "recorded before results were kept" —
-- distinct from 0, which is a real result. See docs/FEATURE-PLAN-2.md §3.
--
-- Safe to run more than once (IF NOT EXISTS on every column, INSERT IGNORE
-- on the bookkeeping row) — see migrations/README.md.
--
-- Apply this before deploying the API change: the updated POST handler
-- names these columns and will fail against the old table.

ALTER TABLE tournament_history_players
  ADD COLUMN IF NOT EXISTS played SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS w      SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS d      SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS l      SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS gf     SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS ga     SMALLINT UNSIGNED NULL;

INSERT IGNORE INTO schema_migrations (version) VALUES ('002_history_results');
