import { seededEntities } from '@/lib/catalog/seed';
import { seedQuestCausalityStep, withQuestCausality } from '@/lib/catalog/reference/questCausality';
import { seedQuestSteps } from '@/lib/catalog/reference/questSpecs';
import { withPromotionLoreFacts } from './loreFacts';
import type { CatalogHandler } from './types';

export const questsHandler: CatalogHandler = {
  catalogId: 'quests',
  pool: (_db, _sourceId, wrappers) => withPromotionLoreFacts(wrappers
    .filter((wrapper) => wrapper.catalogId === 'quests')
    .map((wrapper) => ({ ...wrapper, entity: withQuestCausality(wrapper.entity) }))),
  seed: (ctx) => {
    const conversations = seededEntities('dialog-trees').filter((entity) => entity.id.startsWith('d1-dialog-TOWN_'));
    for (const storedEntity of seededEntities('quests').filter(
      (item) => item.id.startsWith('d1-Q_') && (!ctx.ids || ctx.ids.includes(item.id)),
    )) {
      const entity = withQuestCausality(storedEntity);
      if (!ctx.promoted.has(entity.id)) {
        ctx.print(`SKIP ${entity.id}: not promoted (promote it first)`);
        continue;
      }
      const expansion = (entity.data as { derived?: { expansion?: unknown } } | undefined)?.derived?.expansion;
      if (expansion === 'hellfire') {
        ctx.print(`OUT OF SCOPE ${entity.id}: d1-quest-scope-law limits engine-derived quest specs to vanilla Diablo I`);
        continue;
      }
      const causalitySeed = seedQuestCausalityStep(entity);
      ctx.emit(seedQuestSteps(entity, conversations).map((seed) =>
        seed.step === 'Triggers & World-State' && causalitySeed ? causalitySeed : seed));
    }
  },
};
