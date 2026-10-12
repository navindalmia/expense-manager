#!/bin/bash
# Shared Render deploy verification for CI (staging + production).
#   render-deploy-verify.sh deploy <service-id>   trigger a deploy, wait until it is live
#   render-deploy-verify.sh smoke  <api-url>      poll the host root health route
# Env: RENDER_API_KEY (deploy). Optional: SLEEP_SECONDS (15), MAX_ATTEMPTS (80, deploy),
# SMOKE_ATTEMPTS (10). An empty api-url makes `smoke` skip with a warning (exit 0).
set -euo pipefail

SLEEP_SECONDS="${SLEEP_SECONDS:-15}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-80}"
SMOKE_ATTEMPTS="${SMOKE_ATTEMPTS:-10}"

deploy() {
  local api="https://api.render.com/v1/services/${1}/deploys" id status i
  id="$(curl -fsS -X POST -H "Authorization: Bearer ${RENDER_API_KEY}" \
    -H "Content-Type: application/json" -d '{"clearCache":"do_not_clear"}' "$api" | jq -r '.id')"
  if [ -z "$id" ] || [ "$id" = "null" ]; then
    echo "::error::Render did not return a deploy id"; exit 1
  fi
  echo "Deploy id: $id"
  for i in $(seq 1 "$MAX_ATTEMPTS"); do
    status="$(curl -fsS -H "Authorization: Bearer ${RENDER_API_KEY}" "$api/$id" | jq -r '.status')"
    echo "Attempt $i: $status"
    case "$status" in
      live) return 0 ;;
      build_failed|update_failed|pre_deploy_failed|canceled|deactivated)
        echo "::error::Deploy ended with status $status"; exit 1 ;;
    esac
    [ "$i" -lt "$MAX_ATTEMPTS" ] && sleep "$SLEEP_SECONDS"
  done
  echo "::error::Timed out waiting for deploy"; exit 1
}

smoke() {
  local url="${1:-}" root body i
  if [ -z "$url" ]; then
    echo "::warning::API URL variable is not set - skipping post-deploy health check"; return 0
  fi
  # The URL ends in /api; /api/internal/* is not mounted in production, so use the root route.
  root="$(node "$(dirname "$0")/staging-health-url.js" "$url")"
  for i in $(seq 1 "$SMOKE_ATTEMPTS"); do
    body="$(curl -fsS --max-time 30 "$root" || true)"
    if printf '%s' "$body" | grep -q "Expense Manager API running"; then
      echo "Healthy: $root"; return 0
    fi
    echo "Attempt $i: not healthy yet"; sleep "$SLEEP_SECONDS"
  done
  echo "::error::Health check failed after deploy went live"; exit 1
}

case "${1:-}" in
  deploy) deploy "${2:?service id required}" ;;
  smoke) smoke "${2:-}" ;;
  *) echo "usage: $0 deploy <service-id> | smoke <api-url>" >&2; exit 2 ;;
esac
