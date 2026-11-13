import type { Metadata } from 'next';
import { Page } from '@/components/Site';

export const metadata: Metadata = { title: 'Widerruf', robots: { index: false } };

export default function Legal() {
  return (
    <Page>
      <div className="legal section-tight">
        <div className="wrap prose">
          <h1 className="h1">Widerruf</h1>
          <p className="small"><span className="todo">Entwurf. Vor dem Verkaufsstart durch den Text eines Rechtstext-Service (z. B. IT-Recht Kanzlei, Händlerbund) ersetzen oder prüfen lassen.</span></p>
          <h2>Kein Widerrufsrecht bei gestalteten Planern</h2>
          <p>Jeder Wandplaner wird nach deinen Angaben gefertigt: Layout, Titel, Bundesland, Geburtstage und Design. Für solche Waren besteht kein Widerrufsrecht (§ 312g Abs. 2 Nr. 1 BGB). Darauf weisen wir dich vor der Bestellung hin, und du bestätigst es mit einem Häkchen.</p>
          <p>Kommt dein Planer beschädigt oder fehlerhaft gedruckt an, gelten die gesetzlichen Mängelrechte. Schreib uns, wir kümmern uns darum.</p>
          <h2>Widerrufsrecht bei Gutscheinen</h2>
          <p>Den Kauf eines Gutscheins kannst du innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen, solange er nicht eingelöst ist. Die Frist beginnt mit dem Tag des Vertragsschlusses. Um zu widerrufen, schick uns eine eindeutige Erklärung, zum Beispiel per Mail an <span className="todo">[E-Mail]</span>. Wir erstatten den Betrag innerhalb von 14 Tagen auf demselben Zahlungsweg.</p>
          <p><span className="todo">[Vollständige Widerrufsbelehrung und Muster-Widerrufsformular aus dem Rechtstext-Service einfügen.]</span></p>
        </div>
      </div>
    </Page>
  );
}
