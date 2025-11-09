#!/usr/bin/env bash
set -euo pipefail

# This script (re)applies setup.sql against the running Postgres container.
# It uses psql inside the container, so you don't need psql installed locally.

SERVICE_NAME="postgres"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-study_platform}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Ensuring Postgres container is up..."
docker compose up -d "${SERVICE_NAME}" >/dev/null

echo "Waiting for Postgres to become ready..."
until docker compose exec -T "${SERVICE_NAME}" pg_isready -U "${DB_USER}" >/dev/null 2>&1; do
  sleep 1
done

echo "Applying setup.sql to database '${DB_NAME}'..."
docker compose exec -T "${SERVICE_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f - < "${REPO_ROOT}/setup.sql"

echo "setup.sql applied successfully."


