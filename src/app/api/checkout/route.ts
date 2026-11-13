import { NextResponse } from 'next/server';
import { z } from 'zod';
import { config } from '@/lib/config';
import { clientIp, fail, rateLimit } from '@/lib/http';
import { OrderError, createOrder, fulfilOrder } from '@/lib/orders';
import { createCheckoutSession, stripeReady } from '@/lib/stripe';
import { getDb } from '@/lib/db';

const customer = z.object({ email: z.string().trim().email().max(200), name: z.string().trim().min(2).max(120) });
const address = z.object({ street: z.string().trim().min(3).max(160), zip: z.string().trim().regex(/^\d{5}$/), city: z.string().trim().min(2).max(100), country: z.literal('DE') });

const body = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('planner'),
    spec: z.unknown(),
    customer: customer.extend({ address }),
    voucherCode: z.string().max(40).optional(),
    consents: z.object({ proofChecked: z.literal(true), noWithdrawal: z.literal(true), terms: z.literal(true) }),
  }),
  z.object({ kind: z.literal('voucher'), customer, consents: z.object({ terms: z.literal(true) }) }),
]);

/** Places an order and returns where to send the customer next: Stripe, or the order page if a voucher covers everything. */
export async function POST(req: Request) {
  if (!config.shopOpen) return fail('Der Shop öffnet in Kürze. Trag dich in die Liste ein, dann schreiben wir dir.', 403);
  if (!rateLimit(`checkout:${clientIp(req)}`, 10, 10 * 60_000)) return fail('Zu viele Versuche. Bitte warte ein paar Minuten.', 429);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Bitte prüf deine Angaben: E-Mail, Name, Adresse und die Häkchen.');
  const b = parsed.data;
  try {
    const order =
      b.kind === 'planner'
        ? createOrder({ kind: 'planner', spec: b.spec, customer: b.customer, voucherCode: b.voucherCode || undefined, consents: b.consents })
        : createOrder({ kind: 'voucher', customer: b.customer, consents: { proofChecked: false, noWithdrawal: false, terms: true } });

    const orderUrl = `${config.siteUrl}/bestellung/${order.id}?t=${order.token}`;
    if (order.amount_due === 0) {
      await fulfilOrder(order.id);
      return NextResponse.json({ url: orderUrl });
    }
    if (!stripeReady()) return fail('Die Bezahlung ist noch nicht eingerichtet.', 503);
    const session = await createCheckoutSession(order);
    getDb().prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, order.id);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 422);
    if (error instanceof z.ZodError) return fail('Dein Entwurf konnte nicht gelesen werden. Bitte öffne den Konfigurator noch einmal.', 422);
    console.error('checkout', error);
    return fail('Die Bestellung konnte nicht angelegt werden. Versuch es bitte noch einmal.', 500);
  }
}
