-- Stops the cloud copy dropping data the app already keeps locally. Until
-- now the server stored only the columns of 001_init.sql, so a tournament
-- pulled back down lost: a team's members, the champion's prize and last
-- place's forfeit, every card badge and docked point (c1/c2/r1/r2/d1/d2),
-- the dealt twist and its tier, a World Cup match's group and third-place
-- flag, survivor's alive/eliminated lists, the World Cup group draw — and a
-- finished tournament's history record lost its teams, prize, chore and
-- last place the same way.
--
-- All new columns are nullable JSON/TEXT (or a short string): NULL means
-- "none of these were set", which is exactly how a row written before this
-- migration reads back. api/_lib/serializer.js validates and size-limits
-- every value before it gets here.
--
-- Safe to run more than once (IF NOT EXISTS on every column, INSERT IGNORE
-- on the bookkeeping row) — see migrations/README.md.
--
-- Apply this before deploying the API change: the updated handlers name
-- these columns and will fail against the old tables.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS members_json JSON NULL;            -- ["Sam","Ali"], teams only

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS extra_json JSON NULL;              -- twist, tier, group, thirdPlace, c1..d2

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS stakes_json JSON NULL,             -- {"prize":"...","chore":"..."}
  ADD COLUMN IF NOT EXISTS mode_state_json JSON NULL;         -- modeState minus `queue` (that has mode_queue)

ALTER TABLE tournament_history
  ADD COLUMN IF NOT EXISTS teams_json      JSON NULL,         -- {"Tigers":["Sam","Ali"]}
  ADD COLUMN IF NOT EXISTS prize           VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS chore           VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS last_place_json JSON NULL;         -- ["Dave"]

INSERT IGNORE INTO schema_migrations (version) VALUES ('003_lossless_state');
