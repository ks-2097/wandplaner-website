import type { CSSProperties, ReactNode } from 'react';

/**
 * A photographed room with one blank sheet on the wall, and the real planner drawn onto that
 * sheet as the engine's own SVG. The SVG is multiplied onto the photo, so the room's light and
 * shadow fall on the paper. The room is computer-generated: every scene carries the
 * "Visualisierung" caption. No client code: it renders the same on the server and in the browser.
 *
 * Sheet position is given as fractions of the image (top-left corner and width); the height
 * follows from the planner's own aspect ratio.
 */
export const SCENES = {
  wohnzimmer: { files: [[1024, 'wohnzimmer-1024.webp'], [2048, 'wohnzimmer-2048.webp']], jpg: 'wohnzimmer.jpg', w: 2048, h: 1360, sheet: { x: 0.3747, y: 0.3125, w: 0.2515 }, orientation: 'quer' },
  kueche: { files: [[1024, 'kueche-1024.webp'], [2048, 'kueche-2048.webp']], jpg: 'kueche.jpg', w: 2048, h: 1360, sheet: { x: 0.3516, y: 0.2382, w: 0.2944 }, orientation: 'quer' },
  flur: { files: [[896, 'flur-896.webp'], [1792, 'flur-1792.webp']], jpg: 'flur.jpg', w: 1792, h: 2240, sheet: { x: 0.3041, y: 0.1188, w: 0.3912 }, orientation: 'hoch' },
} as const;

export type Scene = keyof typeof SCENES;

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

type FrameProps = {
  scene: Scene;
  /** Planner SVG markup (from plannerSvg) */
  svg: string;
  /** Planner trim size in mm, for the overlay's aspect ratio */
  sheetSize: { width: number; height: number };
  alt: string;
  sizes: string;
  priority?: boolean;
  /** A white sheet under the planner that can be faded in when the photo fades out (hero) */
  paper?: boolean;
  /** Marks the drawn sheet as a magnifier target */
  magnify?: boolean;
};

export function RoomFrame({ scene, svg, sheetSize, alt, sizes, priority, paper, magnify }: FrameProps) {
  const s = SCENES[scene];
  const pos: CSSProperties = { left: pct(s.sheet.x), top: pct(s.sheet.y), width: pct(s.sheet.w), aspectRatio: `${sheetSize.width} / ${sheetSize.height}` };
  return (
    <div className="room-frame" style={{ aspectRatio: `${s.w} / ${s.h}` }}>
      <picture className="room-photo">
        <source type="image/webp" srcSet={s.files.map(([w, f]) => `/img/raum/${f} ${w}w`).join(', ')} sizes={sizes} />
        <img src={`/img/raum/${s.jpg}`} width={s.w} height={s.h} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" />
      </picture>
      {paper && <div className="room-paper" style={pos} aria-hidden="true" />}
      <div className="room-sheet" style={pos} data-magnify={magnify ? '' : undefined} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

/** A room scene as a figure with its caption. The caption always ends in "Visualisierung". */
export function RoomStage({ caption, className, active, children, ...frame }: FrameProps & { caption: ReactNode; className?: string; active?: boolean; children?: ReactNode }) {
  return (
    <figure className={`room${className ? ` ${className}` : ''}`} data-active={active === undefined ? undefined : String(active)}>
      <RoomFrame {...frame} />
      <figcaption className="label">{caption} · Visualisierung</figcaption>
      {children}
    </figure>
  );
}
