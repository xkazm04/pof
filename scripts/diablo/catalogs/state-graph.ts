import { aiDecisionGraphEntities, seedAiDecisionGraphSteps } from '@/lib/catalog/reference/aiDecisionGraphs';
import { withGroupAi } from '@/lib/catalog/reference/groupAiLedger';
import { seedStateGraphSteps, stateGraphEntities } from '@/lib/catalog/reference/stateGraphSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import type { CatalogHandler } from './types';

const allStateGraphEntities = (wrappers: readonly ReferenceWrapper[] = []) => [
  ...stateGraphEntities(),
  ...aiDecisionGraphEntities(wrappers).map((wrapper) => ({
    ...wrapper,
    entity: withGroupAi(wrapper.entity),
  })),
];

export const stateGraphHandler: CatalogHandler = {
  catalogId: 'state-graph',
  standalonePromotion: true,
  pool: (db, sourceId, wrappers) => allStateGraphEntities(
    wrappers.length ? wrappers : listWrappers(db, { sourceId, catalogId: 'bestiary' }),
  ) as unknown as ReferenceWrapper[],
  seed: (ctx) => {
    for (const wrapper of allStateGraphEntities().filter((item) => !ctx.ids || ctx.ids.includes(item.entity.id))) {
      if (!ctx.promoted.has(wrapper.entity.id)) {
        ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
        continue;
      }
      ctx.emit(wrapper.entity.id.startsWith('d1-ai-')
        ? seedAiDecisionGraphSteps(wrapper.entity)
        : seedStateGraphSteps(wrapper.entity));
    }
  },
};
