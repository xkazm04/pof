import { seedVendorSteps, vendorEntities } from '@/lib/catalog/reference/storeSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

export const vendorsHandler: CatalogHandler = {
  catalogId: 'vendors',
  standalonePromotion: true,
  pool: () => vendorEntities() as unknown as ReferenceWrapper[],
  seed: (ctx) => {
    for (const wrapper of vendorEntities().filter((item) => !ctx.ids || ctx.ids.includes(item.entity.id))) {
      if (!ctx.promoted.has(wrapper.entity.id)) {
        ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
        continue;
      }
      ctx.emit(seedVendorSteps(wrapper.entity));
    }
  },
};
