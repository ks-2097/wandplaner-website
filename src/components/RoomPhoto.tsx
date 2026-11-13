// A room scene with the real print file placed in it. The room is computer-generated, so every
// scene carries the "Visualisierung" caption (see scripts/mockup for how the images are made).
const SCENES = {
  wohnzimmer: { file: 'wohnzimmer-aubergine', widths: [1024, 2048], w: 2048, h: 1376, alt: 'Der Wandplaner in Aubergine über einem Eichen-Sideboard in einem hellen Wohnzimmer, mit zwei Messingklammern an der Wand befestigt.' },
  kueche: { file: 'kueche-salbei', widths: [1024, 2048], w: 2048, h: 1376, alt: 'Der Wandplaner in Salbeigrün mit einer Zeile pro Monat an der Küchenwand über einer Holzbank, davor ein Esstisch mit Kaffeetasse und Buntstiften.' },
  flur: { file: 'flur-sand', widths: [688, 1376], w: 1376, h: 2048, alt: 'Der Wandplaner im Hochformat in Sand im Flur neben der Garderobe, darunter eine Holzbank mit Gummistiefeln.' },
} as const;

export type Scene = keyof typeof SCENES;

export function RoomPhoto({ scene, caption, sizes, priority }: { scene: Scene; caption: string; sizes: string; priority?: boolean }) {
  const s = SCENES[scene];
  const base = `/img/raum/${s.file}`;
  return (
    <figure className="room">
      <picture>
        <source type="image/webp" srcSet={s.widths.map((w) => `${base}-${w}.webp ${w}w`).join(', ')} sizes={sizes} />
        <img src={`${base}.jpg`} width={s.w} height={s.h} alt={s.alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" />
      </picture>
      <figcaption className="label">{caption} · Visualisierung</figcaption>
    </figure>
  );
}
