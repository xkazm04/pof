import type { GameDef } from './types';

/**
 * GTAI: Uprising — a top-down open-city crime sandbox (rogue factory robot, hitman contracts for
 * underground robot bosses). The engine is chosen after the design contest verdict, so it is
 * `undecided` and every UE-bound acceptance for a gtai entity defers with that reason.
 *
 * STUB (wire commit): WP1 fills `manifest` with every registered pipeline's fit + the planned genre
 * pipelines. Until then the manifest is empty — the game shows nothing, which is honest.
 */
export const GTAI_GAME: GameDef = {
  id: 'gtai',
  title: 'GTAI: Uprising',
  canonProfiles: ['gtai'],
  manifest: [],
  engine: { kind: 'undecided' },
  designDir: 'games/gtai',
};
