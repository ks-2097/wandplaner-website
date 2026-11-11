'use client';

import { useRouter } from 'next/navigation';
import type { PlannerSpec } from '@/planner';
import { saveDraft } from './draft';

/** Opens a kept design in the configurator, as the starting point for a new planner. */
export function Redesign({ spec }: { spec: PlannerSpec }) {
  const router = useRouter();
  return (
    <button type="button" className="btn secondary" onClick={() => { if (confirm('Dieses Design im Konfigurator öffnen? Ein Entwurf, der dort gerade liegt, wird ersetzt.')) { saveDraft({ spec, calNames: {} }); router.push('/gestalten'); } }}>
      Mit diesem Design neu gestalten
    </button>
  );
}
