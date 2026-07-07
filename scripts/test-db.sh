#!/usr/bin/env bash
# Valideert de migrations en kernflows tegen een lokale Postgres (zonder Supabase).
# Vereist: lokale PostgreSQL en sudo-toegang tot de postgres-gebruiker.
set -euo pipefail

cd "$(dirname "$0")/.."

sudo -u postgres psql -q <<'EOF'
drop database if exists sportmatch_test;
drop role if exists anon;
drop role if exists authenticated;
drop role if exists service_role;
create database sportmatch_test;
EOF

for f in \
  supabase/tests/local_stub.sql \
  supabase/migrations/0001_schema.sql \
  supabase/migrations/0002_rls.sql \
  supabase/migrations/0003_functions.sql \
  supabase/seed.sql
do
  echo "== $f"
  cat "$f" | sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d sportmatch_test
done

echo "== smoke test"
cat supabase/tests/smoke_test.sql | sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d sportmatch_test \
  | grep -E "GESLAAGD" && echo "OK"
