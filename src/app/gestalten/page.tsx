import type { Metadata } from 'next';
import { Configurator } from '@/components/Configurator';
import { Page } from '@/components/Site';
import { aiReady } from '@/lib/ai';

export const metadata: Metadata = { title: 'Planer gestalten', description: 'Gestalte deinen Wandplaner: Layout, Farben, Bundesland, Geburtstage und eigene Kalender, mit Vorschau in Druckqualität.' };
export const dynamic = 'force-dynamic';

export default function Gestalten() {
  return (
    <Page>
      <div className="wrap" style={{ paddingTop: 'var(--space-4)' }}>
        <p className="label">Schritt 1 von 2</p>
        <h1 className="h1">Gestalte deinen Planer</h1>
      </div>
      <Configurator assistant={aiReady()} />
    </Page>
  );
}
