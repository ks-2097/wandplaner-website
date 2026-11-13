'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Waitlist } from './Waitlist';

export function VoucherForm({ shopOpen }: { shopOpen: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!shopOpen)
    return (
      <div className="stack">
        <p>Gutscheine gibt es ab Ende November. Trag dich ein, dann schreiben wir dir zum Start.</p>
        <Waitlist />
      </div>
    );

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'voucher', customer: { email: f.get('email'), name: f.get('name') }, consents: { terms: f.get('terms') === 'on' } }),
    }).catch(() => undefined);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && data.url) return void (window.location.href = data.url);
    setError(data.error ?? 'Die Bestellung konnte nicht abgeschickt werden. Bitte versuch es noch einmal.');
    setBusy(false);
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <label className="field"><span className="label">Dein Name</span><input className="input" name="name" autoComplete="name" required minLength={2} /></label>
      <label className="field"><span className="label">Deine E-Mail-Adresse</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
      <p className="small">Der Gutschein kommt sofort per Mail zu dir, als Code und als Seite zum Ausdrucken.</p>
      <label className="check"><input type="checkbox" name="terms" required /><span>Ich habe die <Link href="/agb" target="_blank">AGB</Link>, die <Link href="/widerruf" target="_blank">Widerrufsbelehrung</Link> und die <Link href="/datenschutz" target="_blank">Datenschutzerklärung</Link> gelesen.</span></label>
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Einen Moment …' : 'Zahlungspflichtig bestellen'}</button>
      {error && <p className="status" role="alert" data-tone="error">{error}</p>}
    </form>
  );
}
