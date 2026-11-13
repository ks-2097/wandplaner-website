import type { Metadata } from 'next';
import Link from 'next/link';
import { PlannerSvg } from '@/components/PlannerSvg';
import { Page } from '@/components/Site';
import { EDITIONS, LAYOUTS, defaultSpec } from '@/planner';

export const metadata: Metadata = { title: 'Editionen', description: 'Drei Layouts, drei Farbwelten: die Editionen von plana studio. Jede lässt sich anpassen.' };
export const dynamic = 'force-dynamic';

export default function Editionen() {
  return (
    <Page>
      <div className="wrap section-tight stack-lg">
        <div className="stack">
          <p className="label">Editionen</p>
          <h1 className="h1">Drei Farbwelten, drei Layouts</h1>
          <p className="lead">Jede Edition ist ein Ausgangspunkt. Im Konfigurator änderst du Farben, Schrift und Titel, oder du beschreibst einfach, wie dein Planer aussehen soll.</p>
        </div>
        {EDITIONS.map((e, i) => (
          <section className="stack" key={e.id} aria-labelledby={`ed-${e.id}`}>
            <div className="planner-frame" style={{ background: e.paper }}>
              <PlannerSvg spec={defaultSpec({ edition: e.id, layout: LAYOUTS[i % LAYOUTS.length].id })} label={`Edition ${e.name} im Layout ${LAYOUTS[i % LAYOUTS.length].name}`} />
            </div>
            <div className="caption">
              <div className="stack prose" style={{ gap: 'var(--space-1)' }}>
                <h2 className="h2" id={`ed-${e.id}`}>{e.name}</h2>
                <p>{e.story}</p>
                <p className="small">Gezeigt im Layout „{LAYOUTS[i % LAYOUTS.length].name}“: {LAYOUTS[i % LAYOUTS.length].summary}</p>
              </div>
              <Link className="btn secondary" href="/gestalten">Damit gestalten</Link>
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}
