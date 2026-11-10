import { randomBytes, randomInt } from 'node:crypto';
import { STATES, fromDayNumber, plannerRange, sanitizeSpec, LAYOUTS, MONTHS_DE, type PlannerSpec } from '@/planner';
import { PRICES, PRODUCT, config, euro } from './config';
import { getDb, now, type OrderRow, type VoucherRow } from './db';
import { sendMail } from './mail';

export type Address = { street: string; zip: string; city: string; country: 'DE' };
export type Customer = { email: string; name: string; address?: Address };

const id = () => randomBytes(9).toString('base64url');

function nextNumber(): string {
  const year = new Date().getFullYear();
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM orders WHERE number LIKE ?").get(`PS-${year}-%`) as { n: number };
  return `PS-${year}-${String(row.n + 1).padStart(4, '0')}`;
}

// Voucher codes avoid characters that are easy to confuse when read aloud or typed.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const voucherCode = () => 'PLANA-' + Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('') + '-' + Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export const normalizeCode = (code: string): string => code.trim().toUpperCase().replace(/\s+/g, '');

export function findVoucher(code: string): VoucherRow | undefined {
  return getDb().prepare('SELECT * FROM vouchers WHERE code = ?').get(normalizeCode(code)) as VoucherRow | undefined;
}

export function getOrder(orderId: string): OrderRow | undefined {
  return getDb().prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as OrderRow | undefined;
}

export function listOrders(): OrderRow[] {
  return getDb().prepare("SELECT * FROM orders WHERE status != 'pending' ORDER BY created_at DESC LIMIT 500").all() as OrderRow[];
}

export type Consents = { proofChecked: boolean; noWithdrawal: boolean; terms: boolean };

export function createOrder(input: { kind: 'planner'; spec: unknown; customer: Customer; voucherCode?: string; consents: Consents } | { kind: 'voucher'; customer: Customer; consents: Consents }): OrderRow {
  const total = input.kind === 'planner' ? PRICES.planner : PRICES.voucher;
  let spec: PlannerSpec | null = null;
  let voucher: VoucherRow | undefined;
  if (input.kind === 'planner') {
    spec = sanitizeSpec(input.spec);
    if (input.voucherCode) {
      voucher = findVoucher(input.voucherCode);
      if (!voucher || voucher.balance_cents <= 0) throw new OrderError('Dieser Gutscheincode ist nicht gültig oder schon eingelöst.');
    }
  }
  const discount = voucher ? Math.min(voucher.balance_cents, total) : 0;
  const row: OrderRow = {
    id: id(),
    number: nextNumber(),
    token: id(),
    kind: input.kind,
    status: 'pending',
    spec: spec ? JSON.stringify(spec) : null,
    amount_total: total,
    amount_voucher: discount,
    amount_due: total - discount,
    voucher_code: voucher?.code ?? null,
    email: input.customer.email,
    name: input.customer.name,
    address: input.customer.address ? JSON.stringify(input.customer.address) : null,
    consents: JSON.stringify({ ...input.consents, at: now() }),
    stripe_session_id: null,
    stripe_payment_intent: null,
    tracking: null,
    created_at: now(),
    paid_at: null,
    shipped_at: null,
  };
  getDb()
    .prepare(
      `INSERT INTO orders (id, number, token, kind, status, spec, amount_total, amount_voucher, amount_due, voucher_code, email, name, address, consents, created_at)
       VALUES (@id, @number, @token, @kind, @status, @spec, @amount_total, @amount_voucher, @amount_due, @voucher_code, @email, @name, @address, @consents, @created_at)`,
    )
    .run(row);
  return row;
}

export class OrderError extends Error {}

/**
 * Marks an order as paid, exactly once: books the voucher, issues a purchased voucher,
 * sends the mails. Safe to call from both the Stripe webhook and the return page.
 */
