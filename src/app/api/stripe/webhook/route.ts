import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { config } from '@/lib/config';
import { fulfilOrder } from '@/lib/orders';
import { stripe } from '@/lib/stripe';

/**
 * Stripe tells us here when a payment went through. Set the endpoint in the Stripe
 * dashboard to <SITE_URL>/api/stripe/webhook with the events
 * checkout.session.completed and checkout.session.async_payment_succeeded.
 */
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  if (!signature || !config.stripeWebhookSecret) return NextResponse.json({ error: 'not configured' }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, config.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    // Delayed methods (SEPA, some Klarna flows) complete the session before the money arrives.
    if (orderId && session.payment_status === 'paid')
      await fulfilOrder(orderId, { sessionId: session.id, paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id });
  }
  return NextResponse.json({ received: true });
}
