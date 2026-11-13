'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { STATES } from '@/planner/holidays';

/**
 * Waiting list. Posts to the newsletter provider's form endpoint (Brevo), set in
 * NEXT_PUBLIC_WAITLIST_URL. The provider sends the double opt-in mail.
 */
export function Waitlist() {
  const endpoint = process.env.NEXT_PUBLIC_WAITLIST_URL ?? '';
  const [status, setStatus] = useState<{ text: string; tone?: 'ok' | 'error' }>({ text: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get('EMAIL') ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus({ text: 'Bitte gib eine gültige E-Mail-Adresse ein, zum Beispiel du@beispiel.de.', tone: 'error' });
    if (!endpoint) return setStatus({ text: 'Die Anmeldung öffnet in Kürze. Schau bald wieder vorbei.' });
    setBusy(true);
    setStatus({ text: 'Wird gesendet …' });
    try {
      await fetch(endpoint, { method: 'POST', mode: 'no-cors', body: new FormData(form) });
      form.reset();
      setStatus({ text: 'Fast geschafft: Bitte bestätige deine Anmeldung in der Mail, die wir dir gerade geschickt haben.', tone: 'ok' });
    } catch {
      setStatus({ text: 'Das hat nicht geklappt. Bitte prüf deine Verbindung und versuch es noch einmal.', tone: 'error' });
    }
    setBusy(false);
  }

  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <label className="field">
        <span className="label">E-Mail-Adresse</span>
        <input className="input" name="EMAIL" type="email" autoComplete="email" placeholder="du@beispiel.de" required />
      </label>
      <label className="field">
        <span className="label">Dein Bundesland (optional)</span>
        <select className="input" name="BUNDESLAND" defaultValue="">
          <option value="">Bitte wählen</option>
          {Object.values(STATES).map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <input type="text" name="email_address_check" defaultValue="" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999 }} />
      <input type="hidden" name="locale" value="de" />
      <button className="btn" type="submit" disabled={busy}>Auf die Liste</button>
      <p className="small">Mit dem Eintragen willigst du ein, dass wir dir Neuigkeiten zum Start von plana studio schicken. Du bekommst eine Mail zur Bestätigung. Mehr in der <Link href="/datenschutz">Datenschutzerklärung</Link>.</p>
      <p className="status" role="status" aria-live="polite" data-tone={status.tone}>{status.text}</p>
    </form>
  );
}
