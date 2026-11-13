#!/usr/bin/env bash
# Nightly backup of the shop database (orders, vouchers). Runs on the server as root.
#
# 1. Takes a consistent snapshot of var/plana.sqlite while the shop is running, using
#    SQLite's online backup API from inside the app image (same SQLite as the app).
# 2. Checks the snapshot (PRAGMA integrity_check), compresses and encrypts it (gpg, AES-256).
# 3. Proves the encrypted file can be decrypted and is intact again.
# 4. Keeps 14 daily and 8 weekly copies on this server.
# 5. If BACKUP_RCLONE_REMOTE is set, copies the file off the server with rclone.
#
# Settings come from /etc/plana-backup.env (see docs/backup.md). Safe to run twice.
set -Eeuo pipefail
umask 077

CONFIG_FILE="${BACKUP_CONFIG:-/etc/plana-backup.env}"
if [ -r "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(dirname "$SCRIPT_DIR")}"
DATA_DIR="${DATA_DIR:-$REPO_DIR/var}"                      # host side of the ./var:/app/var mount
BACKUP_DIR="${BACKUP_DIR:-/var/backups/plana}"
PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-/etc/plana-backup.passphrase}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
REMOTE="${BACKUP_RCLONE_REMOTE:-}"                         # e.g. mystorage:plana-backups
REMOTE_KEEP_DAYS="${BACKUP_REMOTE_KEEP_DAYS:-90}"
PING_URL="${BACKUP_PING_URL:-}"                            # optional dead-man's-switch (healthchecks.io style)
DOCKER="${DOCKER:-docker}"
# Name of the database file inside var/ (set in src/lib/db.ts)
DB_FILE="plana.sqlite"

LOG_FILE=""
log() {
  local line
  line="$(date '+%Y-%m-%d %H:%M:%S') $1 ${*:2}"
  echo "$line" >&2
  if [ -n "$LOG_FILE" ]; then echo "$line" >> "$LOG_FILE" || true; fi
}
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
  rm -rf "$DATA_DIR/.backup-tmp"
  if [ "$rc" -ne 0 ]; then
    log ERROR "BACKUP FAILED (exit $rc). See the error above. Older backups are untouched."
    if [ -n "$PING_URL" ]; then curl -fsS -m 20 -o /dev/null "${PING_URL%/}/fail" 2>/dev/null || true; fi
  fi
}
trap cleanup EXIT

# --- Checks before doing anything ------------------------------------------------------
for tool in gpg gzip sqlite3 flock "$DOCKER"; do
  command -v "$tool" >/dev/null 2>&1 || die "Required program not found: $tool (see docs/backup.md, step 1)"
done
[ -n "$REMOTE" ] && { command -v rclone >/dev/null 2>&1 || die "BACKUP_RCLONE_REMOTE is set but rclone is not installed"; }

mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd -P)"
REPO_REAL="$(cd "$REPO_DIR" && pwd -P)"
case "$BACKUP_DIR/" in
  "$REPO_REAL"/*) die "BACKUP_DIR ($BACKUP_DIR) is inside the git checkout. Use a folder outside it, e.g. /var/backups/plana" ;;
esac
chmod 700 "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
chmod 700 "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
LOG_FILE="$BACKUP_DIR/backup.log"
touch "$LOG_FILE"; chmod 600 "$LOG_FILE"
if [ "$(wc -l < "$LOG_FILE")" -gt 3000 ]; then tail -n 1500 "$LOG_FILE" > "$LOG_FILE.new" && mv "$LOG_FILE.new" "$LOG_FILE"; fi

# Only one backup at a time
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || die "Another backup is already running"

[ -f "$PASSPHRASE_FILE" ] || die "Passphrase file not found: $PASSPHRASE_FILE (see docs/backup.md, step 3)"
[ -s "$PASSPHRASE_FILE" ] || die "Passphrase file is empty: $PASSPHRASE_FILE"
PASS_REAL="$(readlink -f "$PASSPHRASE_FILE")"
case "$PASS_REAL" in
  "$REPO_REAL"/*) die "Passphrase file is inside the git checkout. Keep it outside, e.g. /etc/plana-backup.passphrase" ;;
esac
case "$(stat -c %a "$PASSPHRASE_FILE")" in
  ?00) ;;
  *) die "Passphrase file is readable by others. Run: chmod 600 $PASSPHRASE_FILE" ;;
esac
[ -f "$DATA_DIR/$DB_FILE" ] || die "Database not found: $DATA_DIR/$DB_FILE"

log INFO "Backup started (database $DATA_DIR/$DB_FILE)"

WORK="$(mktemp -d "$BACKUP_DIR/.work.XXXXXX")"
GNUPGHOME="$(mktemp -d /tmp/plana-gnupg.XXXXXX)"
export GNUPGHOME

# --- 1. Snapshot inside the app image ---------------------------------------------------
# The database is in WAL mode and the app writes to it at any time, so a plain file copy
# could be torn. better-sqlite3's backup() is SQLite's online backup: a consistent copy.
# `run --no-deps` works even if the app container is stopped.
SNAP_JS='
const Database = require("better-sqlite3");
const fs = require("fs"), path = require("path");
const dir = process.env.DATA_DIR || "/app/var";
const out = path.join(dir, ".backup-tmp", "snapshot.sqlite");
fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });
fs.rmSync(out, { force: true });
const db = new Database(path.join(dir, "'"$DB_FILE"'"), { fileMustExist: true });
db.backup(out).then(() => {
  db.close();
  const s = new Database(out);
  const r = s.pragma("integrity_check", { simple: true });
  s.pragma("journal_mode = delete");
  s.close();
  if (r !== "ok") { console.error("integrity_check in container: " + r); process.exit(3); }
}).catch((e) => { console.error("backup failed: " + e.message); process.exit(2); });
'
rm -rf "$DATA_DIR/.backup-tmp"
if ! snap_out="$("$DOCKER" compose -f "$REPO_DIR/docker-compose.yml" --project-directory "$REPO_DIR" \
  run --rm --no-deps -T app node -e "$SNAP_JS" 2>&1)"; then
  die "Snapshot failed (database damaged? Docker not running? app image not built?). Details: $(printf '%s' "$snap_out" | tail -n 5 | tr '\n' ' ')"
fi
[ -s "$DATA_DIR/.backup-tmp/snapshot.sqlite" ] || die "Snapshot file missing or empty"
mv "$DATA_DIR/.backup-tmp/snapshot.sqlite" "$WORK/snapshot.sqlite"
rm -rf "$DATA_DIR/.backup-tmp"

# --- 2. Verify the snapshot on the host ---------------------------------------------------
check="$(sqlite3 -readonly "$WORK/snapshot.sqlite" 'PRAGMA integrity_check;' 2>&1)" || true
[ "$check" = "ok" ] || die "integrity_check failed on the snapshot: $check"
orders="$(sqlite3 -readonly "$WORK/snapshot.sqlite" 'SELECT count(*) FROM orders;')" || die "Snapshot has no orders table"
vouchers="$(sqlite3 -readonly "$WORK/snapshot.sqlite" 'SELECT count(*) FROM vouchers;')" || die "Snapshot has no vouchers table"
log INFO "Snapshot ok: $orders orders, $vouchers vouchers"

# --- 3. Compress, encrypt, and prove it can be read back -------------------------------------
stamp="$(date +%F)"
week="$(date +%G-W%V)"
name="plana-$stamp.sqlite.gz.gpg"
gzip -9 -c "$WORK/snapshot.sqlite" > "$WORK/snapshot.sqlite.gz"
gpg --batch --yes --quiet --no-tty --pinentry-mode loopback --passphrase-file "$PASSPHRASE_FILE" \
  --symmetric --cipher-algo AES256 --compress-algo none -o "$WORK/$name" "$WORK/snapshot.sqlite.gz" \
  || die "Encryption failed"
gpg --batch --quiet --no-tty --pinentry-mode loopback --passphrase-file "$PASSPHRASE_FILE" \
  --decrypt "$WORK/$name" | gunzip > "$WORK/verify.sqlite" || die "Cannot decrypt the new backup again"
cmp -s "$WORK/verify.sqlite" "$WORK/snapshot.sqlite" || die "Decrypted backup differs from the snapshot"
size="$(stat -c %s "$WORK/$name")"

# Same-day re-run replaces that day's file; the rename is atomic.
mv -f "$WORK/$name" "$BACKUP_DIR/daily/$name"
chmod 600 "$BACKUP_DIR/daily/$name"
log INFO "Saved $BACKUP_DIR/daily/$name ($size bytes)"

# --- 4. Weekly copy (first backup of each ISO week) and pruning ----------------------------------
weekly="plana-$week.sqlite.gz.gpg"
if [ ! -e "$BACKUP_DIR/weekly/$weekly" ]; then
  cp "$BACKUP_DIR/daily/$name" "$BACKUP_DIR/weekly/$weekly.new"
  mv "$BACKUP_DIR/weekly/$weekly.new" "$BACKUP_DIR/weekly/$weekly"
  log INFO "Saved weekly copy $weekly"
fi
prune() { # prune DIR KEEP
  local files=("$1"/plana-*.sqlite.gz.gpg) i
  [ -e "${files[0]}" ] || return 0
  for ((i = 0; i < ${#files[@]} - $2; i++)); do
    rm -f -- "${files[$i]}"
    log INFO "Removed old backup ${files[$i]##*/}"
  done
}
prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
prune "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"

# --- 5. Off-server copy ---------------------------------------------------------------------------
if [ -n "$REMOTE" ]; then
  rclone copyto "$BACKUP_DIR/daily/$name" "${REMOTE%/}/daily/$name" >>"$LOG_FILE" 2>&1 \
    || die "Upload to $REMOTE failed (backup is saved on this server only; see $LOG_FILE)"
  rclone copyto "$BACKUP_DIR/weekly/$weekly" "${REMOTE%/}/weekly/$weekly" >>"$LOG_FILE" 2>&1 \
    || die "Upload of the weekly copy to $REMOTE failed"
  rclone delete "${REMOTE%/}" --include 'plana-*.sqlite.gz.gpg' --min-age "${REMOTE_KEEP_DAYS}d" >>"$LOG_FILE" 2>&1 \
    || log WARN "Could not remove old files at $REMOTE (backup itself is fine)"
  log INFO "Uploaded to $REMOTE"
else
  log WARN "BACKUP_RCLONE_REMOTE is not set: this backup is on the SAME SERVER only. If the server is lost, so is the backup. See docs/backup.md, step 5."
fi

log INFO "Backup finished OK"
if [ -n "$PING_URL" ]; then curl -fsS -m 20 -o /dev/null "$PING_URL" || log WARN "Could not reach BACKUP_PING_URL"; fi
