#!/usr/bin/env bash
# Only talks to a fresh container, with no network or published ports.
set -euo pipefail

cd "$(dirname "$0")/.."

docker info >/dev/null
docker_endpoint="${DOCKER_HOST:-$(docker context inspect --format '{{ .Endpoints.docker.Host }}')}"
case "$docker_endpoint" in unix://*|npipe://*) ;; *) echo "A local Docker engine is required." >&2; exit 1 ;; esac
test_container="sportmatch-db-test-$$-$RANDOM"
cleanup() {
  result=$?
  trap - EXIT
  if [[ $result -ne 0 ]]; then docker logs --tail 50 "$test_container" 2>/dev/null || true; fi
  docker rm --force --volumes "$test_container" >/dev/null 2>&1 || result=1
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker run --detach --name "$test_container" --network none \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17.6 >/dev/null

ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$test_container" pg_isready --host 127.0.0.1 --username postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then echo "Test PostgreSQL did not become ready." >&2; exit 1; fi
docker exec "$test_container" createdb --username postgres sportmatch_test

for file in supabase/tests/local_stub.sql supabase/migrations/*.sql supabase/seed.sql; do
  echo "== $file"
  docker exec -i "$test_container" psql -X -q -v ON_ERROR_STOP=1 \
    --username postgres --dbname sportmatch_test < "$file"
done

mkdir -p test-results
docker exec -i "$test_container" psql -X -q -v ON_ERROR_STOP=1 \
  --username postgres --dbname sportmatch_test < supabase/tests/smoke_test.sql \
  | tee test-results/db-smoke.log
grep -q 'ALLE SMOKETESTS GESLAAGD' test-results/db-smoke.log
