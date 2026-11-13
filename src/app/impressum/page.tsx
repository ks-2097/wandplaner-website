import type { Metadata } from 'next';
import { Page } from '@/components/Site';

export const metadata: Metadata = { title: 'Impressum', robots: { index: false } };

export default function Legal() {
  return (
    <Page>
      <div className="legal section-tight">
        <div className="wrap prose">
          <h1 className="h1">Impressum</h1>
          <h2>Angaben gemäß § 5 DDG</h2>
          <p><span className="todo">[Vor- und Nachname]</span><br />plana studio<br /><span className="todo">[Straße und Hausnummer]</span><br /><span className="todo">[PLZ Ort]</span></p>
          <h2>Kontakt</h2>
          <p>E-Mail: <span className="todo">[hallo@plana-planer.de]</span><br />Telefon: <span className="todo">[Telefonnummer, optional]</span></p>
          <h2>Umsatzsteuer</h2>
          <p><span className="todo">[Umsatzsteuer-ID gemäß § 27a UStG, sobald vorhanden. Entfällt bei Kleinunternehmerregelung.]</span></p>
          <h2>Verantwortlich für den Inhalt</h2>
          <p><span className="todo">[Vor- und Nachname, Anschrift wie oben]</span></p>
          <h2>Verbraucherstreitbeilegung</h2>
          <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
          <h2>Datenquellen</h2>
          <p>Schulferien und Feiertage: OpenHolidays API (openholidaysapi.org), Open Database License. Spielpläne: OpenLigaDB (openligadb.de), Open Database License. Schriften: SIL Open Font License.</p>
        </div>
      </div>
    </Page>
  );
}
