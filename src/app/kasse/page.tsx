import type { Metadata } from 'next';
import { Checkout } from '@/components/Checkout';
import { Page } from '@/components/Site';
import { PRICES, PRODUCT, config } from '@/lib/config';

export const metadata: Metadata = { title: 'Prüfen und bestellen', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function Kasse() {
  return (
    <Page>
      <Checkout shopOpen={config.shopOpen} price={PRICES.planner} lastOrderDate={PRODUCT.lastOrderDate} />
    </Page>
  );
}
