import type { Metadata } from 'next';
import Link from 'next/link';
import { Page } from '@/components/Site';

export const metadata: Metadata = { title: 'Atelier', description: 'Wie aus einem von Hand gezeichneten Wandplaner plana studio wurde.' };

export default function Atelier() {
  return (
    <Page>
      <div className="wrap section-tight">
        <div className="prose">
          <p className="label">Atelier</p>
          <h1 className="h1">Ein Planer, von Hand gezeichnet</h1>
          <p className="lead">plana studio beginnt an einer Wand in Berlin. Dort hängt jedes Jahr ein großer Bogen Papier, auf dem Konrad das kommende Jahr aufzeichnet.</p>
          <p>Vier Wochen stehen in jeder Reihe, dreizehn Reihen untereinander. So steht jeder Wochentag immer in derselben Spalte, und die Monate laufen als Treppe durch das Blatt. Ferien und Reisen sind dünne Linien mit Pfeilen an beiden Enden, quer über die Tage: „← COSTA RICA →“.</p>
          <p>Der Planer hing in der Küche, und wer zu Besuch kam, blieb davor stehen. Wann sind Ferien, wer hat wann Geburtstag, wie lange ist es noch bis zum Sommer: alles auf einen Blick, ohne umzublättern. Irgendwann fragten die Ersten, ob sie auch so einen haben könnten.</p>
          <p>Daraus ist plana studio geworden. Der gezeichnete Planer ist heute ein genauer Druck: dieselben dünnen Linien, dieselben kleinen Großbuchstaben, viel freie Fläche zum Hineinschreiben. Die Ferien und Feiertage deines Bundeslandes tragen wir ein, eure Geburtstage auch. Den Rest schreibst du mit dem Stift dazu, so wie es gedacht ist.</p>
          <p><Link className="btn" href="/gestalten">Planer gestalten</Link></p>
        </div>
      </div>
    </Page>
  );
}
