import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlannerSvg } from '@/components/PlannerSvg';
import { Page } from '@/components/Site';
import { euro } from '@/lib/config';
import { describeOrder, fulfilOrder, getOrder } from '@/lib/orders';
import { stripe, stripeReady } from '@/lib/stripe';
import { getDb, type VoucherRow } from '@/lib/db';
import type { PlannerSpec } from '@/planner';

export const metadata: Metadata = { title: 'Deine Bestellung', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS = { pending: 'Zahlung offen', paid: 'Bestellt', in_production: 'Im Druck', shipped: 'Versandt', cancelled: 'Storniert' } as const;

export default async function Bestellung({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; session_id?: string }> }) {
  const { id } = await params;
  const { t, session_id } = await searchParams;
  let order = getOrder(id);
  if (!order || order.token !== t) notFound();

  // Coming back from Stripe: confirm the payment here too, in case the webhook is slower than the browser.
  if (order.status === 'pending' && session_id && session_id === order.stripe_session_id && stripeReady()) {
    const session = await stripe().checkout.sessions.retrieve(session_id).catch(() => undefined);
    if (session?.payment_status === 'paid') order = (await fulfilOrder(order.id, { sessionId: session.id, paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id })) ?? order;
  }
  const voucher = order.kind === 'voucher' ? (getDb().prepare('SELECT * FROM vouchers WHERE order_id = ?').get(order.id) as VoucherRow | undefined) : undefined;

  return (
    <Page>
      <div className="wrap section-tight stack-lg">
        <div className="stack">
          <p><span className="label accent box">{STATUS[order.status]}</span></p>
          <h1 className="h1">{order.status === 'pending' ? 'Deine Zahlung ist noch offen' : `Danke, ${order.name.split(' ')[0]}.`}</h1>
          {order.status === 'pending' && <p className="lead">Sobald die Zahlung bei uns eingeht, bekommst du eine Bestätigung per Mail. Bei Lastschrift kann das ein paar Tage dauern.</p>}
          {order.status === 'paid' && order.kind === 'planner' && <p className="lead">Deine Bestellung ist bei uns. Wir drucken jetzt deinen Planer und schreiben dir, sobald er unterwegs ist.</p>}
          {order.status === 'in_production' && <p className="lead">Dein Planer wird gerade gedruckt.</p>}
          {order.status === 'shipped' && <p className="lead">Dein Planer ist unterwegs.{order.tracking ? ` Sendungsnummer: ${order.tracking}` : ''}</p>}
          {voucher && (
            <>
              <p className="lead">Dein Gutschein ist da. Wir haben ihn dir auch per Mail geschickt.</p>
              <p><Link className="btn" href={`/gutschein/${voucher.code}`}>Gutschein ansehen und drucken</Link></p>
            </>
          )}
        </div>
        <div className="split">
          <div className="stack">
            <h2 className="h2">Übersicht</h2>
            <pre className="plain">{describeOrder(order)}</pre>
            <p className="small">Gesamt: {euro(order.amount_total)} inkl. MwSt. Die Rechnung kommt per Mail von unserem Zahlungsdienst Stripe.</p>
          </div>
          {order.spec && <PlannerSvg spec={JSON.parse(order.spec) as PlannerSpec} label="Dein bestellter Planer" />}
        </div>
      </div>
    </Page>
  );
}
