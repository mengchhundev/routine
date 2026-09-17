#!/usr/bin/env bash
# Runs on the VM, from /opt/routine. Pulls the images named by IMAGE_TAG in .env
# and brings the stack up, failing if any service does not become healthy.
#
# Called by .github/workflows/deploy.yml, but safe to run by hand:
#   bash /opt/routine/deploy.sh

set -euo pipefail
cd "$(dirname "$0")"

compose() {
  docker compose -f docker-compose.prod.yml "$@"
}

echo "==> Pulling images"
compose pull --quiet

echo "==> Starting stack"
# --wait blocks until every service with a healthcheck reports healthy, so a
# broken release fails the workflow instead of being reported as deployed.
if ! compose up -d --remove-orphans --wait --wait-timeout 300; then
  echo "==> Stack did not become healthy. Recent logs:" >&2
  compose ps >&2
  compose logs --tail 80 api web caddy >&2
  exit 1
fi

echo "==> Removing unused images"
docker image prune -f >/dev/null

compose ps
echo "==> Deployed $(grep '^IMAGE_TAG=' .env | cut -d= -f2- | tr -d "'")"
