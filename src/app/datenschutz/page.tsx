import type { Metadata } from 'next';
import { Page } from '@/components/Site';

export const metadata: Metadata = { title: 'Datenschutzerklärung', robots: { index: false } };

export default function Legal() {
  return (
    <Page>
      <div className="legal section-tight">
        <div className="wrap prose">
          <h1 className="h1">Datenschutzerklärung</h1>
          <p className="small"><span className="todo">Entwurf. Vor dem Verkaufsstart durch den Text eines Rechtstext-Service (z. B. IT-Recht Kanzlei, Händlerbund) ersetzen oder prüfen lassen.</span></p>
          <h2>Verantwortlicher</h2>
          <p><span className="todo">[Vor- und Nachname, Anschrift, E-Mail wie im Impressum]</span></p>
          <h2>Hosting und Server-Logfiles</h2>
          <p>Diese Website wird bei <span className="todo">[Hoster, Ort]</span> in Deutschland betrieben. Beim Aufruf speichert der Server technisch notwendige Daten (IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser) für höchstens <span className="todo">[7]</span> Tage, um den Betrieb und die Sicherheit der Seite zu gewährleisten (Art. 6 Abs. 1 lit. f DSGVO).</p>
          <h2>Keine Cookies, kein Tracking</h2>
          <p>Diese Seite setzt keine Cookies zu Werbe- oder Analysezwecken. Schriften liegen auf unserem eigenen Server. Dein Entwurf wird im Speicher deines Browsers abgelegt, damit er beim nächsten Besuch noch da ist; er wird erst mit der Bestellung an uns übertragen.</p>
          <h2>Bestellungen</h2>
          <p>Wenn du bestellst, verarbeiten wir deinen Namen, deine E-Mail-Adresse, deine Lieferadresse und die Angaben auf deinem Planer (Titel, Geburtstage, Termine), um den Vertrag zu erfüllen (Art. 6 Abs. 1 lit. b DSGVO). Geburtstage und Namen anderer Personen trägst du in eigener Verantwortung ein. Für den Druck und den Versand geben wir die Druckdatei und die Lieferadresse an <span className="todo">[Druckpartner, Ort]</span> weiter. Rechnungs- und Bestelldaten bewahren wir nach den gesetzlichen Fristen auf.</p>
          <h2>Löschung deines Designs</h2>
          <p>Dein Design (Titel, Termine, Geburtstage) löschen wir automatisch 30 Tage nach dem Versand; so lange brauchen wir es für Reklamationen und Nachdrucke. Eine Druckdatei speichern wir nicht, sie wird nur beim Druck aus dem Design erzeugt. Bestellungen, die nicht bezahlt wurden, löschen wir nach 30 Tagen vollständig. Wenn du es wünschst, bewahren wir dein Design für eine Nachbestellung länger auf, höchstens 18 Monate (Art. 6 Abs. 1 lit. a DSGVO). Diese Einwilligung gibst und widerrufst du über den Link in deiner Bestellmail.</p>
          <h2>Zahlung</h2>
          <p>Zahlungen wickelt Stripe Payments Europe, Ltd., Dublin, ab. Stripe erhält dafür deine E-Mail-Adresse, den Betrag und die Zahlungsdaten, die du dort eingibst. Wir selbst sehen keine Karten- oder Kontodaten.</p>
          <h2>Design-Assistent und Geburtstage per Foto</h2>
          <p>Wenn du den Design-Assistenten nutzt oder ein Foto eures Geburtstagskalenders hochlädst, senden wir deinen Text, das Foto und den aktuellen Entwurf an Anthropic, PBC (Claude API), um einen Designvorschlag zu erstellen oder die Geburtstage zu lesen. Die Fotos speichern wir nicht. Anthropic verarbeitet die Daten in unserem Auftrag und nutzt sie nicht zum Training seiner Modelle. <span className="todo">[Auftragsverarbeitungsvertrag, Speicherort und Übermittlung in die USA mit dem Rechtstext-Service abstimmen.]</span> Vorschläge des Assistenten sind KI-erzeugt.</p>
          <h2>Kalender per Adresse</h2>
          <p>Wenn du die Adresse eines öffentlichen Kalenders angibst, ruft unser Server diesen Kalender einmal ab und übernimmt die Termine in deinen Entwurf.</p>
          <h2>Warteliste und Newsletter</h2>
          <p>Wenn du dich in die Warteliste einträgst, speichern wir deine E-Mail-Adresse und, falls angegeben, dein Bundesland, um dich über den Start von plana studio zu informieren. Grundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Nach dem Eintragen bekommst du eine Mail, mit der du die Anmeldung bestätigst (Double-Opt-in). Du kannst deine Einwilligung jederzeit widerrufen, über den Abmeldelink in jeder Mail oder per Mail an uns. Für den Versand nutzen wir <span className="todo">[Brevo (Sendinblue GmbH), Berlin]</span>.</p>
          <h2>Deine Rechte</h2>
          <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch, sowie das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, zum Beispiel bei der Behörde deines Bundeslandes.</p>
          <p className="small">Stand: November 2026</p>
        </div>
      </div>
    </Page>
  );
}
