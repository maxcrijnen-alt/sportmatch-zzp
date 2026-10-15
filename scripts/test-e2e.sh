#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker info >/dev/null
docker_endpoint="${DOCKER_HOST:-$(docker context inspect --format '{{ .Endpoints.docker.Host }}')}"
case "$docker_endpoint" in unix://*|npipe://*) ;; *) echo "A local Docker engine is required." >&2; exit 1 ;; esac
supabase --version
test_workdir="$(mktemp -d "${TMPDIR:-/tmp}/sportmatch-e2e.XXXXXXXX")"
cleanup() {
  result=$?
  trap - EXIT
  if supabase stop --no-backup --workdir "$test_workdir"; then
    rm -rf -- "$test_workdir"
    if [[ -n "${SPORTMATCH_E2E_STATE_FILE:-}" ]]; then rm -f -- "$SPORTMATCH_E2E_STATE_FILE"; fi
  else
    result=1
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [[ -n "${SPORTMATCH_E2E_STATE_FILE:-}" ]]; then
  printf '%s\n' "$test_workdir" > "$SPORTMATCH_E2E_STATE_FILE"
fi

mkdir -p "$test_workdir/supabase"
cp supabase/config.toml supabase/seed.sql "$test_workdir/supabase/"
cp -R supabase/migrations "$test_workdir/supabase/"
sed -i "s/^project_id = .*/project_id = \"sportmatch-ci-$$-$RANDOM\"/" "$test_workdir/supabase/config.toml"

# Never link a remote project or load the application's .env files here.
# CLI startup output contains local keys, so keep it out of logs/artifacts.
echo "Starting isolated local Supabase (migrations and seed)..."
if ! timeout 10m supabase start --workdir "$test_workdir" \
  --exclude studio,imgproxy,edge-runtime,logflare,vector,supavisor \
  > "$test_workdir/start.log" 2>&1; then
  sed -E 's/eyJ[A-Za-z0-9_.-]+/[REDACTED JWT]/g; s/sb_(secret|publishable)_[A-Za-z0-9_-]+/[REDACTED KEY]/g' \
    "$test_workdir/start.log" >&2
  exit 1
fi
supabase status --workdir "$test_workdir" --output json > "$test_workdir/status.json"
node scripts/run-regression.mjs "$test_workdir/status.json"
