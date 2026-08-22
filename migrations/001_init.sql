-- Garden Cup — initial schema.
-- Safe to run more than once: every CREATE TABLE is IF NOT EXISTS, and the
-- schema_migrations bookkeeping row at the bottom uses INSERT IGNORE. If you
-- ever need to change a table that already exists in production, that's a
-- *new* numbered migration file, not an edit to this one.
--
-- Apply by hand for now (phpMyAdmin, the IONOS/host DB console, or any
-- MariaDB client) — see migrations/README.md.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(20) NOT NULL PRIMARY KEY,
  applied_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id             CHAR(26)     NOT NULL PRIMARY KEY,
  email          VARCHAR(190) NOT NULL,          -- store lower-cased
  password_hash  VARCHAR(255) NOT NULL,
  display_name   VARCHAR(60)  NOT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at  DATETIME     NULL,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash   CHAR(64)     NOT NULL PRIMARY KEY,  -- sha256 hex of the bearer token
  user_id      CHAR(26)     NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME     NULL,
  expires_at   DATETIME     NOT NULL,
  user_agent   VARCHAR(255) NULL,
  KEY idx_tokens_user (user_id),
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(190)  NOT NULL,
  ip           VARBINARY(16) NULL,
  succeeded    TINYINT(1)    NOT NULL DEFAULT 0,
  attempted_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attempts_email_time (email, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tournaments (
  id            CHAR(26)    NOT NULL PRIMARY KEY,
  user_id       CHAR(26)    NOT NULL,
  client_id     VARCHAR(24) NOT NULL,      -- the app's tournamentId
  mode          VARCHAR(24) NOT NULL,      -- validated in api/_lib/modes.js, not an ENUM
  config_json   LONGTEXT    NOT NULL DEFAULT '{}'
                CHECK (JSON_VALID(config_json)),
  history_saved TINYINT(1)  NOT NULL DEFAULT 0,
  status        ENUM('active','archived') NOT NULL DEFAULT 'active',
  version       INT UNSIGNED NOT NULL DEFAULT 1,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tournaments_user_client (user_id, client_id),
  KEY idx_tournaments_user_status (user_id, status),
  CONSTRAINT fk_tournaments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS players (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tournament_id CHAR(26)    NOT NULL,
  client_id     VARCHAR(24) NOT NULL,
  name          VARCHAR(24) NOT NULL,      -- matches the 24-char cap in useTournament.js's addPlayer
  sort_order    SMALLINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_players (tournament_id, client_id),
  CONSTRAINT fk_players_t FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matches (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tournament_id CHAR(26)    NOT NULL,
  client_id     VARCHAR(24) NOT NULL,
  stage         VARCHAR(24) NOT NULL,      -- validated against the mode's declared stages, not an ENUM
  leg           TINYINT UNSIGNED  NULL,    -- group / final
  `round`       SMALLINT UNSIGNED NULL,    -- knockout — backticked, collides with the SQL function name
  seq           SMALLINT UNSIGNED NULL,    -- king
  p1_client_id  VARCHAR(24) NULL,
  p2_client_id  VARCHAR(24) NULL,          -- NULL on a bye
  s1            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  s2            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  played        TINYINT(1)  NOT NULL DEFAULT 0,
  bye           TINYINT(1)  NOT NULL DEFAULT 0,
  sort_order    SMALLINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_matches (tournament_id, client_id),
  CONSTRAINT fk_matches_t FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goals (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tournament_id    CHAR(26)    NOT NULL,
  client_id        VARCHAR(24) NOT NULL,
  match_client_id  VARCHAR(24) NOT NULL,
  player_client_id VARCHAR(24) NOT NULL,
  goal_second      SMALLINT UNSIGNED NOT NULL,  -- JS field is `second`; SECOND is a SQL interval keyword
  duration         SMALLINT UNSIGNED NOT NULL,
  stage            VARCHAR(24) NOT NULL,        -- validated against the mode's declared stages, not an ENUM
  sort_order       SMALLINT UNSIGNED NOT NULL,  -- goals[] order drives undo — see api/_lib/serializer.js
  UNIQUE KEY uq_goals (tournament_id, client_id),
  KEY idx_goals_match (tournament_id, match_client_id),
  CONSTRAINT fk_goals_t FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- An ordered list of players belongs to any mode with a challenger queue,
-- not just king. queue_key lets a future mode keep more than one named
-- queue per tournament if it ever needs to; king always writes "queue"
-- (matching modeState.queue in the JS state).
CREATE TABLE IF NOT EXISTS mode_queue (
  tournament_id    CHAR(26)    NOT NULL,
  queue_key        VARCHAR(24) NOT NULL DEFAULT 'queue',
  position         SMALLINT UNSIGNED NOT NULL,
  player_client_id VARCHAR(24) NOT NULL,
  PRIMARY KEY (tournament_id, queue_key, position),
  CONSTRAINT fk_mq_t FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tournament_history (
  id               CHAR(26)    NOT NULL PRIMARY KEY,
  user_id          CHAR(26)    NOT NULL,
  client_id        VARCHAR(24) NOT NULL,   -- equals the record's tournamentId
  played_at        DATETIME    NOT NULL,
  mode             VARCHAR(24) NOT NULL,   -- validated in api/_lib/modes.js, not an ENUM
  champion         VARCHAR(24) NOT NULL,
  top_scorer_name  VARCHAR(24) NULL,
  top_scorer_goals SMALLINT UNSIGNED NULL,
  total_goals      SMALLINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_history (user_id, client_id),
  KEY idx_history_user_date (user_id, played_at),
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tournament_history_players (
  history_id CHAR(26)    NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  name       VARCHAR(24) NOT NULL,
  PRIMARY KEY (history_id, sort_order),
  CONSTRAINT fk_hp_h FOREIGN KEY (history_id) REFERENCES tournament_history(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version) VALUES ('001_init');
