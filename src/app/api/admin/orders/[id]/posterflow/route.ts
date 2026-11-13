import { isAdmin } from '@/lib/admin';
import { OrderError } from '@/lib/orders';
import { refreshPartnerStatus, submitToPartner } from '@/lib/print-partner';
import { posterflowEnabled } from '@/lib/posterflow';

/**
 * Buttons in /admin: "An Posterflow senden" (action=send) and "Status aktualisieren"
 * (action=refresh). Errors are stored on the order and shown in the table, so this
 * always returns to /admin.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response('Nicht angemeldet', { status: 401 });
  if (!posterflowEnabled()) return new Response('Posterflow ist nicht eingerichtet', { status: 404 });
  const id = (await params).id;
  const action = String((await req.formData().catch(() => new FormData())).get('action') ?? '');
  try {
    if (action === 'send') await submitToPartner(id);
    else if (action === 'refresh') await refreshPartnerStatus(id);
    else return new Response('Unbekannte Aktion', { status: 400 });
  } catch (err) {
    // OrderError messages are already on the order; anything else is logged.
    if (!(err instanceof OrderError)) console.error('Posterflow action failed', id, err);
  }
  return new Response(null, { status: 303, headers: { location: '/admin' } });
}
