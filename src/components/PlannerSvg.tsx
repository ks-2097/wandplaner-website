import { buildScene, renderSvg, type PlannerSpec } from '@/planner';

/**
 * The planner, drawn by the same layout engine that makes the print file.
 * Works on the server and in the browser.
 */
export function PlannerSvg({ spec, label }: { spec: PlannerSpec; label?: string }) {
  const scene = buildScene(spec);
  return <div className="sheet" style={{ aspectRatio: `${scene.width} / ${scene.height}` }} dangerouslySetInnerHTML={{ __html: renderSvg(scene, { title: label, className: 'planner' }) }} />;
}
