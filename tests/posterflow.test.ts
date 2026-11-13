import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSpec } from '../src/planner';

// Never talks to Posterflow: every request goes to a mocked fetch on a fake host.
const BASE = 'https://posterflow.invalid/api';
const ENV = {
  SITE_URL: 'https://shop.example',
  POSTERFLOW_API_KEY: 'mock-key',
  POSTERFLOW_BASE_URL: BASE,
  PRINT_FILE_SECRET: 'x'.repeat(40),
  POSTERFLOW_SENDER_FIRST_NAME: 'Franzi',
  POSTERFLOW_SENDER_LAST_NAME: 'Studio',
  POSTERFLOW_SENDER_STREET: 'Werkstraße',
  POSTERFLOW_SENDER_STREET_NUMBER: '3',
  POSTERFLOW_SENDER_ZIP: '10115',
  POSTERFLOW_SENDER_CITY: 'Berlin',
  POSTERFLOW_SENDER_EMAIL: 'versand@shop.example',
};

type Orders = typeof import('../src/lib/orders');
type Db = typeof import('../src/lib/db');
type PF = typeof import('../src/lib/posterflow');
type PP = typeof import('../src/lib/print-partner');
let orders: Orders;
let db: Db;
let pf: PF;
let pp: PP;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'plana-pf-test-'));
  Object.assign(process.env, ENV);
  orders = await import('../src/lib/orders');
  db = await import('../src/lib/db');
  pf = await import('../src/lib/posterflow');
  pp = await import('../src/lib/print-partner');
});

type Call = { url: string; method: string; headers: Record<string, string>; body?: any };
let calls: Call[];
let handler: (c: Call) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const apiOrder = (ref: string, extra: Record<string, unknown> = {}) => ({ External_orderid: ref, orderid: `PF${ref}`, createdat: '2026-11-13T10:00:00Z', completedat: null, items: [], shipping: [], ...extra });
const posts = () => calls.filter((c) => c.method === 'POST');

beforeEach(() => {
  Object.assign(process.env, ENV);
  delete process.env.POSTERFLOW_WEBHOOK_SECRET;
  calls = [];
  handler = () => json({ Error: 'unexpected' }, 500);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const c: Call = { url, method: init.method ?? 'GET', headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(c);
      return handler(c);
    }),
  );
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const customer = { email: 'kundin@example.com', name: 'Erika Maria Musterfrau', address: { street: 'Musterstraße 12a', zip: '68229', city: 'Mannheim', country: 'DE' as const } };
const consents = { proofChecked: true, noWithdrawal: true, terms: true };
async function paidOrder(layout: 'wochen' | 'spalten' = 'wochen') {
  const o = orders.createOrder({ kind: 'planner', spec: defaultSpec({ layout }), customer, consents });
  await orders.fulfilOrder(o.id);
  return orders.getOrder(o.id)!;
}
/** Posterflow without the order (lookup 404), accepting the POST */
const acceptingPosterflow = (c: Call) => (c.method === 'POST' ? json([apiOrder(c.body.data.orderid)]) : new Response('Not found', { status: 404 }));

describe('feature switch', () => {
  it('is off without an API key and makes no requests', async () => {
    delete process.env.POSTERFLOW_API_KEY;
    expect(pf.posterflowEnabled()).toBe(false);
    expect(pf.getPrintPartner()).toBeUndefined();
    const o = await paidOrder();
    await expect(pp.submitToPartner(o.id)).rejects.toThrow('Kein Druckpartner');
    expect(await pp.pollPartnerOrders()).toBe(0);
    expect((await pp.handlePartnerWebhook('{}', null)).status).toBe(404);
    expect(calls).toHaveLength(0);
    expect(orders.getOrder(o.id)!.partner_status).toBeNull();
  });

  it('defaults the base URL and the inferred article values', () => {
    delete process.env.POSTERFLOW_BASE_URL;
    const cfg = pf.posterflowConfig();
    expect(cfg.baseUrl).toBe('https://api.posterflow.de/api');
    expect([cfg.articleType, cfg.size, cfg.sizeLandscape, cfg.shippingCompany]).toEqual(['white250', '70x100', '70x100', 'DHL']);
  });
});

