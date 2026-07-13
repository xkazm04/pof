/**
 * Polycount presets — per-asset-class face budgets for generated 3D meshes.
 *
 * Two consumers:
 *  - generation: pass `faceLimit` to budget-aware providers (Tripo `face_limit`) so the
 *    mesh is generated inside its class budget instead of decimated after the fact;
 *  - critique: `critiqueThresholdsFor` feeds the Tier-1 gate (`scoreMesh`) a class-aware
 *    `maxFacesWarn` — a 150k-face prop is a problem the class-blind 200k default missed.
 *
 * Budgets are game-ready UE5 targets at ARPG camera distance. The character budget is
 * locked to the character pipeline's game-tier spec (40k) — keep them in sync.
 */
import type { CritiqueThresholds } from './mesh-critique';

export type AssetClass = 'character' | 'weapon' | 'prop' | 'environment' | 'modular-part';

export interface PolycountPreset {
  assetClass: AssetClass;
  label: string;
  /** Generation target — passed to providers that accept a face budget (Tripo `face_limit`). */
  faceLimit: number;
  /** Critique line — above this the Tier-1 gate warns "needs decimation". */
  warnAbove: number;
  rationale: string;
}

export const POLYCOUNT_PRESETS: PolycountPreset[] = [
  {
    assetClass: 'character',
    label: 'Character (hero/NPC)',
    faceLimit: 40_000,
    warnAbove: 60_000,
    rationale: 'Matches the character pipeline game-tier budget (40k faces, rig intact); hero characters carry the highest per-asset budget.',
  },
  {
    assetClass: 'weapon',
    label: 'Weapon / held item',
    faceLimit: 15_000,
    warnAbove: 22_500,
    rationale: 'First-person-adjacent but small on screen at ARPG camera distance; silhouette + normal map carry the detail.',
  },
  {
    assetClass: 'prop',
    label: 'Prop / interactable',
    faceLimit: 10_000,
    warnAbove: 15_000,
    rationale: 'Placed many times per scene; Nanite tolerates more but generated props ship to non-Nanite paths (mobile preview, collision).',
  },
  {
    assetClass: 'environment',
    label: 'Environment piece / building',
    faceLimit: 60_000,
    warnAbove: 90_000,
    rationale: 'Large silhouette pieces earn a bigger budget; still bounded because generated buildings fragment into many components.',
  },
  {
    assetClass: 'modular-part',
    label: 'Modular part / swap-slot piece',
    faceLimit: 8_000,
    warnAbove: 12_000,
    rationale: 'Assembled in multiples onto one character/kit — the per-part budget must leave headroom for the assembled whole.',
  },
];

export const ASSET_CLASS_IDS: AssetClass[] = POLYCOUNT_PRESETS.map((p) => p.assetClass);

/** Resolve a preset by asset class; undefined for unknown classes. */
export function polycountFor(assetClass: string): PolycountPreset | undefined {
  return POLYCOUNT_PRESETS.find((p) => p.assetClass === assetClass);
}

/** Class-aware Tier-1 gate thresholds — empty for unknown classes (defaults apply). */
export function critiqueThresholdsFor(assetClass: string): Partial<CritiqueThresholds> {
  const p = polycountFor(assetClass);
  return p ? { maxFacesWarn: p.warnAbove } : {};
}
