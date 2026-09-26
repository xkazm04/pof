import { aggregateClassWrappers } from '@/lib/catalog/reference/classHeroes';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import type { CatalogHandler } from './types';

export const charactersHandler: CatalogHandler = {
  catalogId: 'characters',
  pool: (_db, _sourceId, wrappers) =>
    aggregateClassWrappers(wrappers.filter((wrapper) => wrapper.catalogId === 'characters')),
  seed: (ctx) => {
    const wrappers = aggregateClassWrappers(listWrappers(ctx.db, {
      sourceId: ctx.sourceId,
      catalogId: 'characters',
    })).filter((wrapper) => !ctx.ids || ctx.ids.includes(wrapper.entity.id));
    ctx.generic(wrappers);
  },
};
