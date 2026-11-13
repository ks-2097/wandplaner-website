import Link from 'next/link';
import { Page } from '@/components/Site';

export default function NotFound() {
  return (
    <Page>
      <div className="wrap section stack">
        <h1 className="h1">Diese Seite gibt es nicht</h1>
        <p>Vielleicht ist der Link nicht vollständig. Von der Startseite aus findest du alles.</p>
        <p><Link className="btn" href="/">Zur Startseite</Link></p>
      </div>
    </Page>
  );
}
