import { seededEntities } from '@/lib/catalog/seed';
import { affixFamilies, seedAffixSteps } from '@/lib/catalog/reference/affixFamilies';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

export const affixesHandler: CatalogHandler = {
  catalogId: 'affixes',
  pool: (_db, _sourceId, wrappers) =>
    affixFamilies(wrappers.filter((wrapper) => wrapper.catalogId === 'affixes')) as unknown as ReferenceWrapper[],
  seed: (ctx) => {
    for (const entity of seededEntities('affixes').filter(
      (item) => item.id.startsWith('d1-affix-') && (!ctx.ids || ctx.ids.includes(item.id)),
    )) {
      ctx.emit(seedAffixSteps(entity as unknown as ReferenceWrapper['entity']));
    }
  },
};
