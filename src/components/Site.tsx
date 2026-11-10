import Link from 'next/link';
import type { ReactNode } from 'react';

export function Wordmark({ size }: { size?: number }) {
  return (
    <Link className="wordmark" href="/" aria-label="plana studio, Startseite" style={size ? { fontSize: size } : undefined}>
      <b>plana</b> <span>studio</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-head">
      <div className="wrap">
        <Wordmark />
        <nav className="nav" aria-label="Hauptnavigation">
          <Link href="/editionen">Editionen</Link>
          <Link href="/papier">Papier</Link>
          <Link href="/atelier">Atelier</Link>
          <Link href="/gutschein">Gutschein</Link>
          <Link className="btn small-btn" href="/gestalten">Planer gestalten</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="wrap">
        <Wordmark size={18} />
        <nav className="nav" aria-label="Rechtliches">
          <Link href="/versand">Versand</Link>
          <Link href="/agb">AGB</Link>
          <Link href="/widerruf">Widerruf</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/impressum">Impressum</Link>
          <span className="small">© 2026 plana studio</span>
        </nav>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

export function TripLine({ children }: { children: ReactNode }) {
  return (
    <div className="trip">
      <p className="label">{children}</p>
      <div className="ln" aria-hidden="true" />
    </div>
  );
}
