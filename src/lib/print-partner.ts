import { createHmac, timingSafeEqual } from 'node:crypto';
import { LAYOUTS, type PlannerSpec } from '@/planner';
import { config } from './config';
import { getDb, now, type OrderRow } from './db';
import { getOrder, OrderError, setOrderStatus, type Address } from './orders';
import { getPrintPartner, PartnerError, posterflowConfig, verifyWebhookSignature, WEBHOOK_EVENTS, type PartnerProgress, type PrintJob } from './posterflow';

/**
 * Hand-off of paid orders to the print partner: send, look up, apply status updates.
 * Shipping goes through setOrderStatus, so the shipping mail and the deletion schedule
 * work exactly as when the owner sets "Versandt" by hand.
 *
 * partner_status values:
 *   submitting  request in flight (a stale one may be retried)
 *   unknown     no clear answer; the next attempt looks the order up before sending
 *   failed      the partner refused it, nothing was created; can be sent again
 *   submitted, printed, label, shipped   progress reported by the partner
 *   error       the partner reported a processing problem
 */
export type PartnerState = 'submitting' | 'unknown' | 'failed' | 'error' | PartnerProgress;

const RANK: Record<string, number> = { submitted: 1, printed: 2, label: 3, shipped: 4 };
const STALE_SUBMIT_MS = 10 * 60_000;

// ---- Print file URL (signed, expiring, no login)

const fileSecret = (): string => process.env.PRINT_FILE_SECRET?.trim() ?? '';
const fileDays = (): number => Number(process.env.PRINT_FILE_URL_DAYS) || 14;
const sign = (orderId: string, exp: number): string => createHmac('sha256', fileSecret()).update(`print-file-v1:${orderId}:${exp}`).digest('base64url');

export function printFileToken(orderId: string, at = new Date()): string {
  if (fileSecret().length < 32) throw new OrderError('PRINT_FILE_SECRET fehlt oder ist kürzer als 32 Zeichen.');
  const exp = Math.floor(at.getTime() / 1000) + fileDays() * 86_400;
  return `${orderId}.${exp}.${sign(orderId, exp)}`;
}

export const printFileUrl = (orderId: string, at = new Date()): string => `${config.siteUrl}/api/print/${printFileToken(orderId, at)}.pdf`;

/** The order id when the token is genuine and not expired, otherwise undefined. */
export function verifyPrintFileToken(token: string, at = new Date()): string | undefined {
  if (fileSecret().length < 32) return undefined;
  const [orderId, expText, sig, ...rest] = token.replace(/\.pdf$/, '').split('.');
  const exp = Number(expText);
  if (rest.length || !orderId || !sig || !Number.isInteger(exp) || exp * 1000 < at.getTime()) return undefined;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(orderId, exp));
  return a.length === b.length && timingSafeEqual(a, b) ? orderId : undefined;
}

// ---- Building the job

/** "Musterstraße 12a" -> street + house number, as DHL needs them separately. */
export function splitStreet(line: string): { street: string; number: string } | undefined {
  const m = line.trim().match(/^(.+?)\s*(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)$/);
  return m && m[1].trim() ? { street: m[1].trim().replace(/,$/, ''), number: m[2].replace(/\s+/g, '') } : undefined;
}

export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] } : { firstName: '', lastName: parts[0] ?? '' };
}

function eligibilityProblem(order: OrderRow): string | undefined {
  if (order.kind !== 'planner') return 'Nur Planer werden gedruckt.';
  if (order.status !== 'paid') return 'Nur neue, bezahlte Bestellungen können gesendet werden.';
  if (!order.spec) return 'Das Design ist gelöscht.';
  if (!order.address) return 'Die Bestellung hat keine Lieferadresse.';
}

export function buildPrintJob(order: OrderRow, at = new Date()): PrintJob {
  const problem = eligibilityProblem(order);
  if (problem) throw new OrderError(problem);
  const address = JSON.parse(order.address!) as Address;
  const street = splitStreet(address.street);
  if (!street) throw new OrderError(`Hausnummer in „${address.street}“ nicht erkannt. Bitte von Hand an Posterflow senden.`);
  const shipper = posterflowConfig().shipper;
  const missing = (['first_name', 'last_name', 'street', 'street_number', 'zip', 'city', 'email'] as const).filter((k) => !shipper[k]);
  if (missing.length) throw new OrderError(`Absenderadresse unvollständig (POSTERFLOW_SENDER_*: ${missing.join(', ')}).`);
  const spec = JSON.parse(order.spec!) as PlannerSpec;
  const orientation = LAYOUTS.find((l) => l.id === spec.layout)?.orientation === 'hoch' ? 'portrait' : 'landscape';
  return {
    reference: order.number,
    // Only what the parcel needs: name, address, and the email Posterflow's schema requires
    recipient: { ...splitName(order.name), street: street.street, streetNumber: street.number, zip: address.zip, city: address.city, countryCode: address.country, email: order.email },
    file: { url: printFileUrl(order.id, at), type: 'pdf' },
    orientation,
    designName: order.number,
  };
}

