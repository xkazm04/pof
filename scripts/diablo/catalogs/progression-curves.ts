import { seedProgressionCurveSteps } from '@/lib/catalog/reference/combatSeeds';
import { experienceCurve } from '@/lib/catalog/reference/experienceCurve';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

export const progressionCurvesHandler: CatalogHandler = {
  catalogId: 'progression-curves',
  pool: (_db, _sourceId, wrappers) =>
    experienceCurve(wrappers.filter((wrapper) => wrapper.catalogId === 'progression-curves')) as unknown as ReferenceWrapper[],
  seed: (ctx) => {
    const [curve] = experienceCurve(listWrappers(ctx.db, {
      sourceId: ctx.sourceId,
      catalogId: 'progression-curves',
    }));
    if (!curve || (ctx.ids && !ctx.ids.includes(curve.entity.id))) return;
    if (!ctx.promoted.has(curve.entity.id)) {
      ctx.print(`SKIP ${curve.entity.id}: not promoted (promote it first)`);
      return;
    }
    ctx.emit(seedProgressionCurveSteps(curve));
  },
};
