#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <app-path> [health-path]" >&2
  echo "Example: $0 apps/api-prisma-postgresql /health" >&2
  exit 2
fi

APP_PATH="$1"
HEALTH_PATH="${2:-/health}"
COMPOSE_FILE="$APP_PATH/docker-compose.yml"
ENV_TEMPLATE="$APP_PATH/.env.example"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [ ! -f "$ENV_TEMPLATE" ]; then
  echo "Missing env template: $ENV_TEMPLATE" >&2
  exit 1
fi

TMP_ENV="$(mktemp /tmp/trinacria-docker-smoke.XXXXXX.env)"
cp "$ENV_TEMPLATE" "$TMP_ENV"

PROJECT_NAME="$(basename "$APP_PATH")-smoke-${RANDOM}"

read_env_value() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$TMP_ENV" | tail -n 1 | cut -d '=' -f 2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

API_PORT="$(read_env_value DOCKER_API_PORT)"
if [ -z "$API_PORT" ]; then
  echo "DOCKER_API_PORT is missing in $ENV_TEMPLATE" >&2
  exit 1
fi

compose() {
  docker compose \
    --project-name "$PROJECT_NAME" \
    --env-file "$TMP_ENV" \
    -f "$COMPOSE_FILE" \
    "$@"
}

cleanup() {
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$TMP_ENV"
}
trap cleanup EXIT

echo "[docker-smoke] starting $APP_PATH"
compose up --build -d

HEALTH_URL="http://127.0.0.1:${API_PORT}${HEALTH_PATH}"
MAX_ATTEMPTS=60
SLEEP_SECONDS=2

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[docker-smoke] health check passed: $HEALTH_URL"
    compose ps
    echo "[docker-smoke] success"
    exit 0
  fi

  EXITED="$(compose ps --status exited -q || true)"
  if [ -n "$EXITED" ]; then
    echo "[docker-smoke] container exited before health check" >&2
    compose ps >&2 || true
    compose logs >&2 || true
    exit 1
  fi

  sleep "$SLEEP_SECONDS"
done

echo "[docker-smoke] timeout waiting for $HEALTH_URL" >&2
compose ps >&2 || true
compose logs >&2 || true
exit 1
