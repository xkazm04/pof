import { aggregateClassWrappers } from '@/lib/catalog/reference/classHeroes';
import { withClassSwingTimes } from '@/lib/catalog/reference/combatInputs';
import { selectForPromotion } from '@/lib/catalog/reference/promote';
import {
  effectiveUniqueItemsForPromotion,
  type EffectiveUniqueItemsResult,
} from '@/lib/catalog/reference/uniqueItems';
import type { CatalogHandler } from './types';
import { promotionOptions } from './args';

let uniqueItemReport: EffectiveUniqueItemsResult | null = null;

export const itemsHandler: CatalogHandler = {
  catalogId: 'items',
  pool: (_db, _sourceId, wrappers) => {
    const items = wrappers.filter((wrapper) => wrapper.catalogId === 'items');
    const selected = selectForPromotion(items, promotionOptions('items'));
    uniqueItemReport = effectiveUniqueItemsForPromotion(selected, items);
    const classes = aggregateClassWrappers(wrappers.filter((wrapper) => wrapper.catalogId === 'characters'));
    const enriched = withClassSwingTimes(uniqueItemReport.wrappers, classes);
    uniqueItemReport = { ...uniqueItemReport, wrappers: enriched };
    return enriched;
  },
  report: () => ({
    uniqueItemReport,
    afterSummary: uniqueItemReport?.unresolved.map(
      (item) => `   UNRESOLVED ${item.entityId}: ${item.reason}`,
    ) ?? [],
  }),
};
