import type { Metadata } from 'next';
import { Page } from '@/components/Site';

export const metadata: Metadata = { title: 'Versand und Lieferzeit', robots: { index: false } };

export default function Legal() {
  return (
    <Page>
      <div className="legal section-tight">
        <div className="wrap prose">
          <h1 className="h1">Versand und Lieferzeit</h1>
          <h2>Wohin wir liefern</h2>
          <p>Wir liefern innerhalb Deutschlands. Der Versand ist im Preis enthalten.</p>
          <h2>Lieferzeit</h2>
          <p>Dein Planer wird nach der Bestellung gedruckt und geht in der Regel nach <span className="todo">[3–5]</span> Werktagen in den Versand. Sobald er unterwegs ist, bekommst du eine Mail mit der Sendungsnummer.</p>
          <h2>Vor Weihnachten</h2>
          <p>Bestellungen bis zum 14. Dezember kommen vor Weihnachten an. Wer später dran ist, verschenkt einen Gutschein: der kommt sofort per Mail.</p>
          <h2>Verpackung</h2>
          <p>Der Planer kommt gerollt in einer stabilen Versandhülse. Leg ihn nach dem Auspacken ein paar Stunden flach hin oder häng ihn gleich auf, dann glättet er sich.</p>
          <h2>Zahlung</h2>
          <p>Du bezahlst über Stripe mit Karte, PayPal, Klarna, Apple Pay, Google Pay oder SEPA-Lastschrift.</p>
        </div>
      </div>
    </Page>
  );
}
