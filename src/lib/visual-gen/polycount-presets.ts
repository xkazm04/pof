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
  /**
   * Substantial disconnected parts the class may legitimately have. A character is
   * ASSEMBLED (head, lashes, brows, eye layers, mouth interior, teeth, tongue, body,
   * hands, hair, cape, accessories); the class-blind default of 8 failed such a mesh as
   * "fragmented". Specks are policed separately by the floater rule, which no class relaxes.
   */
  maxComponents: number;
  rationale: string;
}

export const POLYCOUNT_PRESETS: PolycountPreset[] = [
  {
    assetClass: 'character',
    label: 'Character (hero/NPC)',
    faceLimit: 40_000,
    warnAbove: 60_000,
    maxComponents: 24,
    rationale: 'Matches the character pipeline game-tier budget (40k faces, rig intact); hero characters carry the highest per-asset budget.',
  },
  {
    assetClass: 'weapon',
    label: 'Weapon / held item',
    faceLimit: 15_000,
    warnAbove: 22_500,
    maxComponents: 6,
    rationale: 'First-person-adjacent but small on screen at ARPG camera distance; silhouette + normal map carry the detail.',
  },
  {
    assetClass: 'prop',
    label: 'Prop / interactable',
    faceLimit: 10_000,
    warnAbove: 15_000,
    maxComponents: 6,
    rationale: 'Placed many times per scene; Nanite tolerates more but generated props ship to non-Nanite paths (mobile preview, collision).',
  },
  {
    assetClass: 'environment',
    label: 'Environment piece / building',
    faceLimit: 60_000,
    warnAbove: 90_000,
    maxComponents: 40,
    rationale: 'Large silhouette pieces earn a bigger budget; still bounded because generated buildings fragment into many components.',
  },
  {
    assetClass: 'modular-part',
    label: 'Modular part / swap-slot piece',
    faceLimit: 8_000,
    warnAbove: 12_000,
    maxComponents: 3,
    rationale: 'Assembled in multiples onto one character/kit — the per-part budget must leave headroom for the assembled whole.',
  },
];

export const ASSET_CLASS_IDS: AssetClass[] = POLYCOUNT_PRESETS.map((p) => p.assetClass);

/** Resolve a preset by asset class; undefined for unknown classes. */
export function polycountFor(assetClass: string): PolycountPreset | undefined {
  return POLYCOUNT_PRESETS.find((p) => p.assetClass === assetClass);
}

export interface PartBudget {
  assetClass: AssetClass;
  parts: number;
  /** Face budget for ONE part, chosen so the assembled whole stays inside its class budget. */
  perPartFaceLimit: number;
  /** The budget the assembled asset must land inside. */
  assembledFaceLimit: number;
  /** True when the naive per-part budget would have overrun the assembled whole. */
  constrained: boolean;
  rationale: string;
}

/**
 * Budget ONE part of a part-split generation.
 *
 * Generating a character in disconnected parts (body / head / hands / pack / props) is
 * the endorsed workflow — it beats single-shot on every part's local quality. But each
 * part was previously budgeted at the flat `modular-part` limit, and nothing checked the
 * sum: eight parts at 8k is 64k against a 40k character budget. The `modular-part`
 * rationale only *claimed* headroom; this computes it.
 *
 * Returns undefined for an unknown class or a non-positive part count — a budget that
 * cannot be honoured is never invented.
 */
export function planPartBudget(assetClass: string, parts: number): PartBudget | undefined {
  const whole = polycountFor(assetClass);
  const part = polycountFor('modular-part');
  if (!whole || !part || !Number.isFinite(parts) || parts < 1) return undefined;

  const naive = part.faceLimit;
  const fair = Math.floor(whole.faceLimit / parts);
  const constrained = naive * parts > whole.faceLimit;

  return {
    assetClass: whole.assetClass,
    parts,
    perPartFaceLimit: constrained ? fair : naive,
    assembledFaceLimit: whole.faceLimit,
    constrained,
    rationale: constrained
      ? `${parts} parts at the ${naive}-face modular budget would reach ${naive * parts} faces, past the ${whole.faceLimit}-face ${whole.assetClass} budget — each part is cut to ${fair}.`
      : `${parts} parts at the ${naive}-face modular budget total ${naive * parts} faces, inside the ${whole.faceLimit}-face ${whole.assetClass} budget.`,
  };
}

/** Class-aware Tier-1 gate thresholds — empty for unknown classes (defaults apply). */
export function critiqueThresholdsFor(assetClass: string): Partial<CritiqueThresholds> {
  const p = polycountFor(assetClass);
  return p ? { maxFacesWarn: p.warnAbove, maxComponentsFail: p.maxComponents } : {};
}
