import {
  inputEntity,
  movementEntity,
  seedInputSteps,
  seedMovementSteps,
} from '@/lib/catalog/reference/movementSpecs';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

export const playerMovementHandler: CatalogHandler = {
  catalogId: 'player-movement',
  standalonePromotion: true,
  pool: () => [movementEntity()] as unknown as ReferenceWrapper[],
  seed: (ctx) => {
    const wrapper = movementEntity();
    if (ctx.ids && !ctx.ids.includes(wrapper.entity.id)) return;
    if (!ctx.promoted.has(wrapper.entity.id)) {
      ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
      return;
    }
    ctx.emit(seedMovementSteps(wrapper.entity));
    ctx.print(`MISFIT ${wrapper.entity.id}: all player-movement steps require target-side UE assets or a live playable gate; the engine spec remains on the entity and no false asset envelope was seeded`);
  },
};

export const inputSchemesHandler: CatalogHandler = {
  catalogId: 'input-schemes',
  standalonePromotion: true,
  pool: () => [inputEntity()] as unknown as ReferenceWrapper[],
  seed: (ctx) => {
    const wrapper = inputEntity();
    if (ctx.ids && !ctx.ids.includes(wrapper.entity.id)) return;
    if (!ctx.promoted.has(wrapper.entity.id)) {
      ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
      return;
    }
    ctx.emit(seedInputSteps(wrapper.entity));
  },
};
