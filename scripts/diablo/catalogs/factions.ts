import { loreFactionEntities } from '@/lib/catalog/reference/loreFactions';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { loreGraphPath, promotionLoreGraph } from './loreFacts';
import type { CatalogHandler } from './types';

export const factionsHandler: CatalogHandler = {
  catalogId: 'factions',
  standalonePromotion: true,
  pool: () => loreFactionEntities(promotionLoreGraph(), loreGraphPath()) as unknown as ReferenceWrapper[],
};
