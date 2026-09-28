import { locationEntities, seedLocationSteps } from '@/lib/catalog/reference/locationSpecs';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { withPromotionLoreFacts } from './loreFacts';
import type { CatalogHandler } from './types';

export const zoneMapHandler: CatalogHandler = {
  catalogId: 'zone-map',
  pool: (_db, _sourceId, wrappers) => withPromotionLoreFacts(
    locationEntities(wrappers) as unknown as ReferenceWrapper[],
  ),
  seed: (ctx) => {
    const wrappers = locationEntities(listWrappers(ctx.db, { sourceId: ctx.sourceId }))
      .filter((item) => !ctx.ids || ctx.ids.includes(item.entity.id));
    for (const wrapper of wrappers) {
      if (!ctx.promoted.has(wrapper.entity.id)) {
        ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
        continue;
      }
      ctx.emit(seedLocationSteps(wrapper.entity));
    }
  },
};
