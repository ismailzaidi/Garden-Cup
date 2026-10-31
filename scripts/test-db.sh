#!/usr/bin/env bash
# Applies supabase/migrations/ to a throwaway database and runs the access-rule
# tests in supabase/tests/rls.sql. Needs a Postgres you can create databases
# on; point DATABASE_URL at its maintenance database (default: local socket).
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."

ADMIN_URL="${DATABASE_URL:-postgres:///postgres}"
DB="garden_cup_test_$$"
psql_admin() { psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q "$@"; }

psql_admin -c "create database $DB"
trap 'psql_admin -c "drop database if exists $DB" >/dev/null' EXIT

# same server, different database name
TEST_URL="$(node -e 'const u=new URL(process.argv[1]); u.pathname="/"+process.argv[2]; console.log(u.toString())' "$ADMIN_URL" "$DB")"
run() { psql "$TEST_URL" -v ON_ERROR_STOP=1 -q "$@"; }

run -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do run -f "$f"; done
run -f supabase/tests/rls.sql
