# Backup and restore

Every night at about 03:15 the server saves a copy of the shop database (all orders and vouchers), locks it with a passphrase, and keeps the last 14 days and the last 8 weeks. Once a week it unpacks the newest copy to prove it works. If you set up step 5, each copy is also sent to storage away from the server.

**Without step 5 the backup lives on the same server.** If the server is lost, the backup is lost with it. Do step 5 before taking real orders.

All commands run on the server as root (`ssh root@87.106.28.141`).

## Set up (once)

1. Install the tools. `gpg` is already on AlmaLinux; the database tool is not.

```bash
dnf install -y sqlite
```

2. Get the scripts onto the server and make them runnable.

```bash
cd ~/wandplaner-website && git pull && chmod +x scripts/backup.sh scripts/restore-test.sh
```

3. Create the passphrase that locks the backups. This writes a random one to a file only root can read.

```bash
umask 077 && head -c 32 /dev/urandom | base64 > /etc/plana-backup.passphrase
```

4. Show the passphrase and save it in your password manager. **Without it no backup can ever be opened**, and a server that is gone takes this file with it.

```bash
cat /etc/plana-backup.passphrase
```

5. Set up the off-server copy. Install rclone, then run its guided setup and pick your storage (IONOS S3, Hetzner Storage Box, Backblaze, Dropbox, Google Drive, a second server over SFTP, and many more). Name the connection `offsite`.

```bash
dnf install -y epel-release && dnf install -y rclone
```

```bash
rclone config
```

Check that it works (an empty list or a list of folders is fine, an error is not):

```bash
rclone lsd offsite:
```

6. Write the settings file. Remove the `BACKUP_RCLONE_REMOTE` line if you skip step 5 for now. `plana-backups` is the folder name at your storage, change it if you like.

```bash
cat > /etc/plana-backup.env <<'CONF'
BACKUP_RCLONE_REMOTE=offsite:plana-backups
CONF
```

```bash
chmod 600 /etc/plana-backup.env
```

Optional: a free account at healthchecks.io gives you a web address that emails you when no backup has reported in. Add it with `BACKUP_PING_URL=https://hc-ping.com/your-id` on a new line in that file. This is the only way you get told if the whole server is down.

7. Run the first backup by hand. The last line must say `Backup finished OK`.

```bash
~/wandplaner-website/scripts/backup.sh
```

8. Run the restore test by hand. It must print `integrity_check: ok`, the number of orders and vouchers, and `Restore test OK`.

```bash
~/wandplaner-website/scripts/restore-test.sh
```

9. Switch on the nightly backup and the weekly restore test.

```bash
cp ~/wandplaner-website/scripts/backup.service ~/wandplaner-website/scripts/backup.timer ~/wandplaner-website/scripts/restore-test.service ~/wandplaner-website/scripts/restore-test.timer /etc/systemd/system/
```

```bash
systemctl daemon-reload && systemctl enable --now backup.timer restore-test.timer
```

```bash
systemctl list-timers backup.timer restore-test.timer
```

If your code is not in `/root/wandplaner-website`, fix the path in the two `.service` files first.

## Where the files are

- Backups: `/var/backups/plana/daily` (14 newest) and `/var/backups/plana/weekly` (8 newest). Only root can read them.
- Log: `/var/backups/plana/backup.log`
- Passphrase: `/etc/plana-backup.passphrase`, settings: `/etc/plana-backup.env`

Never put these inside the `wandplaner-website` folder. The scripts refuse to run if you do.

## Restore for real

Use this if the database is lost or damaged. Orders made after the last backup are gone, at most one day.

1. Stop the shop.

```bash
cd ~/wandplaner-website && docker compose stop app
```

2. If this is a new server, first do set-up steps 1 to 3 but use your saved passphrase instead of a new one (`nano /etc/plana-backup.passphrase`, then `chmod 600` on it). Then fetch the backups from your storage:

```bash
mkdir -p /var/backups/plana/daily && rclone copy offsite:plana-backups/daily /var/backups/plana/daily
```

3. Unpack the newest backup (or name another file in `ls /var/backups/plana/daily`).

```bash
f=$(ls /var/backups/plana/daily/plana-*.gpg | tail -n 1); echo "Using $f"; gpg --batch --pinentry-mode loopback --passphrase-file /etc/plana-backup.passphrase --decrypt "$f" | gunzip > /tmp/restored.sqlite
```

4. Check it.

```bash
sqlite3 /tmp/restored.sqlite 'PRAGMA integrity_check; SELECT count(*) FROM orders;'
```

5. Keep the damaged database aside and put the restored one in place. The shop runs as user 1000, so it must own the file.

```bash
d=/root/damaged-db-$(date +%F); mkdir -p "$d" var; mv var/plana.sqlite* "$d"/ 2>/dev/null; install -o 1000 -g 1000 -m 600 /tmp/restored.sqlite var/plana.sqlite && shred -u /tmp/restored.sqlite
```

6. Start the shop and look at /admin.

```bash
docker compose start app
```

## What you see when something goes wrong

- Nothing, normally. The scripts are quiet on success.
- If a nightly backup fails, no email is sent by the server itself. Look here:

```bash
systemctl status backup.service
```

```bash
tail -n 30 /var/backups/plana/backup.log
```

- The last lines say what is wrong, in plain words: `Passphrase file not found`, `integrity_check failed` (the database is damaged: stop and call for help), `Snapshot failed` (Docker is not running or the shop image is not built), `Upload ... failed` (the off-server storage does not answer; the copy on the server is still fine).
- The weekly restore test fails with `RESTORE TEST FAILED`, or with `Newest backup is N hours old` when the nightly backups have silently stopped. Check it with `systemctl status restore-test.service`.
- A line `WARN ... SAME SERVER only` in the log means step 5 is not done.
- With the healthchecks.io address from step 6 you also get an email when a backup fails or does not run at all.
- Every few months, run the restore test by hand (step 8) and look at the numbers: they should match the shop.
