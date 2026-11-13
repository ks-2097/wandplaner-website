import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/http';
import { handlePartnerWebhook } from '@/lib/print-partner';

/**
 * Status callbacks from Posterflow (tracking, printed, shipped, error). Give Posterflow
 * <SITE_URL>/api/posterflow/webhook. Their human docs append /{order}/{event}, their
 * OpenAPI says the URL is used as agreed; both arrive here.
 */
export async function POST(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  if (!rateLimit(`posterflow-hook:${clientIp(req)}`, 120, 60_000)) return NextResponse.json({ error: 'slow down' }, { status: 429 });
  const result = await handlePartnerWebhook(await req.text(), req.headers.get('x-posterflow-signature'), (await params).path ?? []);
  return NextResponse.json(result.body, { status: result.status });
}
