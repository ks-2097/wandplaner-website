#!/usr/bin/env bash
# Runs on the server. GitHub Actions starts it over SSH after tests pass on main.
# The deploy key is restricted to this script (see "Automatic deployment" in README.md).
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/wandplaner-website}"
BRANCH="${DEPLOY_BRANCH:-main}"
URL="${SITE_CHECK_URL:-https://plana-planer.de}"

cd "$REPO_DIR"
previous="$(git rev-parse HEAD)"

echo "==> Fetching $BRANCH"
git fetch --quiet origin "$BRANCH"
git checkout --quiet -B "$BRANCH" "origin/$BRANCH"
current="$(git rev-parse HEAD)"
echo "==> $previous -> $current"

echo "==> Building and starting"
docker compose up -d --build

# The shop must answer before we call it done. If not, go back to the version that worked.
healthy() {
  for _ in $(seq 1 12); do
    if curl -fsS -o /dev/null --max-time 10 "$URL"; then return 0; fi
    sleep 5
  done
  return 1
}

if healthy; then
  echo "==> Live at $URL (commit ${current:0:7})"
  docker image prune -f >/dev/null
  exit 0
fi

echo "!! $URL did not answer after the update; rolling back to ${previous:0:7}" >&2
git checkout --quiet -B "$BRANCH" "$previous"
docker compose up -d --build
healthy && echo "==> Rolled back; the old version is live again" >&2
exit 1
