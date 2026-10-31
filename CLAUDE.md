# Garden Cup: notes for Claude

The owner usually works from the Claude mobile app, so finish each change as
a pushed branch (and a pull request when asked) that they can merge from
the GitHub app. Never ask them to paste SQL or edit settings by hand when a
file in the repo can do it.

## Checks before every push
`npm run lint`, `npm test`, `npm run build`, and for anything under
`supabase/`: `npm run test:db` (needs Postgres; in a cloud session start it
with `pg_ctlcluster 16 main start` and use
`DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres`, after
setting that password once with
`su postgres -c "psql -c \"alter user postgres password 'postgres'\""`).

## Database changes
- A schema change is a **new** file: `supabase/migrations/<UTC yyyymmddhhmmss>_<what>.sql`.
  Never edit or rename one that is on `main`; it has been deployed.
- Merging to `main` deploys it (`.github/workflows/deploy-db.yml`). See
  DEPLOYMENT.md, "Deploying database changes".
- Every table: row-level security on, owner-only policies, `anon` revoked.
  Add checks for new tables or rules to `supabase/tests/rls.sql`.
- Additive first: the app and the migration deploy at the same time, so a
  release must work against both the old and the new schema.
- The browser never talks to Supabase; `api/` does, as the signed-in user
  (`api/_lib/supabase.js`). Don't introduce the service-role key without a
  clear need.

## Game content
Rules, prizes and forfeits are judged against `docs/MODE-AUDIT.md`. Never
rename or delete a rule key; retire it (see the top of
`src/engine/twists.js` and `src/engine/horror.js`).
