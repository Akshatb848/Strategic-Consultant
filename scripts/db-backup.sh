#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ASIS v4.0 — Database Backup Script
#
# Usage:
#   ./scripts/db-backup.sh                    # uses DATABASE_URL from env
#   DATABASE_URL=postgresql+psycopg://... ./scripts/db-backup.sh
#
# Outputs a timestamped dump file in ./backups/
# For PostgreSQL:  pg_dump → gzip compressed .sql.gz
# For SQLite:      cp + gzip compressed .db.gz
#
# Cron example (daily at 02:00 UTC):
#   0 2 * * * /app/scripts/db-backup.sh >> /var/log/asis-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
DATABASE_URL="${DATABASE_URL:-sqlite:///./asis_v4.db}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")

mkdir -p "$BACKUP_DIR"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting ASIS database backup..."

if echo "$DATABASE_URL" | grep -qE "^postgresql"; then
    # ── PostgreSQL backup ─────────────────────────────────────────────────────
    # Parse connection components from DATABASE_URL
    # Supports: postgresql+psycopg://user:pass@host:port/dbname
    CONN="${DATABASE_URL#postgresql+*://}"
    USER="${CONN%%:*}"
    REST="${CONN#*:}"
    PASS="${REST%%@*}"
    HOST_DB="${REST#*@}"
    HOST="${HOST_DB%%/*}"
    DB="${HOST_DB#*/}"
    PORT="5432"
    if echo "$HOST" | grep -q ":"; then
        PORT="${HOST##*:}"
        HOST="${HOST%%:*}"
    fi

    BACKUP_FILE="$BACKUP_DIR/asis_pg_${TIMESTAMP}.sql.gz"
    PGPASSWORD="$PASS" pg_dump \
        -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
        --no-password \
        --format=plain \
        --no-owner \
        --no-acl \
        | gzip -9 > "$BACKUP_FILE"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] PostgreSQL backup written: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

elif echo "$DATABASE_URL" | grep -qE "^sqlite"; then
    # ── SQLite backup ─────────────────────────────────────────────────────────
    DB_PATH="${DATABASE_URL#sqlite:///}"
    # Resolve relative path from project root
    if [[ "$DB_PATH" != /* ]]; then
        DB_PATH="$PROJECT_ROOT/$DB_PATH"
    fi
    if [ ! -f "$DB_PATH" ]; then
        echo "[ERROR] SQLite database file not found: $DB_PATH" >&2
        exit 1
    fi
    BACKUP_FILE="$BACKUP_DIR/asis_sqlite_${TIMESTAMP}.db.gz"
    gzip -9 -c "$DB_PATH" > "$BACKUP_FILE"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] SQLite backup written: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

else
    echo "[ERROR] Unsupported DATABASE_URL scheme. Only postgresql and sqlite are supported." >&2
    exit 1
fi

# ── Prune old backups ─────────────────────────────────────────────────────────
find "$BACKUP_DIR" -name "asis_*.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruned backups older than ${RETENTION_DAYS} days."
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup complete."
