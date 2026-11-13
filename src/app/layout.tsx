import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const site = process.env.SITE_URL ?? 'https://plana-planer.de';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'plana studio – Das Jahr als Bild', template: '%s – plana studio' },
  description: 'Der Wandplaner für dein ganzes Jahr: 70 × 100 cm, mit den Ferien und Feiertagen deines Bundeslandes, euren Geburtstagen und in deinem Design.',
  openGraph: { type: 'website', locale: 'de_DE', siteName: 'plana studio', images: ['/img/og.jpg'] },
};

export const viewport: Viewport = { themeColor: '#d8cde6', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="preload" href="/fonts/poppins-latin-700-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