// ---- State changes

/** Records an error; with a status (also null) the partner status is set as well. */
function setPartnerError(orderId: string, message: string, status?: PartnerState | null): void {
  const params = { message: message.slice(0, 500), at: now(), id: orderId };
  if (status === undefined) getDb().prepare('UPDATE orders SET partner_error = @message, partner_checked_at = @at WHERE id = @id').run(params);
  else getDb().prepare('UPDATE orders SET partner_error = @message, partner_checked_at = @at, partner_status = @status WHERE id = @id').run({ ...params, status });
}

/**
 * Applies a progress report. Never goes backwards; marks the order "Im Druck" once the
 * partner has it and "Versandt" (with the customer mail) when it ships.
 */
export async function applyPartnerProgress(orderId: string, report: { progress: PartnerProgress; partnerOrderId?: string; tracking?: string }): Promise<void> {
  const order = getOrder(orderId);
  if (!order) return;
  const current = RANK[order.partner_status ?? ''] ?? 0;
  const next = RANK[report.progress] > current ? report.progress : (order.partner_status as PartnerProgress);
  const db = getDb();
  db.prepare(
    `UPDATE orders SET partner_status = ?, partner_order_id = COALESCE(?, partner_order_id), partner_submitted_at = COALESCE(partner_submitted_at, ?),
       partner_checked_at = ?, partner_error = NULL WHERE id = ?`,
  ).run(next, report.partnerOrderId || null, now(), now(), orderId);
  if (report.tracking && !order.tracking) db.prepare('UPDATE orders SET tracking = ? WHERE id = ?').run(report.tracking.slice(0, 80), orderId);
  if (order.status === 'cancelled' || order.status === 'shipped') return;
  if (next === 'shipped') await setOrderStatus(orderId, 'shipped', report.tracking || order.tracking || undefined);
  else if (order.status === 'paid') await setOrderStatus(orderId, 'in_production');
}

/**
 * Sends a paid order to the print partner, at most once. Every attempt first asks the
 * partner whether it already has our reference, so a lost answer to an earlier attempt
 * never leads to a second print.
 */
export async function submitToPartner(orderId: string, at = new Date()): Promise<OrderRow> {
  const partner = getPrintPartner();
  if (!partner) throw new OrderError('Kein Druckpartner eingerichtet.');
  const order = getOrder(orderId);
  if (!order) throw new OrderError('Bestellung nicht gefunden.');
  let job: PrintJob;
  try {
    job = buildPrintJob(order, at);
  } catch (err) {
    if (err instanceof OrderError && !order.partner_status) setPartnerError(orderId, err.message);
    throw err;
  }

  // Claim the order: only one attempt at a time, never after the partner accepted it.
  const claimed = getDb()
    .prepare(
      `UPDATE orders SET partner = ?, partner_status = 'submitting', partner_checked_at = ?
       WHERE id = ? AND status = 'paid' AND (partner_status IS NULL OR partner_status IN ('failed', 'unknown') OR (partner_status = 'submitting' AND partner_checked_at < ?))`,
    )
    .run(partner.id, now(), orderId, new Date(Date.now() - STALE_SUBMIT_MS).toISOString()).changes;
  if (!claimed) throw new OrderError('Diese Bestellung wird gerade gesendet oder liegt schon bei Posterflow.');
  const previous = (order.partner_status as PartnerState | null) ?? null;

  try {
    const existing = await partner.getStatus(job.reference);
    if (existing) {
      await applyPartnerProgress(orderId, existing);
      return getOrder(orderId)!;
    }
  } catch (err) {
    // Nothing was sent in this attempt; go back to where we were.
    setPartnerError(orderId, `Vorabprüfung bei Posterflow fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`, previous);
    throw new OrderError('Posterflow ist gerade nicht erreichbar. Bitte später noch einmal senden.');
  }

  try {
    const status = await partner.submit(job);
    await applyPartnerProgress(orderId, status);
    return getOrder(orderId)!;
  } catch (err) {
    if (err instanceof PartnerError && err.kind === 'rejected') {
      setPartnerError(orderId, err.message, 'failed');
      throw new OrderError(`Posterflow hat den Auftrag abgelehnt: ${err.message}`);
    }
    setPartnerError(orderId, `${err instanceof Error ? err.message : String(err)}. Ob Posterflow den Auftrag hat, ist unklar; „Status aktualisieren“ prüft das.`, 'unknown');
    throw new OrderError('Keine eindeutige Antwort von Posterflow. Bitte „Status aktualisieren“, bevor erneut gesendet wird.');
  }
}

