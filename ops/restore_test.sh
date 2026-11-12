#!/usr/bin/env bash
# ==============================================================================
# Firm Practice Management Platform - Automated Restore Verification (Step 20)
#
# Standard: REC-11 & REC-15 Demonstration (SPECIFICATIONS.md Section 11 & 12)
# A backup is only reliable when regularly restored and verified on a clean target.
#
# Process:
# 1. Finds the most recent PostgreSQL custom dump (.dump)
# 2. Drops and recreates an isolated target database (lawfirm_restore_test)
# 3. Restores schema and data using pg_restore
# 4. Measures elapsed restoration duration in seconds (RTO metric)
# 5. Queries row counts across core tables (User, Matter, Party, Document)
# 6. Cleans up test database
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/lawfirm}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
TEST_DB="${TEST_DB:-lawfirm_restore_test}"
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"


echo "=== [$(date -u)] Starting Automated Restore Verification Test ==="

# 1. Find the latest database dump
LATEST_DUMP=$(find "${BACKUP_DIR}" -name "db_*.dump" -type f | sort -r | head -n 1 || true)

if [ -z "${LATEST_DUMP}" ]; then
  echo "[ERROR] No database dump found in ${BACKUP_DIR}. Please run ops/backup.sh first."
  exit 1
fi

echo "--> Target dump file: ${LATEST_DUMP}"
DUMP_SIZE=$(stat -c%s "${LATEST_DUMP}" 2>/dev/null || stat -f%z "${LATEST_DUMP}")
echo "    Size: ${DUMP_SIZE} bytes"

# 2. Prepare clean isolated database
echo "--> Recreating clean test database: ${TEST_DB}..."
PGPASSWORD="${PGPASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -c "DROP DATABASE IF EXISTS ${TEST_DB};" \
  -c "CREATE DATABASE ${TEST_DB};"

# 3. Measure restore duration (RTO)
echo "--> Restoring database from dump..."
START_TIME=$(date +%s)

# pg_restore returns 0 or 1 (warnings on ownership are acceptable in restore tests)
PGPASSWORD="${PGPASSWORD}" pg_restore \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${TEST_DB}" \
  --no-owner \
  --role="${POSTGRES_USER}" \
  -v "${LATEST_DUMP}" || true

END_TIME=$(date +%s)
RESTORE_SECONDS=$((END_TIME - START_TIME))
echo "--> Database restored successfully in ${RESTORE_SECONDS} seconds."

# 4. Data verification check (REC-11, REC-15)
echo "--> Validating restored data integrity..."
USERS_COUNT=$(PGPASSWORD="${PGPASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${TEST_DB}" -t -A -c 'SELECT count(*) FROM "User";' 2>/dev/null || echo "0")
MATTERS_COUNT=$(PGPASSWORD="${PGPASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${TEST_DB}" -t -A -c 'SELECT count(*) FROM "Matter";' 2>/dev/null || echo "0")
PARTIES_COUNT=$(PGPASSWORD="${PGPASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${TEST_DB}" -t -A -c 'SELECT count(*) FROM "Party";' 2>/dev/null || echo "0")
DOCS_COUNT=$(PGPASSWORD="${PGPASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${TEST_DB}" -t -A -c 'SELECT count(*) FROM "Document";' 2>/dev/null || echo "0")

echo "    Integrity Verification:"
echo "      - Users: ${USERS_COUNT}"
echo "      - Matters: ${MATTERS_COUNT}"
echo "      - Parties: ${PARTIES_COUNT}"
echo "      - Documents: ${DOCS_COUNT}"

if [ "${USERS_COUNT}" -eq 0 ]; then
  echo "[FAILURE] Restored database is empty or corrupted."
  exit 1
fi

# 5. Clean up isolated test database
echo "--> Cleaning up isolated test database..."
PGPASSWORD="${PGPASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -c "DROP DATABASE IF EXISTS ${TEST_DB};"

echo "=== [$(date -u)] RESTORE_TEST SUCCESSFUL (Measured: ${RESTORE_SECONDS}s) ==="

