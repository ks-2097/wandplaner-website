import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { defaultSpec } from '../src/planner';

type Orders = typeof import('../src/lib/orders');
type Db = typeof import('../src/lib/db');
let orders: Orders;
let db: Db;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'plana-test-'));
  orders = await import('../src/lib/orders');
  db = await import('../src/lib/db');
});

const DAY = 86_400_000;
const customer = { email: 'test@example.com', name: 'Test Kundin', address: { street: 'Musterstraße 1', zip: '10115', city: 'Berlin', country: 'DE' as const } };
const consents = { proofChecked: true, noWithdrawal: true, terms: true };
const place = () => orders.createOrder({ kind: 'planner', spec: defaultSpec(), customer, consents });
const set = (id: string, fields: Record<string, string | number | null>) =>
  db.getDb().prepare(`UPDATE orders SET ${Object.keys(fields).map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...fields, id });
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

describe('deletion schedule', () => {
  it('removes a design 30 days after shipping and keeps the invoice data', () => {
    const old = place();
    const recent = place();
    set(old.id, { status: 'shipped', shipped_at: ago(31) });
    set(recent.id, { status: 'shipped', shipped_at: ago(29) });
    expect(orders.purgeExpiredDesigns().designs).toBe(1);
    const after = orders.getOrder(old.id)!;
    expect(after.spec).toBeNull();
    expect(after.design_deleted_at).not.toBeNull();
    expect(after.name).toBe('Test Kundin');
    expect(after.amount_total).toBe(9900);
    expect(orders.describeOrder(after)).toContain('Design: gelöscht');
    expect(orders.getOrder(recent.id)!.spec).not.toBeNull();
  });

  it('keeps a design the customer opted in for, until the upper limit', () => {
    const o = place();
    set(o.id, { status: 'shipped', shipped_at: ago(100), created_at: ago(110) });
    expect(orders.setKeepDesign(o.id, 'wrong-token', true)).toBe(false);
    expect(orders.setKeepDesign(o.id, o.token, true)).toBe(true);
    orders.purgeExpiredDesigns();
    expect(orders.getOrder(o.id)!.spec).not.toBeNull();
    // Withdrawing the consent puts it back on the normal schedule.
    orders.setKeepDesign(o.id, o.token, false);
    orders.purgeExpiredDesigns();
    expect(orders.getOrder(o.id)!.spec).toBeNull();

    const kept = place();
    set(kept.id, { status: 'shipped', shipped_at: ago(590), created_at: ago(600), keep_design: 1 });
    orders.purgeExpiredDesigns();
    expect(orders.getOrder(kept.id)!.spec).toBeNull();
  });

  it('leaves paid orders that still need printing, and removes stale unpaid ones', () => {
    const paid = place();
    const abandoned = place();
    const fresh = place();
    set(paid.id, { status: 'paid', paid_at: ago(200), created_at: ago(200) });
    set(abandoned.id, { created_at: ago(31) });
    const result = orders.purgeExpiredDesigns();
    expect(result.unpaid).toBe(1);
    expect(orders.getOrder(paid.id)!.spec).not.toBeNull();
    expect(orders.getOrder(abandoned.id)).toBeUndefined();
    expect(orders.getOrder(fresh.id)).toBeDefined();
  });
});
