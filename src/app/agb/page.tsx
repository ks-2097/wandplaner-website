import type { Metadata } from 'next';
import { Page } from '@/components/Site';

export const metadata: Metadata = { title: 'Allgemeine Geschäftsbedingungen', robots: { index: false } };

export default function Legal() {
  return (
    <Page>
      <div className="legal section-tight">
        <div className="wrap prose">
          <h1 className="h1">Allgemeine Geschäftsbedingungen</h1>
          <p className="small"><span className="todo">Entwurf. Vor dem Verkaufsstart durch den Text eines Rechtstext-Service (z. B. IT-Recht Kanzlei, Händlerbund) ersetzen oder prüfen lassen.</span></p>
          <h2>1. Geltungsbereich und Anbieter</h2>
          <p>Diese Bedingungen gelten für alle Bestellungen bei plana studio, <span className="todo">[Vor- und Nachname, Anschrift]</span>, über plana-planer.de.</p>
          <h2>2. Vertragsschluss</h2>
          <p>Die Darstellung im Shop ist kein bindendes Angebot. Mit dem Klick auf „Zahlungspflichtig bestellen“ gibst du ein verbindliches Angebot ab. Der Vertrag kommt zustande, wenn wir die Bestellung per Mail bestätigen.</p>
          <h2>3. Nach deinen Angaben gefertigte Ware</h2>
          <p>Jeder Planer wird nach deinen Angaben gedruckt. Du prüfst vor der Bestellung die Druckvorschau und gibst sie frei. Für Schreibfehler, falsche Namen oder Daten in deinen eigenen Angaben haften wir nicht. Schulferien und Feiertage tragen wir nach bestem Wissen aus öffentlichen Quellen ein; Termine können sich nach dem Druck ändern.</p>
          <h2>4. Eigene Inhalte</h2>
          <p>Du versicherst, dass du die Rechte an Texten und Bildern hast, die du für deinen Planer verwendest. Wir können Bestellungen mit rechtsverletzenden oder anstößigen Inhalten ablehnen.</p>
          <h2>5. Preise, Zahlung, Versand</h2>
          <p>Alle Preise enthalten die gesetzliche Mehrwertsteuer <span className="todo">[bzw. Hinweis nach § 19 UStG]</span> und den Versand innerhalb Deutschlands. Die Zahlung erfolgt über Stripe. Wir liefern nur innerhalb Deutschlands.</p>
          <h2>6. Gutscheine</h2>
          <p>Gutscheine sind drei Jahre ab dem Ende des Jahres gültig, in dem sie gekauft wurden. Sie werden nicht bar ausgezahlt. Restguthaben bleibt erhalten.</p>
          <h2>7. Mängel und Transportschäden</h2>
          <p>Es gelten die gesetzlichen Mängelrechte. Kommt dein Planer beschädigt an, schick uns bitte ein Foto an <span className="todo">[E-Mail]</span>; wir drucken ihn neu.</p>
          <h2>8. Hersteller</h2>
          <p>Hersteller im Sinne der Produktsicherheitsverordnung: <span className="todo">[Name, Anschrift, E-Mail]</span>.</p>
        </div>
      </div>
    </Page>
  );
}
