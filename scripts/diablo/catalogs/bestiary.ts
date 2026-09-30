import { selectForPromotion } from '@/lib/catalog/reference/promote';
import { withMonsterAttackLedgers } from '@/lib/catalog/reference/monsterAttackLedger';
import { withMonsterMissileGraphs } from '@/lib/catalog/reference/missileBehaviourGraphs';
import {
  effectiveUniqueMonstersForPromotion,
  type EffectiveUniqueMonstersResult,
} from '@/lib/catalog/reference/uniqueMonsters';
import type { CatalogHandler } from './types';
import { promotionOptions } from './args';

let uniqueMonsterReport: EffectiveUniqueMonstersResult | null = null;

export const bestiaryHandler: CatalogHandler = {
  catalogId: 'bestiary',
  pool: (_db, _sourceId, wrappers) => {
    const bestiary = wrappers.filter((wrapper) => wrapper.catalogId === 'bestiary');
    const selected = selectForPromotion(bestiary, promotionOptions('bestiary'));
    uniqueMonsterReport = effectiveUniqueMonstersForPromotion(selected, bestiary);
    return withMonsterMissileGraphs(withMonsterAttackLedgers(uniqueMonsterReport.wrappers, bestiary));
  },
  report: () => ({
    afterSummary: uniqueMonsterReport?.unresolved.map(
      (monster) => `   UNRESOLVED ${monster.entityId}: ${monster.reason}`,
    ) ?? [],
  }),
};
