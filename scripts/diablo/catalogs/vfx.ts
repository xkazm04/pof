import {
  seedMissileSteps,
  UNUSED_MISSILES,
  withMissileSpecs,
} from '@/lib/catalog/reference/missileSpecs';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import type { CatalogHandler } from './types';

export const vfxHandler: CatalogHandler = {
  catalogId: 'vfx',
  pool: (_db, _sourceId, wrappers) =>
    withMissileSpecs(
      wrappers.filter((wrapper) => wrapper.file === 'missiles/misdat.tsv'),
      wrappers.filter((wrapper) => wrapper.catalogId === 'bestiary'),
    ),
  seed: (ctx) => {
    const wrappers = listWrappers(ctx.db, { sourceId: ctx.sourceId, catalogId: 'vfx' })
      .filter((wrapper) => wrapper.file === 'missiles/misdat.tsv')
      .filter((wrapper) => !ctx.ids || ctx.ids.includes(wrapper.entity.id));
    for (const wrapper of wrappers) {
      if (!ctx.promoted.has(wrapper.entity.id)) {
        ctx.print(`SKIP ${wrapper.entity.id}: not promoted (promote it first)`);
        continue;
      }
      ctx.emit(seedMissileSteps(wrapper));
    }
  },
  report: () => ({
    afterSummary: [
      `missiles used by no spell spec or monster AI attack: ${UNUSED_MISSILES.join(', ') || '(none)'}`,
    ],
  }),
};

