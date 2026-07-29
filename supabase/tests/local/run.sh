#!/usr/bin/env bash
#
# Local migration behaviour harness.
#
# Spins up a throwaway PostgreSQL cluster, applies every migration in order against
# a minimal Supabase-equivalent shim, seeds fixtures, runs the assertion matrix, and
# destroys the cluster. Nothing here touches a hosted Supabase project, and no
# credentials are read or required.
#
# WHAT THIS PROVES
#   Migration SQL applies cleanly and in order; triggers, constraints, derived
#   values and RLS policies behave as intended for a given request role and JWT
#   subject; migrations are re-runnable where they claim to be.
#
# WHAT THIS DOES NOT PROVE  -- read this before quoting a green run
#   It does NOT replace the signed-in Supabase authorization matrix in
#   ../rls.test.mjs. It fakes the auth layer: `auth.uid()` and `auth.jwt()` come
#   from a shim, roles are set with SET LOCAL ROLE, and no real JWT is ever
#   verified. It exercises no PostgREST behaviour, no Supabase Auth, no session
#   cookie handling, and no grants that the Supabase platform applies outside our
#   migrations. A green run here plus a green `npm test` in a bare checkout still
#   means authorization has never been verified end to end.
#
# USAGE
#   supabase/tests/local/run.sh
#
# Requires a local PostgreSQL 16 installation (initdb, pg_ctl, psql on PATH, or a
# Homebrew postgresql@16). Uses port 55432 and a temporary directory; both are
# removed on exit.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
MIGRATIONS="$REPO/supabase/migrations"

for candidate in /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin; do
  [ -d "$candidate" ] && PATH="$candidate:$PATH"
done
export PATH

command -v initdb >/dev/null || { echo "initdb not found. Install PostgreSQL 16."; exit 1; }

PORT=55432
WORKDIR="$(mktemp -d)"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=supra

cleanup() {
  pg_ctl -D "$WORKDIR/pgdata" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "[local-harness] starting throwaway cluster in $WORKDIR"
initdb -D "$WORKDIR/pgdata" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORKDIR/pgdata" \
  -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" \
  -l "$WORKDIR/pg.log" start >/dev/null
for _ in $(seq 1 30); do psql -d postgres -c 'select 1' >/dev/null 2>&1 && break; done

psql -d postgres -q -c "create database supra;"
psql -q -c "create extension if not exists pgcrypto;"

echo "[local-harness] applying Supabase shim"
psql -q -v ON_ERROR_STOP=1 -f "$HERE/shim.sql"

echo "[local-harness] applying migrations in order"
for migration in "$MIGRATIONS"/*.sql; do
  echo "  - $(basename "$migration")"
  psql -q -v ON_ERROR_STOP=1 -f "$migration" 2>&1 \
    | grep -vE 'NOTICE:  (trigger|policy) .* does not exist, skipping' \
    | grep -vE 'NOTICE:  extension "pgcrypto" already exists' || true
done

# The Supabase platform grants service_role access to public tables; our migrations
# deliberately do not. Reproduce that platform default so the trusted-backend path
# is exercised the way it behaves in a real project.
psql -q -c "grant all on all tables in schema public to service_role;"

echo "[local-harness] verifying re-runnability of the idempotent migrations"
for migration in "$MIGRATIONS"/202607280002_*.sql "$MIGRATIONS"/202607290003_*.sql; do
  psql -q -v ON_ERROR_STOP=1 -f "$migration" >/dev/null 2>&1 \
    || { echo "  FAILED: $(basename "$migration") is not re-runnable"; exit 1; }
done
echo "  ok: 202607280002 and 202607290003 re-apply cleanly"

echo "[local-harness] seeding fixtures"
psql -q -v ON_ERROR_STOP=1 -f "$HERE/seed.sql"

echo "[local-harness] running assertions"
bash "$HERE/assertions.sh"
