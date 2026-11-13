import { buildScene, sanitizeSpec } from '@/planner';
import { renderPdf } from '@/planner/pdf';
import { getOrder } from '@/lib/orders';
import { verifyPrintFileToken } from '@/lib/print-partner';

/**
 * Print file for the print partner, who downloads it from the URL in the order.
 * The link is signed (PRINT_FILE_SECRET) and expires; the PDF is rendered on request
 * and never stored.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const orderId = verifyPrintFileToken((await params).file);
  const order = orderId ? getOrder(orderId) : undefined;
  if (!order?.spec || order.kind !== 'planner' || order.status === 'cancelled' || order.status === 'pending') return new Response('Nicht gefunden', { status: 404 });
  const scene = buildScene(sanitizeSpec(JSON.parse(order.spec)));
  // Posterflow prints the page as delivered ("Endformat = Druckformat", no bleed), so this file is the trim size exactly.
  const pdf = await renderPdf(scene, { bleed: 0, title: `plana studio ${order.number}` });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${order.number}.pdf"`,
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex',
    },
  });
}
