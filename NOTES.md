# Working notes (read this first)

Handover for any new session. Keep it current: update the status section when something changes. Do not put secrets, keys or passwords in this file or in git.

## Project

plana studio shop for plana-planer.de: a configurator for personalised wall planners (70 × 100 cm), Stripe checkout, gift vouchers, admin page with print PDFs. Next.js + SQLite, runs in Docker behind Caddy. See README.md for the full setup and the code layout.

Branch: `claude/sharp-mccarthy-7mwvaw` (develop and push here only).

## Server

- Provider: IONOS VPS (VPS 2-4-120), AlmaLinux 9, IPv4 87.106.28.141.
- Login: root via SSH from the owner's computer. Password only. Do not store it anywhere.
- Installed: git, Docker CE with compose plugin, firewalld (ports 80 and 443 open, SSH open).
- Code cloned to `/root/wandplaner-website` (branch above).
- Data lives in `var/` (orders and vouchers, SQLite). Back up nightly, not yet set up.
- DNS: `plana-planer.de` and `www` A records point to 87.106.28.141 (done, verified).

## Status

- Build failed on first try (missing C compiler for better-sqlite3). Fixed in the Dockerfile and pushed.
- Next: `git pull` on the server, then `docker compose up -d --build`, then check `docker compose ps` and `curl -sI https://plana-planer.de`.
- Admin password is set in the server's `.env` (entered by the owner during setup).
- `SHOP_OPEN=false` (waiting list only). Keep it false until the go-live checklist below is done.

## Deployment

Automatic from GitHub: push to `main` -> tests -> SSH to the server -> `scripts/deploy.sh` (pull, rebuild, health check, rollback). Needs the one-time setup in README.md ("Automatic deployment"). Manual fallback: `ssh root@87.106.28.141 "cd ~/wandplaner-website && git pull && docker compose up -d --build"`.

## Open items

1. Stripe: owner has created the account. Keys go into the server's `.env` only (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). Start with test keys. Set `STRIPE_TAX=true` only after Stripe Tax is registered in the dashboard.
2. Stripe webhook endpoint: `https://plana-planer.de/api/stripe/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
3. Payment methods to enable in Stripe: PayPal, Klarna, SEPA.
4. Mail: SMTP account (Brevo planned). Set `SMTP_URL`. When Brevo is set up, merge its SPF rule into the single existing SPF TXT record. Only one SPF record is allowed.
5. Anthropic API key for the design assistant and birthday scan (`ANTHROPIC_API_KEY`). Optional; features are off without it.
6. Legal texts: placeholders in Impressum, Datenschutz, AGB, Widerruf, Versand need a legal-text service.
7. Backup: `scripts/backup.sh` and `docs/backup.md` are written and tested locally. Still to do: set it up on the server, including the off-server copy.
8. Test order end to end (payment, mails, admin PDF). Test prints of each layout.
9. Waiting-list form: Brevo action URL in `NEXT_PUBLIC_WAITLIST_URL` (needs a rebuild).
10. Posterflow hand-off is built but off until `POSTERFLOW_API_KEY`, `PRINT_FILE_SECRET` and the `POSTERFLOW_SENDER_*` address are set. Before the first real order: check `/api/admin/posterflow/articles` for the right `POSTERFLOW_ARTICLE_TYPE` / size values (inferred `white250`, `70x100`), ask Posterflow whether landscape files need `100x70`, and confirm that the file we send them (exact trim size, no bleed, per their "no bleed" rule) prints edge to edge without a white border. Agree the callback URL `<SITE_URL>/api/posterflow/webhook` and, if possible, a signing secret (`POSTERFLOW_WEBHOOK_SECRET`). Without a secret the callback only triggers a status check through the API. Tested with mocks only, never against their API.

## Deletion schedule (built in, `src/lib/orders.ts`)

- Design data is deleted 30 days after an order is marked "Versandt" (or cancelled). Print files are never stored.
- Customers can opt in to keeping the design, on their order page (the link in the order mail, no account). Kept designs go after 550 days at the latest.
- Unpaid orders are deleted after 30 days.
- Orders that are paid but never marked "Versandt" are not purged, so always set the status in /admin.
- Runs at server start, every six hours, and when /admin is opened.
- Posterflow print orders get the print file through a signed link that expires after `PRINT_FILE_URL_DAYS` (14). The PDF is rendered when Posterflow downloads it; nothing is written to disk. Posterflow's own retention of files and addresses is not documented (AVV open, see `docs/posterflow.md`).

## Go-live checklist

- All open items 1–8 done, Stripe switched to live keys, a test order checked.
- Set `SHOP_OPEN=true` in `.env`, then `docker compose up -d`.

## Working rules

- Never paste secrets (keys, passwords, `.env` contents) into chat or commit them.
- Orders are real money: test with Stripe test mode and never with live keys on test orders.
- Before a server change, say what it does and wait for the owner's go-ahead.
- Owner reads German; the site is German. Explain commands briefly, owner is not a developer.
