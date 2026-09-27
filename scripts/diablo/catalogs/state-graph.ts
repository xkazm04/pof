import { aiDecisionGraphEntities, seedAiDecisionGraphSteps } from '@/lib/catalog/reference/aiDecisionGraphs';
import { seedStateGraphSteps, stateGraphEntities } from '@/lib/catalog/reference/stateGraphSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

const allStateGraphEntities = () => [...stateGraphEntities(), ...aiDecisionGraphEntities()];

export const stateGraphHandler: CatalogHandler = {
  catalogId: 'state-graph',
  standalonePromotion: true,
  pool: () => allStateGraphEntities() as unknown as ReferenceWrapper[],
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
