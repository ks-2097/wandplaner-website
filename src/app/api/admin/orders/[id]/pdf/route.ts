import { buildScene, sanitizeSpec } from '@/planner';
import { renderPdf } from '@/planner/pdf';
import { isAdmin } from '@/lib/admin';
import { getOrder } from '@/lib/orders';

/** The print file of an order: trim size plus 3 mm bleed, fonts embedded. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response('Nicht angemeldet', { status: 401 });
  const order = getOrder((await params).id);
  if (!order?.spec) return new Response('Nicht gefunden', { status: 404 });
  const scene = buildScene(sanitizeSpec(JSON.parse(order.spec)));
  const pdf = await renderPdf(scene, { title: `plana studio ${order.number}` });
  return new Response(new Uint8Array(pdf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${order.number}_${scene.width / 10}x${scene.height / 10}cm_3mm-Beschnitt.pdf"`, 'cache-control': 'no-store' },
  });
}
