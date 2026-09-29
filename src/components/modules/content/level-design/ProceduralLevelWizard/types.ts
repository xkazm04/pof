// ── Types ──
//
// The wizard's vocabulary IS the ProcgenSpec's: these names are aliases of the
// lib types, not a parallel family. The only wizard-local shape is SizeParams,
// the five size fields grouped for the sliders.

import type { PreviewAlgorithm } from '@/lib/level-design/algo-params';
import type { ProcgenLevelType, ProcgenConstraints } from '@/lib/level-design/procgen-spec';

export type GenAlgorithm = PreviewAlgorithm;
export type LevelType = ProcgenLevelType;
export type GameplayConstraints = ProcgenConstraints;

export interface SizeParams {
  gridWidth: number;
  gridHeight: number;
  roomCountMin: number;
  roomCountMax: number;
  corridorWidth: number;
}
