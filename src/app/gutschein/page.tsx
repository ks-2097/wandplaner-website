import type { Metadata } from 'next';
import { Page } from '@/components/Site';
import { VoucherForm } from '@/components/VoucherForm';
import { PRICES, config, euro } from '@/lib/config';

export const metadata: Metadata = { title: 'Gutschein', description: 'Verschenk einen Wandplaner von plana studio als Gutschein. Die Beschenkten gestalten ihn selbst.' };
export const dynamic = 'force-dynamic';

export default function Gutschein() {
  return (
    <Page>
      <div className="wrap section-tight split">
        <div className="stack">
          <p className="label">Gutschein</p>
          <h1 className="h1">Ein Jahr zum Verschenken</h1>
          <p className="lead">Ein Gutschein für einen Wandplaner, 70 × 100 cm, inklusive Versand. Die Beschenkten wählen Layout, Farben, Bundesland und Geburtstage selbst.</p>
          <ul className="prose">
            <li>Wert: {euro(PRICES.voucher)}, also genau ein Planer</li>
            <li>Kommt sofort per Mail, auch zum Ausdrucken</li>
            <li>Drei Jahre gültig, einlösbar an der Kasse</li>
          </ul>
        </div>
        <VoucherForm shopOpen={config.shopOpen} />
      </div>
    </Page>
  );
}
