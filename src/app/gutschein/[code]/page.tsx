import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Page } from '@/components/Site';
import { euro } from '@/lib/config';
import { findVoucher } from '@/lib/orders';

export const metadata: Metadata = { title: 'Dein Gutschein', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function GutscheinCode({ params }: { params: Promise<{ code: string }> }) {
  const voucher = findVoucher(decodeURIComponent((await params).code));
  if (!voucher) notFound();
  return (
    <Page>
      <div className="wrap section-tight stack-lg">
        <div className="voucher-card">
          <p className="wordmark" style={{ color: 'var(--brand-aubergine)', fontSize: 28 }}><b>plana</b> <span>studio</span></p>
          <div>
            <p className="label" style={{ color: 'var(--brand-aubergine)' }}>Gutschein für einen Wandplaner</p>
            <p className="code">{voucher.code}</p>
          </div>
          <p>Dein Jahr als Bild: 70 × 100 cm, mit den Ferien deines Bundeslandes, euren Geburtstagen und in deinem Design. Einlösen auf plana-planer.de, beim Bestellen im Feld „Gutscheincode“.</p>
          <p className="small" style={{ color: 'var(--brand-ink)' }}>Guthaben: {euro(voucher.balance_cents)}{voucher.balance_cents < voucher.initial_cents ? ` von ${euro(voucher.initial_cents)}` : ''} · gültig drei Jahre ab Kauf</p>
        </div>
        <p className="no-print small">Diese Seite kannst du ausdrucken (Strg + P) oder den Link weitergeben. <Link href="/gestalten">Planer gestalten</Link></p>
      </div>
    </Page>
  );
}
