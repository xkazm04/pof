import { seededEntities } from '@/lib/catalog/seed';
import { seedQuestSteps } from '@/lib/catalog/reference/questSpecs';
import type { CatalogHandler } from './types';

export const questsHandler: CatalogHandler = {
  catalogId: 'quests',
  seed: (ctx) => {
    const conversations = seededEntities('dialog-trees').filter((entity) => entity.id.startsWith('d1-dialog-TOWN_'));
    for (const entity of seededEntities('quests').filter(
      (item) => item.id.startsWith('d1-Q_') && (!ctx.ids || ctx.ids.includes(item.id)),
    )) {
      if (!ctx.promoted.has(entity.id)) {
        ctx.print(`SKIP ${entity.id}: not promoted (promote it first)`);
        continue;
      }
      const expansion = (entity.data as { derived?: { expansion?: unknown } } | undefined)?.derived?.expansion;
      if (expansion === 'hellfire') {
        ctx.print(`OUT OF SCOPE ${entity.id}: d1-quest-scope-law limits engine-derived quest specs to vanilla Diablo I`);
        continue;
      }
      ctx.emit(seedQuestSteps(entity, conversations));
    }
  },
};
