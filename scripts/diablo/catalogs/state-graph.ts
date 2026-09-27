import { seedStateGraphSteps, stateGraphEntities } from '@/lib/catalog/reference/stateGraphSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

export const stateGraphHandler: CatalogHandler = {
  catalogId: 'state-graph',
  standalonePromotion: true,
  pool: () => stateGraphEntities() as unknown as ReferenceWrapper[],
  seed: (ctx) => {
    for (const wrapper of stateGraphEntities().filter((item) => !ctx.ids || ctx.ids.includes(item.entity.id))) {
      if (!ctx.promoted.has(wrapper.entity.id)) {
        ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
        continue;
      }
      ctx.emit(seedStateGraphSteps(wrapper.entity));
    }
  },
};
