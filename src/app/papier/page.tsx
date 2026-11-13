import type { Metadata } from 'next';
import Link from 'next/link';
import { Page } from '@/components/Site';

export const metadata: Metadata = { title: 'Papier und Qualität', description: 'Format, Papier, Druck und Versand der Wandplaner von plana studio.' };

export default function Papier() {
  return (
    <Page>
      <div className="wrap section-tight stack-lg">
        <div className="prose">
          <p className="label">Papier und Qualität</p>
          <h1 className="h1">Ein Druck, den man gern aufhängt</h1>
          <p className="lead">Der Planer hängt ein Jahr lang an deiner Wand. Deshalb drucken wir ihn wie ein Plakat fürs Wohnzimmer, nicht wie einen Bürokalender.</p>
        </div>
        <div className="cells">
          <div className="cell"><span className="label">Format</span><span className="big">70 × 100</span><p>Zentimeter. Quer oder hoch, je nach Layout. Passt in gängige Rahmen und Posterleisten.</p></div>
          <div className="cell off"><span className="label">Papier</span><span className="big">matt</span><p>Mattes Premiumpapier, auf dem Bleistift, Fineliner und Kugelschreiber gut halten und nichts spiegelt.</p></div>
          <div className="cell"><span className="label">Linien</span><span className="big">0,2 mm</span><p>Feine Linien und kleine Beschriftungen, die auch aus der Nähe sauber stehen.</p></div>
          <div className="cell off"><span className="label">Versand</span><span className="big">Rolle</span><p>Gerollt in einer stabilen Versandhülse, innerhalb Deutschlands im Preis enthalten.</p></div>
        </div>
        <div className="prose">
          <h2 className="h2">Was du siehst, wird gedruckt</h2>
          <p>Die Vorschau im Konfigurator und die Druckdatei entstehen aus derselben Zeichnung. Bevor du bestellst, prüfst du die Vorschau und gibst sie frei. Farben können auf Papier etwas anders wirken als auf deinem Bildschirm.</p>
          <p><Link href="/versand">Mehr zu Versand und Lieferzeit</Link></p>
        </div>
      </div>
    </Page>
  );
}
