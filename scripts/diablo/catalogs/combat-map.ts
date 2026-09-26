import { combatGameMode } from '@/lib/catalog/reference/combatInputs';
import type { Difficulty } from '@/lib/catalog/reference/combatMath';
import {
  DEFAULT_TILES_PER_LEVEL_ASSUMPTION,
  descentEntity,
  type DescentClassName,
  type StatPointPolicy,
} from '@/lib/catalog/reference/descentSim';
import { arg, requestedIds } from './args';
import type { CatalogHandler } from './types';

export const combatMapHandler: CatalogHandler = {
  catalogId: 'combat-map',
  pool: (_db, _sourceId, wrappers) => {
    const classFromId = requestedIds()
      ?.map((id) => /^d1-descent-(warrior|rogue|sorcerer)$/.exec(id)?.[1])
      .find(Boolean);
    const weaponId = arg('weapon');
    const weapon = weaponId
      ? wrappers.find((wrapper) => wrapper.catalogId === 'items' && wrapper.entity.id === weaponId)
      : undefined;
    if (weaponId && !weapon) throw new Error(`no items wrapper ${weaponId}`);
    return [descentEntity({
      className: (arg('class') ?? classFromId ?? 'warrior') as DescentClassName,
      policy: (arg('policy') ?? 'none') as StatPointPolicy,
      tilesPerLevel: Number(arg('tiles-per-level') ?? DEFAULT_TILES_PER_LEVEL_ASSUMPTION),
      gameMode: combatGameMode(process.argv),
      difficulty: (arg('difficulty') ?? 'normal') as Difficulty,
      weapon,
      wrappers,
    })];
  },
  seed: (ctx) => {
    const requested = (ctx.ids ?? [...ctx.promoted]).filter((id) => id.startsWith('d1-descent-'));
    for (const id of requested) {
      if (!ctx.promoted.has(id)) {
        ctx.print(`SKIP ${id}: not promoted (promote it first)`);
        continue;
      }
      ctx.print(`MISFIT ${id}: combat-map Balance is a fixed three-bin histogram, not a per-depth curve; no SOURCED step artifact was written`);
    }
  },
};
