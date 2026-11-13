import type { Metadata } from 'next';
import Link from 'next/link';
import { Magnifier } from '@/components/home/Magnifier';
import { PageMotion } from '@/components/home/PageMotion';
import { PushIn } from '@/components/home/PushIn';
import { TryOnWall } from '@/components/home/TryOnWall';
import { PlannerSvg, plannerSvg } from '@/components/PlannerSvg';
import { RoomFrame } from '@/components/RoomStage';
import { Page, TripLine } from '@/components/Site';
import { Waitlist } from '@/components/Waitlist';
import { PRODUCT, config, euro, PRICES } from '@/lib/config';
import { EDITIONS, LAYOUTS, defaultSpec } from '@/planner';

export const metadata: Metadata = {
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'plana studio',
    images: [{ url: '/img/raum/wohnzimmer-aubergine.jpg', width: 1600, height: 1063, alt: 'Der Wandplaner in Aubergine über einem Sideboard in einem hellen Wohnzimmer (Visualisierung)' }],
  },
};

export const dynamic = 'force-dynamic';

export default function Home() {
  const hero = defaultSpec({ start: { year: 2027, month: 1 }, state: 'BE' });
  const heroSvg = plannerSvg(hero);
  const sheetLabel = 'Der Wandplaner zweitausend&siebenundzwanzig in Aubergine auf hellem Lila: 13 Reihen mit je vier Wochen, Wochenenden schattiert, Schulferien als Pfeillinien.';
  return (
    <Page>
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap hero-copy">
          <div className="hero-head">
            <p className="label">Wandplaner · 70 × 100 cm</p>
            <h1 className="display" id="hero-title">das jahr als bild.</h1>
          </div>
          <div className="hero-text">
            <p className="lead">Dein ganzes Jahr auf einem Blatt, gemacht für deine Wand: mit den Ferien und Feiertagen deines Bundeslandes, euren Geburtstagen und in deinem Design.</p>
            <div className="actions">
              <Link className="btn" href="/gestalten">Planer gestalten</Link>
              <span className="small">{euro(PRICES.planner)} inkl. Versand{config.shopOpen ? ` · bis ${PRODUCT.lastOrderDate} bestellt, vor Weihnachten da` : ' · ab Ende November bestellbar'}</span>
            </div>
          </div>
        </div>
        <PushIn>
          <figure className="push-pin">
            <div className="push-wash" aria-hidden="true" />
            <div className="push-pos">
              <div className="push-cam">
                <RoomFrame
                  scene="wohnzimmer"
                  svg={heroSvg.html}
                  sheetSize={heroSvg}
                  alt="Ein helles Wohnzimmer mit Eichen-Sideboard, Trockenblumen und Sessel. Darüber hängt der Wandplaner Vier Wochen in Aubergine, mit zwei Messingklammern befestigt."
                  sizes="(orientation: portrait) 200vw, 100vw"
                  priority
                  paper
                  magnify
                />
              </div>
            </div>
            <figcaption className="push-caption label">Vier Wochen · Aubergine · Visualisierung</figcaption>
          </figure>
        </PushIn>
      </section>

      <section className="sheet-section planner-frame" aria-labelledby="sheet-title">
        <div className="wrap stack">
          <div className="sheet-flat" data-magnify="">
            <PlannerSvg spec={hero} label={sheetLabel} />
          </div>
          <div className="stack" style={{ gap: 'var(--space-1)' }}>
            <h2 className="h2" id="sheet-title">Jeder Tag hat seinen Platz</h2>
            <p className="prose">Das ist die echte Druckdatei, nicht ein Foto davon: 13 Reihen mit je vier Wochen, die Wochenenden schattiert, die Schulferien als Linien über den Tagen.</p>
          </div>
          <Magnifier svg={heroSvg.html} sheet={heroSvg} label={sheetLabel} />
          <div style={{ marginTop: 'var(--space-3)' }}><TripLine>Aubergine-Edition · Berlin · Januar bis Dezember 2027</TripLine></div>
        </div>
      </section>

      <section className="section" aria-label="Der Planer in Zahlen">
        <div className="wrap" data-reveal="">
          <div className="cells">
            <div className="cell"><span className="label">Tage</span><span className="big"><span data-count="364">364</span></span><p>Das ganze Jahr auf einen Blick, ohne umzublättern. Du wählst, in welchem Monat es beginnt.</p></div>
            <div className="cell off"><span className="label">Bundesländer</span><span className="big"><span data-count="16">16</span></span><p>Schulferien und Feiertage für dein Bundesland sind schon eingetragen. Ein zweites geht auch.</p></div>
            <div className="cell"><span className="label">Layouts</span><span className="big"><span data-count="03">03</span></span><p>Vier Wochen pro Reihe, ein Monat pro Zeile oder ein Monat pro Spalte: du wählst die Grundlage.</p></div>
            <div className="cell off"><span className="label">Format</span><span className="big"><span data-count="70">70</span> × <span data-count="100">100</span></span><p>Zentimeter, auf mattem Premiumpapier, sicher in der Rolle verschickt.</p></div>
          </div>
        </div>
      </section>

      <section className="section-tight" aria-labelledby="how-title">
        <div className="wrap stack-lg" data-reveal="">
          <h2 className="h2" id="how-title">So entsteht dein Planer</h2>
          <div className="cards">
            <div className="card"><span className="label accent">01</span><h3 className="h3">Grundlage wählen</h3><p className="small">Layout, Farben, Startmonat und Bundesland. Die Ferien und Feiertage tragen wir ein.</p></div>
            <div className="card"><span className="label accent">02</span><h3 className="h3">Eure Termine dazu</h3><p className="small">Geburtstage von Hand oder per Foto eures Geburtstagskalenders, dazu der Spielplan deines Vereins oder ein anderer öffentlicher Kalender.</p></div>
            <div className="card"><span className="label accent">03</span><h3 className="h3">Sag, wie er aussehen soll</h3><p className="small">Beschreib dein Design in eigenen Worten oder lade ein Foto als Vorlage hoch. Du siehst sofort, was gedruckt wird.</p></div>
            <div className="card"><span className="label accent">04</span><h3 className="h3">Prüfen, bestellen, aufhängen</h3><p className="small">Du gibst die Druckvorschau frei, wir drucken und schicken den Planer in der Rolle.</p></div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="layouts-title">
        <div className="wrap stack-lg" data-reveal="">
          <div className="stack">
            <h2 className="h2" id="layouts-title">Drei Grundlagen, drei Editionen</h2>
            <p className="prose">Jedes Layout gibt es in jeder Farbe, und jede Farbe kannst du ändern.</p>
          </div>
          <div className="cards">
            {LAYOUTS.map((l, i) => (
              <figure className="card card-lift" key={l.id}>
                <Link href="/gestalten" aria-label={`${l.name} gestalten`}><PlannerSvg spec={defaultSpec({ layout: l.id, edition: EDITIONS[i % EDITIONS.length].id })} /></Link>
                <figcaption className="stack" style={{ gap: 'var(--space-1)' }}>
                  <h3 className="h3">{l.name} <span className="label">· {EDITIONS[i % EDITIONS.length].name}</span></h3>
                  <p className="small">{l.summary}</p>
                </figcaption>
              </figure>
            ))}
          </div>
          <p><Link href="/editionen">Alle Editionen ansehen</Link></p>
        </div>
      </section>

      <section className="section-tight" aria-labelledby="rooms-title">
        <div className="wrap stack-lg" data-reveal="">
          <div className="stack">
            <h2 className="h2" id="rooms-title">Dort, wo ihr jeden Tag vorbeikommt</h2>
            <p className="prose">In der Küche, im Flur, über dem Schreibtisch: Der Planer hängt da, wo die ganze Familie hinschaut. Quer oder hoch, in der Farbe, die zu eurer Wand passt. Such dir hier Farbe, Layout und Bundesland aus.</p>
          </div>
          <TryOnWall base={hero} />
          <p className="small">Die Räume sind am Computer entstanden, der Planer darin ist die echte Druckdatei. Geliefert wird der Druck gerollt, ohne Klammern oder Leiste.</p>
        </div>
      </section>

      <section className="section-tight" aria-labelledby="gift-title">
        <div className="wrap split" data-reveal="">
          <div className="stack">
            <h2 className="h2" id="gift-title">Zum Verschenken</h2>
            <p className="prose">Du kennst die Geburtstage der Beschenkten nicht? Verschenk einen Gutschein. Sie gestalten ihren Planer selbst, wann sie wollen.</p>
            <p><Link className="btn secondary" href="/gutschein">Gutschein verschenken</Link></p>
          </div>
          <div className="stack">
            <h2 className="h2">Wie es anfing</h2>
            <p className="prose">Angefangen hat alles mit einem Planer, den Konrad jedes Jahr von Hand an seine Wand zeichnet: vier Wochen pro Reihe, die Monate als Treppe, Reisen als Pfeile quer über die Tage. plana studio macht daraus einen Druck, der genauso für dich gemacht ist.</p>
            <p><Link href="/atelier">Mehr über das Atelier</Link></p>
          </div>
        </div>
      </section>

      {!config.shopOpen && (
        <section className="section" aria-labelledby="signup-title">
          <div className="wrap split" data-reveal="">
            <div className="stack">
              <h2 className="h2" id="signup-title">Sei beim Start dabei</h2>
              <p>Gestalten kannst du schon jetzt. Bestellen geht ab Ende November. Trag dich ein und wir schreiben dir, sobald es so weit ist.</p>
              <p className="small">Höchstens zwei, drei Mails bis Weihnachten. Abmelden geht jederzeit mit einem Klick.</p>
            </div>
            <Waitlist />
          </div>
        </section>
      )}
      <PageMotion />
    </Page>
  );
}
