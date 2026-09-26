import { seedObjectSteps, withObjectSpecs } from '@/lib/catalog/reference/objectSpecs';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import type { CatalogHandler, SeedContext } from './types';

export const propsHandler: CatalogHandler = {
  catalogId: 'props',
  pool: (_db, _sourceId, wrappers) =>
    withObjectSpecs(wrappers.filter((wrapper) => wrapper.catalogId === 'props')),
  seed: (ctx) => {
    const wrappers = withObjectSpecs(listCatalogWrappers(ctx)).filter(
      (item) => !ctx.ids || ctx.ids.includes(item.entity.id),
    );
    for (const wrapper of wrappers) {
      if (!ctx.promoted.has(wrapper.entity.id)) {
        ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
        continue;
      }
      ctx.emit(seedObjectSteps(wrapper));
    }
  },
};

const listCatalogWrappers = (ctx: SeedContext) =>
  listWrappers(ctx.db, { sourceId: ctx.sourceId, catalogId: 'props' });