/** Asks the partner for the current state of a sent order. */
export async function refreshPartnerStatus(orderId: string): Promise<OrderRow | undefined> {
  const partner = getPrintPartner();
  const order = getOrder(orderId);
  if (!partner || !order?.partner_status) return order;
  try {
    const status = await partner.getStatus(order.number);
    if (status) await applyPartnerProgress(orderId, status);
    else if (order.partner_status === 'unknown' || order.partner_status === 'submitting' || order.partner_status === 'failed')
      setPartnerError(orderId, 'Posterflow kennt den Auftrag nicht. Er kann gesendet werden.', order.partner_status === 'submitting' ? 'unknown' : undefined);
    else setPartnerError(orderId, 'Posterflow hat zu dieser Bestellnummer keinen Auftrag gefunden.');
  } catch (err) {
    setPartnerError(orderId, `Status nicht abrufbar: ${err instanceof Error ? err.message : String(err)}`);
  }
  return getOrder(orderId);
}

/** Six-hourly job: brings every open hand-off up to date. */
export async function pollPartnerOrders(): Promise<number> {
  if (!getPrintPartner()) return 0;
  const open = getDb()
    .prepare("SELECT id FROM orders WHERE partner_status IN ('submitting', 'unknown', 'submitted', 'printed', 'label', 'error') AND status NOT IN ('shipped', 'cancelled')")
    .all() as { id: string }[];
  for (const { id } of open) await refreshPartnerStatus(id);
  return open.length;
}

export type WebhookResult = { status: number; body: Record<string, unknown> };

/**
 * Status callback from Posterflow. With POSTERFLOW_WEBHOOK_SECRET set, only signed calls
 * are accepted and their content is used. Without it the call is only a hint: we fetch
 * the status from the API ourselves, so a forged call cannot mark an order shipped.
 */
export async function handlePartnerWebhook(rawBody: string, signature: string | null, pathParts: string[] = []): Promise<WebhookResult> {
  if (!getPrintPartner()) return { status: 404, body: { error: 'not configured' } };
  const secret = posterflowConfig().webhookSecret;
  const trusted = Boolean(secret);
  if (trusted && !verifyWebhookSignature(rawBody, signature, secret)) return { status: 401, body: { error: 'bad signature' } };
  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    if (trusted) return { status: 400, body: { error: 'bad json' } };
  }
  const reference = String(payload.External_orderid ?? pathParts[0] ?? '');
  const event = String(payload.status ?? pathParts[1] ?? '');
  const row = reference ? (getDb().prepare('SELECT id, tracking FROM orders WHERE number = ? AND partner_status IS NOT NULL').get(reference) as { id: string; tracking: string | null } | undefined) : undefined;
  if (!row) return { status: 200, body: { ignored: true } };

  if (!trusted) {
    await refreshPartnerStatus(row.id);
    return { status: 200, body: { received: true } };
  }
  if (event === 'error') {
    const order = getOrder(row.id)!;
    setPartnerError(row.id, `Posterflow meldet: ${String(payload.error ?? 'Fehler ohne Beschreibung')}`, order.partner_status === 'shipped' ? undefined : 'error');
    return { status: 200, body: { received: true } };
  }
  const progress = WEBHOOK_EVENTS[event];
  if (!progress) return { status: 200, body: { ignored: true } };
  let tracking = payload.trackingid ? String(payload.trackingid) : undefined;
  // A "shipped" call may come without the number; it arrived earlier or is in the API.
  if (progress === 'shipped' && !tracking && !row.tracking) {
    try {
      tracking = (await getPrintPartner()!.getStatus(reference))?.tracking;
    } catch {
      /* ship without a number rather than not at all */
    }
  }
  await applyPartnerProgress(row.id, { progress, tracking, partnerOrderId: payload.orderid ? String(payload.orderid) : undefined });
  return { status: 200, body: { received: true } };
}