export async function fulfilOrder(orderId: string, payment: { sessionId?: string; paymentIntent?: string } = {}): Promise<OrderRow | undefined> {
  const db = getDb();
  let issued: string | undefined;
  const changed = db.transaction((): boolean => {
    const order = getOrder(orderId);
    if (!order || order.status !== 'pending') return false;
    db.prepare("UPDATE orders SET status = 'paid', paid_at = ?, stripe_session_id = COALESCE(?, stripe_session_id), stripe_payment_intent = ? WHERE id = ?").run(now(), payment.sessionId ?? null, payment.paymentIntent ?? null, orderId);
    if (order.voucher_code && order.amount_voucher > 0) {
      db.prepare('UPDATE vouchers SET balance_cents = MAX(0, balance_cents - ?) WHERE code = ?').run(order.amount_voucher, order.voucher_code);
      db.prepare('INSERT OR IGNORE INTO voucher_redemptions (code, order_id, amount_cents, created_at) VALUES (?, ?, ?, ?)').run(order.voucher_code, orderId, order.amount_voucher, now());
    }
    if (order.kind === 'voucher') {
      issued = voucherCode();
      db.prepare('INSERT INTO vouchers (code, initial_cents, balance_cents, order_id, created_at) VALUES (?, ?, ?, ?, ?)').run(issued, order.amount_total, order.amount_total, orderId, now());
    }
    return true;
  })();
  const order = getOrder(orderId);
  if (!changed || !order) return order;

  const statusUrl = `${config.siteUrl}/bestellung/${order.id}?t=${order.token}`;
  try {
    if (order.kind === 'voucher') {
      await sendMail(
        order.email,
        `Dein Gutschein von plana studio (${order.number})`,
        `Hallo ${order.name},\n\ndanke für deine Bestellung. Hier ist dein Gutschein für einen Wandplaner von plana studio:\n\n    ${issued}\n\nWert: ${euro(order.amount_total)}. Der Code wird an der Kasse auf plana-planer.de eingegeben und gilt drei Jahre.\nZum Ausdrucken und Verschenken: ${config.siteUrl}/gutschein/${issued}\n\nBestellnummer: ${order.number}\nBezahlt: ${euro(order.amount_due)}\n\nUnsere AGB und die Widerrufsbelehrung findest du unter ${config.siteUrl}/agb und ${config.siteUrl}/widerruf.\n\nplana studio\n${config.siteUrl}`,
      );
    } else {
      await sendMail(
        order.email,
        `Deine Bestellung bei plana studio (${order.number})`,
        `Hallo ${order.name},\n\ndanke für deine Bestellung. Wir drucken jetzt deinen Planer.\n\n${describeOrder(order)}\n\nDen Stand deiner Bestellung siehst du hier:\n${statusUrl}\n\nSobald der Planer unterwegs ist, bekommst du eine Mail mit der Sendungsnummer.\n\nDein Planer wird nach deinen Angaben gefertigt. Deshalb besteht kein Widerrufsrecht (§ 312g Abs. 2 Nr. 1 BGB). Unsere AGB findest du unter ${config.siteUrl}/agb.\n\nplana studio\n${config.siteUrl}`,
      );
    }
    if (config.orderNotifyEmail) await sendMail(config.orderNotifyEmail, `Neue Bestellung ${order.number} (${order.kind === 'voucher' ? 'Gutschein' : 'Planer'})`, `${describeOrder(order)}\n\n${config.siteUrl}/admin`);
  } catch (err) {
    // The order is paid either way; a failed mail must not undo it.
    console.error('Order mail failed', order.number, err);
  }
  return order;
}

export function describeSpec(spec: PlannerSpec): string {
  const { from, to } = plannerRange(spec);
  const a = fromDayNumber(from);
  const b = fromDayNumber(to);
  const layout = LAYOUTS.find((l) => l.id === spec.layout)!;
  return [
    `Layout: ${layout.name} (${layout.orientation === 'quer' ? 'Querformat' : 'Hochformat'})`,
    `Titel: ${spec.design.title.text}`,
    `Zeitraum: ${MONTHS_DE[a.m - 1]} ${a.y} bis ${MONTHS_DE[b.m - 1]} ${b.y}`,
    `Feiertage: ${spec.calendars.publicHolidays ? STATES[spec.state] : 'keine'}`,
    `Schulferien: ${spec.calendars.school.map((s) => STATES[s]).join(', ') || 'keine'}`,
    `Weitere Einträge: ${spec.events.length}`,
    `Geburtstage: ${spec.birthdays.length}`,
  ].join('\n');
}

export function describeOrder(order: OrderRow): string {
  const lines = [`Bestellnummer: ${order.number}`];
  if (order.kind === 'planner' && order.spec) {
    lines.push(`${PRODUCT.name}, ${PRODUCT.paper}`, describeSpec(JSON.parse(order.spec) as PlannerSpec));
    const a = order.address ? (JSON.parse(order.address) as Address) : undefined;
    if (a) lines.push(`Lieferung an: ${order.name}, ${a.street}, ${a.zip} ${a.city}`);
  } else lines.push('Gutschein für einen Wandplaner');
  lines.push(`Preis: ${euro(order.amount_total)} inkl. MwSt. und Versand`);
  if (order.amount_voucher) lines.push(`Gutschein ${order.voucher_code}: −${euro(order.amount_voucher)}`);
  lines.push(`Bezahlt: ${euro(order.amount_due)}`);
  return lines.join('\n');
}

export async function setOrderStatus(orderId: string, status: 'in_production' | 'shipped' | 'cancelled', tracking?: string): Promise<void> {
  const order = getOrder(orderId);
  if (!order) throw new OrderError('Bestellung nicht gefunden.');
  getDb().prepare('UPDATE orders SET status = ?, tracking = COALESCE(?, tracking), shipped_at = CASE WHEN ? = \'shipped\' THEN ? ELSE shipped_at END WHERE id = ?').run(status, tracking || null, status, now(), orderId);
  if (status === 'shipped' && order.status !== 'shipped')
    await sendMail(
      order.email,
      `Dein Planer ist unterwegs (${order.number})`,
      `Hallo ${order.name},\n\ndein Planer ist heute in den Versand gegangen. Er kommt in der Rolle.${tracking ? `\n\nSendungsnummer: ${tracking}` : ''}\n\nStand deiner Bestellung: ${config.siteUrl}/bestellung/${order.id}?t=${order.token}\n\nViel Freude damit.\n\nplana studio\n${config.siteUrl}`,
    ).catch((err) => console.error('Shipping mail failed', order.number, err));
}
