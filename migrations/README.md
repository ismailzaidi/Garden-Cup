# Migrations

Plain, idempotent `.sql` files — no ORM, no migration runner. Apply each one
by hand, in order, against the MariaDB database, using whatever client you
have (phpMyAdmin, the host's DB console, `mysql`/`mariadb` CLI). Every file
is safe to re-run: tables are `CREATE TABLE IF NOT EXISTS`, and the
`schema_migrations` bookkeeping row uses `INSERT IGNORE`, so running the same
file twice is a no-op rather than an error.

## Applying a migration

```bash
mysql --host=<DB_HOST> --port=<DB_PORT> --user=<DB_USER> -p <DB_NAME> < migrations/001_init.sql
```

or paste the file's contents into phpMyAdmin's SQL tab.

Then confirm it recorded itself:

```sql
SELECT * FROM schema_migrations ORDER BY version;
```

## Adding a new migration

If a table that already exists in production needs to change, write a new
file — `002_whatever.sql` — rather than editing `001_init.sql`. Keep it
idempotent (`ADD COLUMN IF NOT EXISTS` where the MariaDB version supports it,
or a guarded `ALTER TABLE` otherwise), and end it with:

```sql
INSERT IGNORE INTO schema_migrations (version) VALUES ('002_whatever');
```

so the ledger stays accurate.

## Files

| File | What it does |
|---|---|
| `001_init.sql` | Full initial schema: users, sessions, tournaments, players, matches, goals, mode_queue, tournament_history. The reasoning behind the shape lives inline — the `not an ENUM` comments on every `mode`/`stage` column, and `api/_lib/id.js` for why primary keys are opaque 26-character strings rather than auto-increment integers. |
| `002_history_results.sql` | Adds nullable `played`/`w`/`d`/`l`/`gf`/`ga` columns to `tournament_history_players`, so the Wins tab can total match wins, not just titles, for tournaments finished after this migration. |
