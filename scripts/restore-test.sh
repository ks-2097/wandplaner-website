#!/usr/bin/env bash
# Restore test: decrypts the newest backup into a temporary folder, checks it and prints
# row counts. Never touches the live database (var/). Usage: restore-test.sh [backup-file]
set -Eeuo pipefail
umask 077

CONFIG_FILE="${BACKUP_CONFIG:-/etc/plana-backup.env}"
if [ -r "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi
BACKUP_DIR="${BACKUP_DIR:-/var/backups/plana}"
PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-/etc/plana-backup.passphrase}"
MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-36}"
PING_URL="${RESTORE_PING_URL:-}"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1 ${*:2}" >&2; }
die() { log ERROR "$*"; exit 1; }

WORK=""
GNUPGHOME=""
cleanup() {
  local rc=$?
  if [ -n "$GNUPGHOME" ] && [ -d "$GNUPGHOME" ]; then
    gpgconf --homedir "$GNUPGHOME" --kill gpg-agent >/dev/null 2>&1 || true
    rm -rf "$GNUPGHOME"
  fi
  [ -n "$WORK" ] && rm -rf "$WORK"
  if [ "$rc" -ne 0 ]; then
    log ERROR "RESTORE TEST FAILED (exit $rc). Do not rely on this backup until it is fixed."
    if [ -n "$PING_URL" ]; then curl -fsS -m 20 -o /dev/null "${PING_URL%/}/fail" 2>/dev/null || true; fi
  fi
}
trap cleanup EXIT

for tool in gpg gunzip sqlite3; do
  command -v "$tool" >/dev/null 2>&1 || die "Required program not found: $tool (see docs/backup.md, step 1)"
done
[ -s "$PASSPHRASE_FILE" ] || die "Passphrase file missing or empty: $PASSPHRASE_FILE"

if [ $# -ge 1 ]; then
  file="$1"
else
  files=("$BACKUP_DIR"/daily/plana-*.sqlite.gz.gpg)
  [ -e "${files[0]}" ] || die "No backups found in $BACKUP_DIR/daily"
  file="${files[${#files[@]}-1]}"   # names contain the date, so the last one is the newest
fi
[ -f "$file" ] || die "Backup file not found: $file"
age_h=$(( ( $(date +%s) - $(stat -c %Y "$file") ) / 3600 ))
log INFO "Testing $file (${age_h}h old)"
if [ $# -eq 0 ] && [ "$age_h" -gt "$MAX_AGE_HOURS" ]; then
  die "Newest backup is ${age_h} hours old (limit $MAX_AGE_HOURS). Nightly backups have stopped."
fi

WORK="$(mktemp -d /tmp/plana-restore.XXXXXX)"
GNUPGHOME="$WORK/gnupg"; mkdir -m 700 "$GNUPGHOME"; export GNUPGHOME
gpg --batch --quiet --no-tty --pinentry-mode loopback --passphrase-file "$PASSPHRASE_FILE" \
  --decrypt "$file" | gunzip > "$WORK/restored.sqlite" || die "Cannot decrypt/unpack the backup (wrong passphrase or damaged file)"

check="$(sqlite3 -readonly "$WORK/restored.sqlite" 'PRAGMA integrity_check;' 2>&1)" || true
[ "$check" = "ok" ] || die "integrity_check failed: $check"
log INFO "integrity_check: ok"

for t in orders vouchers voucher_redemptions usage; do
  n="$(sqlite3 -readonly "$WORK/restored.sqlite" "SELECT count(*) FROM $t;" 2>&1)" || die "Table $t is missing or unreadable: $n"
  printf '  %-20s %s rows\n' "$t" "$n"
done
latest="$(sqlite3 -readonly "$WORK/restored.sqlite" "SELECT coalesce(max(created_at), '-') FROM orders;")"
paid="$(sqlite3 -readonly "$WORK/restored.sqlite" "SELECT count(*) FROM orders WHERE status <> 'pending';")"
printf '  %-20s %s\n  %-20s %s\n' "paid or later orders" "$paid" "newest order" "$latest"
log INFO "Restore test OK (live database was not touched)"
if [ -n "$PING_URL" ]; then curl -fsS -m 20 -o /dev/null "$PING_URL" || log WARN "Could not reach RESTORE_PING_URL"; fi
