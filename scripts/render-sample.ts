// Renders a spec to an SVG file for a quick look: npx tsx scripts/render-sample.ts out.svg [state] [year] [month] [edition]
import { writeFileSync } from 'node:fs';
import { buildScene, defaultSpec, renderSvg, type LayoutId, type StateCode } from '../src/planner';

const [out = 'sample.svg', state = 'BE', year = '2026', month = '11', edition = 'aubergine', layout = 'wochen'] = process.argv.slice(2);
const spec = defaultSpec({ state: state as StateCode, start: { year: Number(year), month: Number(month) }, edition, layout: layout as LayoutId });
if (process.env.DEMO) {
  spec.birthdays = [{ name: 'Oma Inge', day: 14, month: 3 }, { name: 'Jonas', day: 1, month: 5 }, { name: 'Mila', day: 14, month: 3 }];
  spec.events = [{ start: '2027-06-05', end: '2027-06-19', label: 'Costa Rica' }, { start: '2027-02-13', label: 'Hertha – Union' }];
  spec.calendars.school = ['BE', 'BY'];
}
const scene = buildScene(spec);
writeFileSync(out, renderSvg(scene));
console.log(out, scene.prims.length, 'prims', scene.notes);
