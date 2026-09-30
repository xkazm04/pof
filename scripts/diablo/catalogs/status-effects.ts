import { seedStatusSteps, statusEntities } from '@/lib/catalog/reference/statusSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

export const statusEffectsHandler: CatalogHandler = {
  catalogId: 'status-effects',
  standalonePromotion: true,
  pool: () => statusEntities() as unknown as ReferenceWrapper[],
  seed: (ctx) => {
    for (const wrapper of statusEntities().filter((item) => !ctx.ids || ctx.ids.includes(item.entity.id))) {
      if (!ctx.promoted.has(wrapper.entity.id)) {
        ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
        continue;
      }
      ctx.emit(seedStatusSteps(wrapper.entity));
    }
  },
};
