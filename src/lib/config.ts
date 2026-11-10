import path from 'node:path';

/** Server-side configuration. Everything comes from environment variables (see .env.example). */

const env = (name: string, fallback = ''): string => process.env[name]?.trim() || fallback;

export const config = {
  siteUrl: env('SITE_URL', 'http://localhost:3000').replace(/\/$/, ''),
  /** While false the site takes waiting-list signups instead of orders. */
  shopOpen: env('SHOP_OPEN', 'false') === 'true',
  dataDir: path.resolve(/*turbopackIgnore: true*/ env('DATA_DIR', './var')),
  stripeSecretKey: env('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: env('STRIPE_WEBHOOK_SECRET'),
  adminPassword: env('ADMIN_PASSWORD'),
  smtpUrl: env('SMTP_URL'),
  mailFrom: env('MAIL_FROM', 'plana studio <hallo@plana-planer.de>'),
  orderNotifyEmail: env('ORDER_NOTIFY_EMAIL'),
  anthropicApiKey: env('ANTHROPIC_API_KEY'),
  /** Cap on assistant and scan requests per day across all visitors */
  aiDailyLimit: Number(env('AI_DAILY_LIMIT', '400')),
};

export const PRICES = {
  /** Cents, incl. VAT and shipping within Germany */
  planner: 9900,
  voucher: 9900,
} as const;

export const PRODUCT = {
  name: 'Wandplaner 70 × 100 cm',
  paper: 'Premiumpapier matt',
  /** Last day to order for delivery before Christmas, shown on the site */
  lastOrderDate: '14. Dezember',
} as const;

export const euro = (cents: number): string => `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
