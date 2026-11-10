import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { Wordmark } from '@/components/Site';
import { checkPassword, isAdmin, signIn, signOut } from '@/lib/admin';
import { config, euro } from '@/lib/config';
import { rateLimit } from '@/lib/http';
import { describeSpec, listOrders, setOrderStatus } from '@/lib/orders';
import type { Address } from '@/lib/orders';
import type { PlannerSpec } from '@/planner';

export const metadata: Metadata = { title: 'Bestellungen', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS = { pending: 'Zahlung offen', paid: 'Neu', in_production: 'Im Druck', shipped: 'Versandt', cancelled: 'Storniert' } as const;

async function login(form: FormData) {
  'use server';
  // A handful of tries per address, so the password cannot be guessed by brute force.
  const ip = ((await headers()).get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  if (!rateLimit(`login:${ip}`, 8, 10 * 60_000)) return;
  if (checkPassword(String(form.get('password') ?? ''))) await signIn();
  revalidatePath('/admin');
}
async function logout() {
  'use server';
  await signOut();
  revalidatePath('/admin');
}
async function update(form: FormData) {
  'use server';
  if (!(await isAdmin())) return;
  const status = String(form.get('status'));
  if (status === 'in_production' || status === 'shipped' || status === 'cancelled') await setOrderStatus(String(form.get('id')), status, String(form.get('tracking') ?? '').trim().slice(0, 80) || undefined);
  revalidatePath('/admin');
}

export default async function Admin() {
  if (!(await isAdmin()))
    return (
      <main className="wrap section stack" style={{ maxWidth: 420 }}>
        <Wordmark />
        <h1 className="h2">Bestellungen</h1>
        {config.adminPassword ? (
          <form action={login} className="stack">
            <label className="field"><span className="label">Passwort</span><input className="input" type="password" name="password" autoComplete="current-password" required /></label>
            <button className="btn" type="submit">Anmelden</button>
          </form>
        ) : (
          <p>Setz zuerst ADMIN_PASSWORD in der Konfiguration des Servers.</p>
        )}
      </main>
    );

  const orders = listOrders();
  const open = orders.filter((o) => o.kind === 'planner' && (o.status === 'paid' || o.status === 'in_production')).length;
  return (
    <main className="wrap section-tight stack-lg" style={{ maxWidth: 1400 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          <Wordmark />
          <h1 className="h2">Bestellungen</h1>
          <p className="small">{orders.length} bezahlt · {open} zu drucken oder zu versenden</p>
        </div>
        <form action={logout}><button className="btn secondary small-btn" type="submit">Abmelden</button></form>
      </div>
      {orders.length === 0 ? (
        <p>Noch keine Bestellungen. Sobald jemand bezahlt hat, steht die Bestellung hier, mit der Druckdatei zum Herunterladen.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Nummer</th><th>Stand</th><th>Kundin / Kunde</th><th>Planer</th><th>Betrag</th><th>Druckdatei</th><th>Ändern</th></tr></thead>
            <tbody>
              {orders.map((o) => {
                const a = o.address ? (JSON.parse(o.address) as Address) : undefined;
                return (
                  <tr key={o.id}>
                    <td className="num">{o.number}<br /><span className="small">{new Date(o.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' })}</span></td>
                    <td><span className="label accent box">{STATUS[o.status]}</span>{o.tracking && <><br /><span className="small">{o.tracking}</span></>}</td>
                    <td>{o.name}<br /><a href={`mailto:${o.email}`}>{o.email}</a>{a && <><br /><span className="small">{a.street}, {a.zip} {a.city}</span></>}</td>
                    <td>{o.kind === 'voucher' ? 'Gutschein' : o.spec ? <pre className="plain">{describeSpec(JSON.parse(o.spec) as PlannerSpec)}</pre> : null}</td>
                    <td className="num">{euro(o.amount_due)}{o.amount_voucher > 0 && <><br /><span className="small">+ {euro(o.amount_voucher)} Gutschein</span></>}</td>
                    <td>{o.spec ? <><a href={`/api/admin/orders/${o.id}/pdf`}>PDF laden</a><br /><a className="small" href={`/bestellung/${o.id}?t=${o.token}`}>Kundenansicht</a></> : '–'}</td>
                    <td>
                      {o.kind === 'planner' && o.status !== 'cancelled' && (
                        <form action={update} className="row">
                          <input type="hidden" name="id" value={o.id} />
                          <select className="input" name="status" defaultValue={o.status === 'paid' ? 'in_production' : 'shipped'} aria-label="Neuer Stand" style={{ width: 150 }}>
                            <option value="in_production">Im Druck</option>
                            <option value="shipped">Versandt (Mail an Kunden)</option>
                            <option value="cancelled">Storniert</option>
                          </select>
                          <input className="input" name="tracking" placeholder="Sendungsnummer" defaultValue={o.tracking ?? ''} aria-label="Sendungsnummer" style={{ width: 170 }} />
                          <button className="btn secondary small-btn" type="submit">Speichern</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
