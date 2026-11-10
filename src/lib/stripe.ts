import Stripe from 'stripe';
import { PRODUCT, config } from './config';
import type { OrderRow } from './db';

let client: Stripe | undefined;
export const stripe = (): Stripe => (client ??= new Stripe(config.stripeSecretKey));
export const stripeReady = (): boolean => !!config.stripeSecretKey;

/** Creates the hosted payment page for an order and returns its URL. */
export async function createCheckoutSession(order: OrderRow): Promise<{ id: string; url: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    locale: 'de',
    customer_email: order.email,
    client_reference_id: order.id,
    metadata: { order_id: order.id, order_number: order.number },
    payment_intent_data: { description: `plana studio ${order.number}`, metadata: { order_id: order.id, order_number: order.number } },
    // Stripe issues the invoice and mails it to the customer.
    invoice_creation: { enabled: true, invoice_data: { description: `Bestellung ${order.number}`, metadata: { order_id: order.id } } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: order.amount_due,
          product_data:
            order.kind === 'voucher'
              ? { name: 'Gutschein für einen Wandplaner', description: 'plana studio, einlösbar auf plana-planer.de' }
              : { name: PRODUCT.name, description: `${PRODUCT.paper}, nach deinen Angaben gefertigt${order.amount_voucher ? ', Gutschein verrechnet' : ''}. Versand in Deutschland inklusive.` },
        },
      },
    ],
    success_url: `${config.siteUrl}/bestellung/${order.id}?t=${order.token}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteUrl}/${order.kind === 'voucher' ? 'gutschein' : 'kasse'}?abgebrochen=1`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  if (!session.url) throw new Error('Stripe returned no checkout URL');
  return { id: session.id, url: session.url };
}
