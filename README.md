# plana studio

The shop for `plana-planer.de`: a configurator for personalised wall planners (70 × 100 cm), checkout with Stripe, gift vouchers, and an admin page with the print file of every order.

One Next.js app (TypeScript), one SQLite file, no other services to run.

## How it fits together

- **Layout engine** (`src/planner/`): a design spec (layout, colours, fonts, title, calendars, birthdays) plus the dates become a list of drawing primitives. The on-screen preview (SVG) and the print file (PDF, 3 mm bleed, fonts embedded) are both rendered from that list, so the customer signs off exactly what is printed.
- **Three base layouts**: `wochen` (13 rows × 4 weeks, the original), `zeilen` (12 month rows, landscape), `spalten` (12 month columns, portrait).
- **Calendars**: public holidays (computed per Bundesland, tested against OpenHolidays) and school holidays (snapshot in `data/`, refresh with `npm run holidays`) are built in. Customers can add a football club's fixtures (OpenLigaDB), any public iCal address, and their own dates.
- **Design assistant** (`src/lib/ai.ts`): the customer writes what they want, optionally with a photo; Claude returns a new design spec, the engine draws it. The assistant cannot change dates or print geometry. The same module reads birthdays from a photographed calendar; the customer corrects the list before ordering.
- **Orders** (`src/lib/orders.ts`): an order stores a snapshot of the spec. Stripe Checkout takes the payment and sends the invoice; the webhook marks the order paid. Vouchers are codes with a balance.
- **Admin** (`/admin`): paid orders, print PDF download, status and tracking number (sends the shipping mail).
- **Print partner** (`src/lib/posterflow.ts`, `src/lib/print-partner.ts`): with `POSTERFLOW_API_KEY` set, each new paid order has an "An Posterflow senden" button. The shop sends name, address, email and a signed, expiring link to the print PDF (`/api/print/...`, rendered on request, never stored). Before every send it asks Posterflow whether the order number is already there, so an order is never printed twice. Status comes from Posterflow's callback (`/api/posterflow/webhook`) and from a check every six hours or on "Status aktualisieren"; when Posterflow reports the parcel shipped, the order becomes "Versandt" and the customer gets the usual shipping mail. Without the key, nothing changes: download the PDF and upload it by hand. Setup and open questions: `docs/posterflow.md`.

## Run it locally

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

Open http://localhost:3000. Without keys the configurator works; set `SHOP_OPEN=true`, `ADMIN_PASSWORD` and the Stripe test keys to try an order. Mails are printed to the console until `SMTP_URL` is set.

```bash
npm test
```

## Put it online

1. Rent a small VPS in Germany (2 vCPU, 4 GB RAM is plenty) with Ubuntu 24.04 and install Docker.
2. At IONOS, point the domain to the server: an `A` record for `plana-planer.de` and one for `www`, both to the server's IPv4 address (and `AAAA` for IPv6 if you have one).
3. On the server:

```bash
git clone https://github.com/ks-2097/wandplaner-website.git && cd wandplaner-website
```

```bash
cp .env.example .env && nano .env
```

```bash
docker compose up -d --build
```

Caddy fetches the TLS certificate on its own. To update later: `git pull && docker compose up -d --build`.

4. In Stripe, add a webhook endpoint `https://plana-planer.de/api/stripe/webhook` with the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and put its signing secret into `.env`. Switch on PayPal, Klarna and SEPA under Settings › Payment methods.
5. Back up the order database every night: see `docs/backup.md`.

## Automatic deployment

A push to `main` runs the tests; if they pass, GitHub logs in to the server and runs `scripts/deploy.sh`: it pulls `main`, rebuilds, waits for the site to answer, and rolls back to the previous version if it doesn't. The deploy key can run only that script.

One-time setup:

1. On your PC, create a key used only for deploying (no passphrase, so GitHub can use it):

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\plana_github_deploy -N '""' -C github-deploy
```

2. On the server, make `main` the branch it follows, then allow the key to run only the deploy script (replace `<PUBLIC KEY>` with the contents of `plana_github_deploy.pub`):

```bash
cd ~/wandplaner-website && git fetch origin main && git checkout -B main origin/main
```

```bash
echo 'command="/root/wandplaner-website/scripts/deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty <PUBLIC KEY>' >> ~/.ssh/authorized_keys
```

3. In the repository on GitHub, under Settings > Environments, create an environment named `production`. Under Settings > Secrets and variables > Actions, add three secrets to it:
   - `DEPLOY_SSH_KEY`: the content of the private key file `plana_github_deploy`
   - `DEPLOY_HOST`: `87.106.28.141`
   - `DEPLOY_KNOWN_HOSTS`: the output of `ssh-keyscan -t ed25519 87.106.28.141`
4. Under Settings > Branches, protect `main`: require a pull request and the `test` check before merging.

After that, merging a pull request deploys it. The "Actions" tab shows the log of every deploy, and "Run workflow" on the CI workflow starts one by hand.

## Before the first sale

- Fill in every marked placeholder in Impressum, Datenschutz, AGB, Widerruf and Versand, with texts from a legal-text service.
- Check the school holidays in `data/school-holidays.json` against the official tables; they come from OpenHolidays.
- Order one test print of each layout from the PDF in `/admin`.
- Set `SHOP_OPEN=true`.

## Licences

Fonts in `src/planner/fonts` and `public/fonts`: SIL Open Font License. Holiday data: OpenHolidays API, ODbL. Fixtures: OpenLigaDB, ODbL.
