'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LAYOUTS, MONTHS_DE, REGIONAL_HOLIDAYS, STATES, buildScene, fromDayNumber, plannerRange, renderSvg, type PlannerSpec } from '@/planner';
import { loadDraft } from './draft';
import { Waitlist } from './Waitlist';

const euro = (cents: number) => `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: cents % 100 ? 2 : 0 })} €`;

export function Checkout({ shopOpen, price, lastOrderDate }: { shopOpen: boolean; price: number; lastOrderDate: string }) {
  const [spec, setSpec] = useState<PlannerSpec | null | undefined>(undefined);
  const [zoom, setZoom] = useState(false);
  const [voucher, setVoucher] = useState<{ code: string; balance: number } | null>(null);
  const [code, setCode] = useState('');
  const [voucherMsg, setVoucherMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setSpec(loadDraft()?.spec ?? null), []);
  const scene = useMemo(() => (spec ? buildScene(spec) : null), [spec]);
  const svg = useMemo(() => (scene ? renderSvg(scene, { title: 'Druckvorschau deines Planers', className: 'planner' }) : ''), [scene]);

  if (spec === undefined) return <div className="wrap section"><p>Dein Entwurf wird geladen …</p></div>;
  if (!spec || !scene)
    return (
      <div className="wrap section stack">
        <h1 className="h1">Noch kein Entwurf</h1>
        <p>In diesem Browser liegt noch kein Planer. Gestalte zuerst deinen Planer, dann geht es hier weiter.</p>
        <p><Link className="btn" href="/gestalten">Planer gestalten</Link></p>
      </div>
    );

  const range = plannerRange(spec);
  const [a, b] = [fromDayNumber(range.from), fromDayNumber(range.to)];
  const layout = LAYOUTS.find((l) => l.id === spec.layout)!;
  const discount = voucher ? Math.min(voucher.balance, price) : 0;
  const due = price - discount;

  async function redeem() {
    setVoucherMsg('');
    const res = await fetch('/api/voucher', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) }).catch(() => undefined);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setVoucher(null);
      return setVoucherMsg(data.error ?? 'Der Code konnte nicht geprüft werden.');
    }
    setVoucher(data);
    setVoucherMsg(`Gutschein über ${euro(data.balance)} wird verrechnet.`);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    const body = {
      kind: 'planner',
      spec,
      voucherCode: voucher?.code,
      customer: { email: f.get('email'), name: f.get('name'), address: { street: f.get('street'), zip: f.get('zip'), city: f.get('city'), country: 'DE' } },
      consents: { proofChecked: f.get('proof') === 'on', noWithdrawal: f.get('withdrawal') === 'on', terms: f.get('terms') === 'on' },
    };
    const res = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => undefined);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && data.url) return void (window.location.href = data.url);
    setError(data.error ?? 'Die Bestellung konnte nicht abgeschickt werden. Bitte prüf deine Verbindung und versuch es noch einmal.');
    setBusy(false);
  }

  return (
    <div className="wrap section-tight stack-lg">
      <div className="stack">
        <p className="label">Schritt 2 von 2</p>
        <h1 className="h1">Prüfen und bestellen</h1>
        <p className="lead">So wird dein Planer gedruckt. Schau dir Titel, Namen und Daten in Ruhe an, am besten vergrößert.</p>
      </div>

      <div className="stack">
        <div className={`viewer${zoom ? ' zoomed' : ''}${scene.height > scene.width ? ' portrait' : ''}`} onClick={() => setZoom((z) => !z)}>
          <div className="sheet" style={{ aspectRatio: `${scene.width} / ${scene.height}` }} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <div className="caption">
          <span className="label">Druckvorschau · {scene.width / 10} × {scene.height / 10} cm</span>
          <span>
            <button type="button" className="linkbtn" onClick={() => setZoom((z) => !z)}>{zoom ? 'Ganzes Blatt zeigen' : 'Details vergrößern'}</button>{' · '}
            <Link href="/gestalten">Noch etwas ändern</Link>
          </span>
        </div>
        {scene.notes.length > 0 && <div className="note">{scene.notes.map((n) => <p key={n}>{n}</p>)}</div>}
      </div>

      <div className="split">
        <div className="stack">
          <h2 className="h2">Dein Planer</h2>
          <dl className="kv">
            <dt>Format</dt><dd>{scene.width / 10} × {scene.height / 10} cm, {layout.orientation === 'quer' ? 'Querformat' : 'Hochformat'}, Premiumpapier matt</dd>
            <dt>Layout</dt><dd>{layout.name}</dd>
            <dt>Titel</dt><dd>{spec.design.title.text}</dd>
            <dt>Zeitraum</dt><dd>{a.d}. {MONTHS_DE[a.m - 1]} {a.y} bis {b.d}. {MONTHS_DE[b.m - 1]} {b.y}</dd>
            <dt>Feiertage</dt><dd>{spec.calendars.publicHolidays ? [STATES[spec.state], ...REGIONAL_HOLIDAYS.filter((h) => spec.calendars.regional?.includes(h.id)).map((h) => `mit ${h.name}`)].join(', ') : 'keine'}</dd>
            <dt>Schulferien</dt><dd>{spec.calendars.school.map((s) => STATES[s]).join(', ') || 'keine'}</dd>
            <dt>Weitere Einträge</dt><dd>{spec.events.length}</dd>
            <dt>Geburtstage</dt><dd>{spec.birthdays.length ? spec.birthdays.map((x) => `${x.name} (${x.day}.${x.month}.)`).join(', ') : 'keine'}</dd>
          </dl>
          <table className="table">
            <tbody>
              <tr><td>Wandplaner, nach deinen Angaben gefertigt</td><td className="num" style={{ textAlign: 'right' }}>{euro(price)}</td></tr>
              <tr><td>Versand in Deutschland, in der Rolle</td><td className="num" style={{ textAlign: 'right' }}>inklusive</td></tr>
              {discount > 0 && <tr><td>Gutschein {voucher!.code}</td><td className="num" style={{ textAlign: 'right' }}>−{euro(discount)}</td></tr>}
              <tr><td><strong>Gesamt inkl. MwSt.</strong></td><td className="num" style={{ textAlign: 'right' }}><strong>{euro(due)}</strong></td></tr>
            </tbody>
          </table>
          <div className="stack">
            <label className="field">
              <span className="label">Gutscheincode</span>
              <div className="row">
                <input className="input grow" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PLANA-XXXX-XXXX" autoComplete="off" />
                <button type="button" className="btn secondary small-btn" onClick={redeem} disabled={code.trim().length < 6}>Einlösen</button>
              </div>
            </label>
            {voucherMsg && <p className="status" role="status" data-tone={voucher ? 'ok' : 'error'}>{voucherMsg}</p>}
          </div>
        </div>

        {shopOpen ? (
          <form className="panel stack" onSubmit={submit}>
            <h2 className="h2">Lieferadresse</h2>
            <label className="field"><span className="label">Vor- und Nachname</span><input className="input" name="name" autoComplete="name" required minLength={2} /></label>
            <label className="field"><span className="label">E-Mail-Adresse</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
            <label className="field"><span className="label">Straße und Hausnummer</span><input className="input" name="street" autoComplete="street-address" required minLength={3} /></label>
            <div className="row">
              <label className="field" style={{ width: 120 }}><span className="label">PLZ</span><input className="input num" name="zip" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" required /></label>
              <label className="field grow"><span className="label">Ort</span><input className="input" name="city" autoComplete="address-level2" required minLength={2} /></label>
            </div>
            <p className="small">Wir liefern innerhalb Deutschlands. Bestellungen bis {lastOrderDate} kommen vor Weihnachten an.</p>
            <label className="check"><input type="checkbox" name="proof" required /><span>Ich habe die Vorschau geprüft: Titel, Namen und Daten stimmen so.</span></label>
            <label className="check"><input type="checkbox" name="withdrawal" required /><span>Mir ist bekannt, dass der Planer nach meinen Angaben gefertigt wird und deshalb kein Widerrufsrecht besteht (<Link href="/widerruf" target="_blank">Widerruf</Link>).</span></label>
            <label className="check"><input type="checkbox" name="terms" required /><span>Ich habe die <Link href="/agb" target="_blank">AGB</Link> und die <Link href="/datenschutz" target="_blank">Datenschutzerklärung</Link> gelesen.</span></label>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Einen Moment …' : 'Zahlungspflichtig bestellen'}</button>
            <p className="small">{due > 0 ? 'Du bezahlst im nächsten Schritt sicher über Stripe: mit Karte, PayPal, Klarna, Apple Pay oder Lastschrift.' : 'Dein Gutschein deckt den ganzen Betrag. Es ist keine Zahlung nötig.'}</p>
            {error && <p className="status" role="alert" data-tone="error">{error}</p>}
          </form>
        ) : (
          <div className="stack">
            <h2 className="h2">Bestellen geht ab Ende November</h2>
            <p>Dein Entwurf bleibt in diesem Browser gespeichert. Trag dich ein, dann schreiben wir dir, sobald du bestellen kannst.</p>
            <Waitlist />
          </div>
        )}
      </div>
    </div>
  );
}