describe('submitting an order', () => {
  it('looks the order up, then sends only what the parcel needs', async () => {
    handler = acceptingPosterflow;
    const o = await paidOrder();
    const after = await pp.submitToPartner(o.id);

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`GET ${BASE}/orders?orderid=${o.number}`, `POST ${BASE}/`]);
    const post = calls[1];
    expect(post.headers.Authorization).toBe('Basic mock-key');
    expect(post.headers['Content-Type']).toBe('application/json');
    const d = post.body.data;
    expect(d.type).toBe('submit');
    expect(d.orderid).toBe(o.number);
    expect(d.shipping.shippingcompany).toBe('DHL');
    expect(d.shipping.destination).toEqual({
      first_name: 'Erika Maria', last_name: 'Musterfrau', street: 'Musterstraße', street_number: '12a', zip: '68229', city: 'Mannheim',
      country: 'Germany', country_code: 'DE', email: 'kundin@example.com', phone: '', province: '', address2: '', company: '', name: '',
    });
    expect(d.shipping.shipper).toMatchObject({ first_name: 'Franzi', street: 'Werkstraße', country_code: 'DE', email: 'versand@shop.example' });
    expect(d.mainitems).toHaveLength(1);
    expect(d.mainitems[0]).toMatchObject({ id: 'item1', type: 'white250', size: '70x100', filetype: 'pdf', designname: o.number });
    expect(d.mainitems[0].fileurl).toMatch(new RegExp(`^https://shop\\.example/api/print/${o.id}\\.\\d+\\.[\\w-]+\\.pdf$`));
    expect(d.accessory).toEqual([]);
    // Nothing else about the customer leaves the shop
    const sent = JSON.stringify(post.body);
    expect(sent).not.toContain(o.token);
    expect(sent).not.toContain('proofChecked');

    expect(after.partner).toBe('posterflow');
    expect(after.partner_status).toBe('submitted');
    expect(after.partner_order_id).toBe(`PF${o.number}`);
    expect(after.partner_submitted_at).not.toBeNull();
    expect(after.status).toBe('in_production');
  });

  it('uses the landscape size setting for landscape layouts', async () => {
    process.env.POSTERFLOW_SIZE = '70x100';
    process.env.POSTERFLOW_SIZE_LANDSCAPE = '100x70';
    handler = acceptingPosterflow;
    await pp.submitToPartner((await paidOrder('wochen')).id);
    await pp.submitToPartner((await paidOrder('spalten')).id);
    expect(posts().map((c) => c.body.data.mainitems[0].size)).toEqual(['100x70', '70x100']);
    delete process.env.POSTERFLOW_SIZE;
    delete process.env.POSTERFLOW_SIZE_LANDSCAPE;
  });

  it('never sends the same order twice', async () => {
    handler = acceptingPosterflow;
    const o = await paidOrder();
    const results = await Promise.allSettled([pp.submitToPartner(o.id), pp.submitToPartner(o.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(pp.submitToPartner(o.id)).rejects.toThrow();
    expect(posts()).toHaveLength(1);
  });

  it('adopts an order Posterflow already has instead of sending it again', async () => {
    const o = await paidOrder();
    handler = (c) => (c.method === 'GET' ? json([apiOrder(o.number)]) : json({ Error: 'should not post' }, 500));
    const after = await pp.submitToPartner(o.id);
    expect(posts()).toHaveLength(0);
    expect(after.partner_status).toBe('submitted');
  });

  it('after a timeout, checks Posterflow before sending again', async () => {
    const o = await paidOrder();
    handler = (c) => {
      if (c.method === 'POST') throw new DOMException('The operation timed out.', 'TimeoutError');
      return new Response('Not found', { status: 404 });
    };
    await expect(pp.submitToPartner(o.id)).rejects.toThrow('Keine eindeutige Antwort');
    let row = orders.getOrder(o.id)!;
    expect(row.partner_status).toBe('unknown');
    expect(row.status).toBe('paid');
    expect(row.partner_error).toContain('TimeoutError');

    // Posterflow did get it: the next attempt finds it and does not post.
    handler = (c) => (c.method === 'GET' ? json([apiOrder(o.number)]) : json({}, 500));
    await pp.submitToPartner(o.id);
    row = orders.getOrder(o.id)!;
    expect(row.partner_status).toBe('submitted');
    expect(posts()).toHaveLength(1);
  });

  it('after a timeout where Posterflow did not get it, sends once more', async () => {
    const o = await paidOrder();
    handler = (c) => (c.method === 'POST' ? Promise.reject(new DOMException('timeout', 'TimeoutError')) : new Response('Not found', { status: 404 }));
    await expect(pp.submitToPartner(o.id)).rejects.toThrow();
    handler = acceptingPosterflow;
    await pp.submitToPartner(o.id);
    expect(posts()).toHaveLength(2);
    expect(orders.getOrder(o.id)!.partner_status).toBe('submitted');
  });

  it('treats 408 and 409 as unknown and 400 as refused', async () => {
    const a = await paidOrder();
    handler = (c) => (c.method === 'POST' ? json({ Error: 'The order ID already exists or the system is temporarily busy', code: 'CONFLICT', retryable: true }, 409) : json([]));
    await expect(pp.submitToPartner(a.id)).rejects.toThrow();
    expect(orders.getOrder(a.id)!.partner_status).toBe('unknown');

    const b = await paidOrder();
    handler = (c) => (c.method === 'POST' ? json({ Error: 'DHL', code: 'TIMEOUT' }, 408) : json([]));
    await expect(pp.submitToPartner(b.id)).rejects.toThrow();
    expect(orders.getOrder(b.id)!.partner_status).toBe('unknown');

    const c = await paidOrder();
    handler = (call) => (call.method === 'POST' ? json({ Error: 'Unknown article', code: 'BAD_REQUEST', retryable: false }, 400) : json([]));
    await expect(pp.submitToPartner(c.id)).rejects.toThrow('abgelehnt');
    const row = orders.getOrder(c.id)!;
    expect(row.partner_status).toBe('failed');
    expect(row.partner_error).toContain('Unknown article (BAD_REQUEST)');
    expect(row.status).toBe('paid');
  });

  it('does not send when the lookup fails, and leaves the order sendable', async () => {
    const o = await paidOrder();
    handler = () => json({ Error: 'down' }, 503);
    await expect(pp.submitToPartner(o.id)).rejects.toThrow('nicht erreichbar');
    expect(posts()).toHaveLength(0);
    expect(orders.getOrder(o.id)!.partner_status).toBeNull();
  });

  it('refuses addresses without a house number and incomplete sender data', async () => {
    const o = orders.createOrder({ kind: 'planner', spec: defaultSpec(), customer: { ...customer, address: { ...customer.address, street: 'Am Markt' } }, consents });
    await orders.fulfilOrder(o.id);
    await expect(pp.submitToPartner(o.id)).rejects.toThrow('Hausnummer');
    expect(orders.getOrder(o.id)!.partner_error).toContain('Hausnummer');
    delete process.env.POSTERFLOW_SENDER_STREET;
    await expect(pp.submitToPartner((await paidOrder()).id)).rejects.toThrow('Absenderadresse');
    expect(calls).toHaveLength(0);
  });

  it('splits street and house number', () => {
    expect(pp.splitStreet('Straße des 17. Juni 135')).toEqual({ street: 'Straße des 17. Juni', number: '135' });
    expect(pp.splitStreet('Hauptstr. 3-5')).toEqual({ street: 'Hauptstr.', number: '3-5' });
    expect(pp.splitStreet('Weg 12 b')).toEqual({ street: 'Weg', number: '12b' });
    expect(pp.splitStreet('Am Markt')).toBeUndefined();
  });
});

describe('status', () => {
  it('maps the API order to progress', () => {
    const ref = 'PS-1';
    expect(pf.mapApiStatus(apiOrder(ref)).progress).toBe('submitted');
    expect(pf.mapApiStatus(apiOrder(ref, { completedat: '2026-11-13T12:00:00Z' })).progress).toBe('printed');
    expect(pf.mapApiStatus(apiOrder(ref, { shipping: [{ type: 'DHL', trackingid: '0034' }] }))).toMatchObject({ progress: 'label', tracking: '0034' });
    expect(pf.mapApiStatus(apiOrder(ref, { completedat: '2026-11-13T12:00:00Z', shipping: [{ trackingid: '0034', trackingurl: 'https://dhl.example/0034' }] }))).toMatchObject({
      progress: 'shipped',
      tracking: '0034',
      trackingUrl: 'https://dhl.example/0034',
      partnerOrderId: 'PFPS-1',
    });
  });

  it('polling marks the order shipped through the normal path, once', async () => {
    handler = acceptingPosterflow;
    const o = await paidOrder();
    await pp.submitToPartner(o.id);
    const log = vi.mocked(console.log);
    log.mockClear();
    handler = () => json([apiOrder(o.number, { completedat: '2026-11-13T12:00:00Z', shipping: [{ trackingid: '00340434498787103807' }] })]);
    await pp.pollPartnerOrders();
    const row = orders.getOrder(o.id)!;
    expect(row.status).toBe('shipped');
    expect(row.shipped_at).not.toBeNull();
    expect(row.tracking).toBe('00340434498787103807');
    expect(row.partner_status).toBe('shipped');
    const mails = () => log.mock.calls.filter((c) => String(c[0]).includes('Dein Planer ist unterwegs'));
    expect(mails()).toHaveLength(1);
    expect(String(mails()[0][0])).toContain('00340434498787103807');
    await pp.refreshPartnerStatus(o.id);
    expect(mails()).toHaveLength(1);
  });

  it('a manual refresh resolves an unknown submission', async () => {
    const o = await paidOrder();
    handler = (c) => (c.method === 'POST' ? json({ Error: 'busy' }, 502) : new Response('Not found', { status: 404 }));
    await expect(pp.submitToPartner(o.id)).rejects.toThrow();
    handler = () => json([apiOrder(o.number, { completedat: '2026-11-13T12:00:00Z' })]);
    expect((await pp.refreshPartnerStatus(o.id))!.partner_status).toBe('printed');
  });
});

describe('webhook', () => {
  const sign = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('hex');
  async function sent() {
    handler = acceptingPosterflow;
    const o = await paidOrder();
    await pp.submitToPartner(o.id);
    calls = [];
    return o;
  }

  it('verifies the signature', () => {
    expect(pf.verifyWebhookSignature('{"a":1}', sign('{"a":1}', 's3cret'), 's3cret')).toBe(true);
    expect(pf.verifyWebhookSignature('{"a":1}', sign('{"a":1}', 's3cret').toUpperCase(), 's3cret')).toBe(true);
    expect(pf.verifyWebhookSignature('{"a":2}', sign('{"a":1}', 's3cret'), 's3cret')).toBe(false);
    expect(pf.verifyWebhookSignature('{"a":1}', sign('{"a":1}', 'other'), 's3cret')).toBe(false);
    expect(pf.verifyWebhookSignature('{"a":1}', null, 's3cret')).toBe(false);
    expect(pf.verifyWebhookSignature('{"a":1}', 'zz', 's3cret')).toBe(false);
  });

  it('with a secret, rejects unsigned calls and applies signed ones', async () => {
    process.env.POSTERFLOW_WEBHOOK_SECRET = 'hook-secret';
    const o = await sent();
    const tracking = JSON.stringify({ External_orderid: o.number, orderid: 'TT1', status: 'tracking', trackingid: '00340434498787103876', trackingurl: 'https://dhl.example' });
    expect((await pp.handlePartnerWebhook(tracking, null)).status).toBe(401);
    expect((await pp.handlePartnerWebhook(tracking, sign(tracking, 'wrong'))).status).toBe(401);
    expect(orders.getOrder(o.id)!.partner_status).toBe('submitted');

    expect((await pp.handlePartnerWebhook(tracking, sign(tracking, 'hook-secret'))).status).toBe(200);
    let row = orders.getOrder(o.id)!;
    expect(row.partner_status).toBe('label');
    expect(row.tracking).toBe('00340434498787103876');
    expect(row.status).toBe('in_production');

    // Path-style delivery (/{External_orderid}/{event}) with a body that only has the status
    const shipped = JSON.stringify({ External_orderid: o.number, orderid: 'TT1', status: 'shipped' });
    expect((await pp.handlePartnerWebhook(shipped, sign(shipped, 'hook-secret'), [o.number, 'shipped'])).status).toBe(200);
    row = orders.getOrder(o.id)!;
    expect(row.status).toBe('shipped');
    expect(row.partner_status).toBe('shipped');
    expect(calls).toHaveLength(0);

    // A late "printed" does not move it back
    const printed = JSON.stringify({ External_orderid: o.number, status: 'printed' });
    await pp.handlePartnerWebhook(printed, sign(printed, 'hook-secret'));
    expect(orders.getOrder(o.id)!.partner_status).toBe('shipped');
  });

  it('records error events', async () => {
    process.env.POSTERFLOW_WEBHOOK_SECRET = 'hook-secret';
    const o = await sent();
    const body = JSON.stringify({ External_orderid: o.number, orderid: 'TT1', status: 'error', error: 'Label konnte nicht erstellt werden' });
    await pp.handlePartnerWebhook(body, sign(body, 'hook-secret'));
    const row = orders.getOrder(o.id)!;
    expect(row.partner_status).toBe('error');
    expect(row.partner_error).toContain('Label konnte nicht erstellt werden');
  });

  it('without a secret, only trusts what the API says', async () => {
    const o = await sent();
    handler = () => json([apiOrder(o.number)]);
    const forged = JSON.stringify({ External_orderid: o.number, status: 'shipped', trackingid: 'FAKE' });
    expect((await pp.handlePartnerWebhook(forged, null)).status).toBe(200);
    const row = orders.getOrder(o.id)!;
    expect(row.status).toBe('in_production');
    expect(row.tracking).toBeNull();
    expect(calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('ignores unknown orders', async () => {
    process.env.POSTERFLOW_WEBHOOK_SECRET = 'hook-secret';
    const body = JSON.stringify({ External_orderid: 'PS-1999-0001', status: 'shipped' });
    expect(await pp.handlePartnerWebhook(body, sign(body, 'hook-secret'))).toEqual({ status: 200, body: { ignored: true } });
  });
});

describe('print file link', () => {
  it('is signed, expires, and renders the PDF on request', async () => {
    const o = await paidOrder();
    const t0 = new Date('2026-11-13T10:00:00Z');
    const token = pp.printFileToken(o.id, t0);
    expect(pp.verifyPrintFileToken(token, t0)).toBe(o.id);
    expect(pp.verifyPrintFileToken(`${token}.pdf`, t0)).toBe(o.id);
    expect(pp.verifyPrintFileToken(token, new Date(t0.getTime() + 15 * 86_400_000))).toBeUndefined();
    const [id, exp, sig] = token.split('.');
    expect(pp.verifyPrintFileToken(`${id}.${Number(exp) + 999999}.${sig}`, t0)).toBeUndefined();
    expect(pp.verifyPrintFileToken(`${id}x.${exp}.${sig}`, t0)).toBeUndefined();
    expect(pp.verifyPrintFileToken(`${id}.${exp}.${sig.slice(0, -2)}AA`, t0)).toBeUndefined();

    const route = await import('../src/app/api/print/[file]/route');
    const ok = await route.GET(new Request('https://shop.example/x'), { params: Promise.resolve({ file: `${pp.printFileToken(o.id)}.pdf` }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await ok.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    const bad = await route.GET(new Request('https://shop.example/x'), { params: Promise.resolve({ file: 'nope.1.abc.pdf' }) });
    expect(bad.status).toBe(404);
  });

  it('cannot be made without a long enough secret', () => {
    process.env.PRINT_FILE_SECRET = 'short';
    expect(() => pp.printFileToken('abc')).toThrow('PRINT_FILE_SECRET');
    expect(pp.verifyPrintFileToken('abc.1.x')).toBeUndefined();
  });
});

describe('migration', () => {
  it('adds the partner columns to an existing database and keeps its rows', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'plana-pf-migrate-'));
    const old = new Database(path.join(dir, 'plana.sqlite'));
    old.exec(`CREATE TABLE orders (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, token TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, spec TEXT,
      amount_total INTEGER NOT NULL, amount_voucher INTEGER NOT NULL DEFAULT 0, amount_due INTEGER NOT NULL, voucher_code TEXT, email TEXT NOT NULL, name TEXT NOT NULL,
      address TEXT, consents TEXT NOT NULL, stripe_session_id TEXT, stripe_payment_intent TEXT, tracking TEXT, created_at TEXT NOT NULL, paid_at TEXT, shipped_at TEXT)`);
    old.prepare("INSERT INTO orders (id, number, token, kind, status, amount_total, amount_due, email, name, consents, created_at) VALUES ('old1', 'PS-2026-0001', 't', 'planner', 'paid', 9900, 9900, 'a@b.de', 'A B', '{}', '2026-11-01')").run();
    old.close();
    vi.resetModules();
    process.env.DATA_DIR = dir;
    const fresh = await import('../src/lib/db');
    const cols = (fresh.getDb().prepare("PRAGMA table_info('orders')").all() as { name: string }[]).map((c) => c.name);
    for (const c of ['keep_design', 'partner', 'partner_order_id', 'partner_status', 'partner_submitted_at', 'partner_checked_at', 'partner_error']) expect(cols).toContain(c);
    const row = fresh.getDb().prepare("SELECT * FROM orders WHERE id = 'old1'").get() as Record<string, unknown>;
    expect(row).toMatchObject({ number: 'PS-2026-0001', status: 'paid', partner_status: null });
    // Running it again is harmless
    fresh.getDb().close();
    vi.resetModules();
    const again = await import('../src/lib/db');
    expect((again.getDb().prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }).n).toBe(1);
  });
});
