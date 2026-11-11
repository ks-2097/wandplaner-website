import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config';

/**
 * One SQLite file on the server's disk. Enough for a shop of this size, nothing to run
 * or patch, and a backup is a file copy. Tables are created on first use.
 */

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(config.dataDir, { recursive: true });
  db = new Database(path.join(config.dataDir, 'plana.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      token TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('planner', 'voucher')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'in_production', 'shipped', 'cancelled')),
      spec TEXT,
      amount_total INTEGER NOT NULL,
      amount_voucher INTEGER NOT NULL DEFAULT 0,
      amount_due INTEGER NOT NULL,
      voucher_code TEXT,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      consents TEXT NOT NULL,
      stripe_session_id TEXT,
      stripe_payment_intent TEXT,
      tracking TEXT,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      shipped_at TEXT
    );
    CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at);
    CREATE TABLE IF NOT EXISTS vouchers (
      code TEXT PRIMARY KEY,
      initial_cents INTEGER NOT NULL,
      balance_cents INTEGER NOT NULL,
      order_id TEXT REFERENCES orders (id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS voucher_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL REFERENCES vouchers (code),
      order_id TEXT NOT NULL REFERENCES orders (id),
      amount_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (code, order_id)
    );
    CREATE TABLE IF NOT EXISTS usage (
      day TEXT NOT NULL,
      key TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, key)
    );
  `);
  // Columns added after the first release
  const cols = (db.prepare("PRAGMA table_info('orders')").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('keep_design')) db.exec('ALTER TABLE orders ADD COLUMN keep_design INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('design_deleted_at')) db.exec('ALTER TABLE orders ADD COLUMN design_deleted_at TEXT');
  return db;
}

export type OrderRow = {
  id: string;
  number: string;
  token: string;
  kind: 'planner' | 'voucher';
  status: 'pending' | 'paid' | 'in_production' | 'shipped' | 'cancelled';
  spec: string | null;
  amount_total: number;
  amount_voucher: number;
  amount_due: number;
  voucher_code: string | null;
  email: string;
  name: string;
  address: string | null;
  consents: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  tracking: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  /** 1 = the customer asked us to keep the design for a reorder */
  keep_design: number;
  /** Set when the design data was removed under the deletion schedule */
  design_deleted_at: string | null;
};

export type VoucherRow = { code: string; initial_cents: number; balance_cents: number; order_id: string | null; created_at: string };

export const now = (): string => new Date().toISOString();

/** Counts a use against a daily limit. Returns false once the limit is reached. */
export function countUsage(key: string, limit: number): boolean {
  const day = now().slice(0, 10);
  const d = getDb();
  const row = d.prepare('SELECT count FROM usage WHERE day = ? AND key = ?').get(day, key) as { count: number } | undefined;
  if ((row?.count ?? 0) >= limit) return false;
  d.prepare('INSERT INTO usage (day, key, count) VALUES (?, ?, 1) ON CONFLICT (day, key) DO UPDATE SET count = count + 1').run(day, key);
  return true;
}
