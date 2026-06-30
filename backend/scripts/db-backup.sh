#!/usr/bin/env bash
# Daily PostgreSQL backup for GlucoConnect production DB.
# Usage: ./db-backup.sh [output-dir]
#   DATABASE_URL must be set in the environment (or sourced from .env).
#   If AWS_S3_BACKUP_BUCKET is set, the dump is also uploaded to S3.
# Exit codes: 0 = success, 1 = missing URL, 2 = pg_dump failure, 3 = upload failure.

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
OUTPUT_DIR="${1:-/tmp/glucoconnect-backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILENAME="glucoconnect-backup-${TIMESTAMP}.sql.gz"
FILEPATH="${OUTPUT_DIR}/${FILENAME}"

if [[ -z "${DATABASE_URL}" ]]; then
  echo "[backup] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

echo "[backup] Starting dump → ${FILEPATH}"
if ! pg_dump "${DATABASE_URL}" | gzip > "${FILEPATH}"; then
  echo "[backup] ERROR: pg_dump failed" >&2
  exit 2
fi

SIZE="$(du -sh "${FILEPATH}" | cut -f1)"
echo "[backup] Dump complete — ${SIZE} written to ${FILEPATH}"

# Optional S3 upload — skipped when the bucket env var is absent.
if [[ -n "${AWS_S3_BACKUP_BUCKET:-}" ]]; then
  S3_KEY="backups/${FILENAME}"
  echo "[backup] Uploading to s3://${AWS_S3_BACKUP_BUCKET}/${S3_KEY}"
  if ! aws s3 cp "${FILEPATH}" "s3://${AWS_S3_BACKUP_BUCKET}/${S3_KEY}" --storage-class STANDARD_IA; then
    echo "[backup] ERROR: S3 upload failed" >&2
    exit 3
  fi
  echo "[backup] Uploaded to S3 successfully"
fi

# Keep the last 7 local dumps; prune anything older.
find "${OUTPUT_DIR}" -name "glucoconnect-backup-*.sql.gz" -mtime +7 -delete

echo "[backup] Done — ${TIMESTAMP}"
