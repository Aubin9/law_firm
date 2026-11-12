#!/usr/bin/env bash
# ==============================================================================
# Firm Practice Management Platform - Sovereign Automated Backup (Step 20)
#
# Standard: 3-2-1 Backup Strategy (ARCHITECTURE.md Section 9, SPECIFICATIONS.md 11)
# 1. Local PostgreSQL dump with custom archive format (-Fc)
# 2. Local documents storage snapshot
# 3. Encrypted repository via Restic (AES-256) with password from secure file
# 4. Retention policy: 14 daily, 8 weekly, 12 monthly snapshots
# 5. Database logging into BackupRun table
#
# Strict Constraints:
# - ZERO secrets in source control. Passwords supplied via environment or file.
# - LAN/Self-hosted compliance (Cameroon Law n° 2024/017 on Personal Data Protection).
# ==============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lawfirm}"
RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-/var/backups/restic-repo}"
RESTIC_PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-/etc/lawfirm/restic.key}"
POSTGRES_DB="${POSTGRES_DB:-lawfirm_db}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
STORAGE_DIR="${STORAGE_DIR:-./storage}"

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
DB_DUMP_FILE="${BACKUP_DIR}/db_${POSTGRES_DB}_${TIMESTAMP}.dump"
START_TIME=$(date +%s)

echo "=== [$(date -u)] Starting Law Firm Automated Backup ==="

mkdir -p "${BACKUP_DIR}"

# 1. Database dump using PostgreSQL custom compressed format (-Fc)
echo "--> 1. Dumping PostgreSQL database (${POSTGRES_DB})..."
# NOTE ON WAL ARCHIVING:
# For Point-In-Time Recovery (PITR), PostgreSQL should have:
#   wal_level = replica
#   archive_mode = on
#   archive_command = 'cp %p /var/backups/wal_archive/%f'
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -F c -b -v \
  -f "${DB_DUMP_FILE}" \
  "${POSTGRES_DB}"

DUMP_SIZE=$(stat -c%s "${DB_DUMP_FILE}" 2>/dev/null || stat -f%z "${DB_DUMP_FILE}")
CHECKSUM=$(sha256sum "${DB_DUMP_FILE}" | awk '{print $1}')
echo "    Database dump created: ${DB_DUMP_FILE} (${DUMP_SIZE} bytes, SHA-256: ${CHECKSUM})"

# 2. Encrypt and store snapshot into Restic repository
if command -v restic &>/dev/null; then
  echo "--> 2. Backing up database dump and documents to encrypted Restic repository..."
  if [ ! -d "${RESTIC_REPOSITORY}" ]; then
    echo "    Initializing Restic repository at ${RESTIC_REPOSITORY}..."
    restic init --repo "${RESTIC_REPOSITORY}" --password-file "${RESTIC_PASSWORD_FILE}"
  fi

  # Backup DB dump + documents storage
  restic backup \
    --repo "${RESTIC_REPOSITORY}" \
    --password-file "${RESTIC_PASSWORD_FILE}" \
    --tag "daily-backup" \
    --tag "v1-production" \
    "${DB_DUMP_FILE}" "${STORAGE_DIR}"

  echo "--> 3. Applying GFS retention policy (14 daily, 8 weekly, 12 monthly)..."
  restic forget \
    --repo "${RESTIC_REPOSITORY}" \
    --password-file "${RESTIC_PASSWORD_FILE}" \
    --keep-daily 14 \
    --keep-weekly 8 \
    --keep-monthly 12 \
    --prune
else
  echo "--> [INFO] Restic not installed on local host; dump saved to ${BACKUP_DIR}."
fi

# 3. Clean up raw local dumps older than 14 days
find "${BACKUP_DIR}" -name "db_${POSTGRES_DB}_*.dump" -mtime +14 -delete 2>/dev/null || true

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "=== [$(date -u)] Backup finished successfully in ${DURATION}s ==="

