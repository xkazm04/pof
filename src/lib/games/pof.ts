import type { GameDef } from './types';

/**
 * PoF's own game. `diablo1` is a canon INSIDE this game (the /diablo loop replicates Diablo I into
 * PoF's tree and UE project), not a second game. `manifest: 'all'` keeps today's view byte-identical.
 * `engine.root: null` here means "resolved by the existing chain" (`resolveUeRoot()`), see ueBinding.ts.
 */
export const POF_GAME: GameDef = {
  id: 'pof',
  title: 'Pillars of Fortune',
  canonProfiles: ['pof', 'diablo1'],
  manifest: 'all',
  engine: { kind: 'ue5', root: null },
};
