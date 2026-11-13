import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { getPrintPartner, posterflowConfig } from '@/lib/posterflow';

/** What Posterflow offers for our key, to check POSTERFLOW_ARTICLE_TYPE and POSTERFLOW_SIZE. */
export async function GET() {
  if (!(await isAdmin())) return new Response('Nicht angemeldet', { status: 401 });
  const partner = getPrintPartner();
  if (!partner) return new Response('Posterflow ist nicht eingerichtet', { status: 404 });
  const { articleType, size, sizeLandscape } = posterflowConfig();
  try {
    return NextResponse.json({ configured: { articleType, size, sizeLandscape }, articles: await partner.listArticles() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
