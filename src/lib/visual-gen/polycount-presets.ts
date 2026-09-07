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
 *
 * CEILING, NOT A TARGET TO MAX OUT. These are per-class upper bounds for what may ship.
 * At the generator they behave differently: a generator SPENDS the budget it is handed,
 * so an over-generous one degrades the mesh rather than merely fattening it (observed on
 * hair — 3,000 quads resolved individual strands, 6,000 made the generator invent a whole
 * head). A simple asset should be requested well under its class ceiling. See the
 * `ai-3d-model-tier-and-budget-shaping` gotcha in `knowledge/ue-gotchas.ts`.
 */
import type { CritiqueDeps, CritiqueThresholds } from './mesh-critique';
import { nominalExtentFor, type SizeRequest } from './world-scale';

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
  /**
   * How the budget is SPENT — see {@link generationPlanFor}. `budgeted` hands the number
   * above to the generator; `max-then-finish` withholds it and leaves the budget to the
   * retopo/bake stage.
   */
  generation: GenerationStrategy;
  rationale: string;
}

/**
 * Where a class's face budget is enforced.
 *
 * `budgeted` — the generator is handed `face_limit` and delivers inside it.
 * `max-then-finish` — the generator is handed NO budget and delivers its densest mesh;
 * `mesh-finish` retopologizes to the class budget and bakes the lost detail into maps.
 *
 * The split is not a preference, it is the shipped `ai-lowpoly-generation-not-final`
 * rule written as code: direct low-poly generation is a dice-roll acceptable "only for
 * SMALL simple props", and anything bake-quality must be generated high-poly first,
 * because the detail that becomes the normal/AO bake only exists in the dense mesh.
 * Corroborated 2026-09-07 against a live building generation (Tripo Prism 3.1): the
 * generator's own low-poly mode returned holes in the geometry, a missing chimney
 * section and warped texture regions, while the same reference generated unbudgeted at
 * ~1.8M triangles and then retopologized held its detail at 39k.
 */
export type GenerationStrategy = 'budgeted' | 'max-then-finish';

export const POLYCOUNT_PRESETS: PolycountPreset[] = [
  {
    assetClass: 'character',
    label: 'Character (hero/NPC)',
    faceLimit: 40_000,
    warnAbove: 60_000,
    maxComponents: 24,
    generation: 'max-then-finish',
    rationale: 'Matches the character pipeline game-tier budget (40k faces, rig intact); hero characters carry the highest per-asset budget.',
  },
  {
    assetClass: 'weapon',
    label: 'Weapon / held item',
    faceLimit: 15_000,
    warnAbove: 22_500,
    maxComponents: 6,
    generation: 'budgeted',
    rationale: 'First-person-adjacent but small on screen at ARPG camera distance; silhouette + normal map carry the detail.',
  },
  {
    assetClass: 'prop',
    label: 'Prop / interactable',
    faceLimit: 10_000,
    warnAbove: 15_000,
    maxComponents: 6,
    generation: 'budgeted',
    rationale: 'Placed many times per scene; Nanite tolerates more but generated props ship to non-Nanite paths (mobile preview, collision).',
  },
  {
    assetClass: 'environment',
    label: 'Environment piece / building',
    faceLimit: 60_000,
    warnAbove: 90_000,
    maxComponents: 40,
    generation: 'max-then-finish',
    rationale: 'Large silhouette pieces earn a bigger budget; still bounded because generated buildings fragment into many components.',
  },
  {
    assetClass: 'modular-part',
    label: 'Modular part / swap-slot piece',
    faceLimit: 8_000,
    warnAbove: 12_000,
    maxComponents: 3,
    generation: 'budgeted',
    rationale: 'Assembled in multiples onto one character/kit — the per-part budget must leave headroom for the assembled whole.',
  },
];

export const ASSET_CLASS_IDS: AssetClass[] = POLYCOUNT_PRESETS.map((p) => p.assetClass);

/** Resolve a preset by asset class; undefined for unknown classes. */
export function polycountFor(assetClass: string): PolycountPreset | undefined {
  return POLYCOUNT_PRESETS.find((p) => p.assetClass === assetClass);
}

export interface GenerationPlan {
  assetClass: AssetClass;
  strategy: GenerationStrategy;
  /**
   * The budget to hand the generator (`face_limit`), or undefined when the class defers
   * it. Undefined is a DECISION, not a missing value — a caller must send no budget at
   * all rather than substituting a default, or the deferral does not happen.
   */
  faceLimit?: number;
  /** The budget the finished mesh must land inside. Always the class budget. */
  finishTargetFaces: number;
  /** One line naming the strategy and why, safe to report verbatim on a job response. */
  rationale: string;
}

/**
 * How a class should be generated. Pure; undefined for an unknown class — a strategy is
 * never invented, because guessing `max-then-finish` would silently drop a caller's
 * budget and guessing `budgeted` would silently cap a hero asset.
 */
export function generationPlanFor(assetClass: string): GenerationPlan | undefined {
  const p = polycountFor(assetClass);
  if (!p) return undefined;
  const deferred = p.generation === 'max-then-finish';
  return {
    assetClass: p.assetClass,
    strategy: p.generation,
    ...(deferred ? {} : { faceLimit: p.faceLimit }),
    finishTargetFaces: p.faceLimit,
    rationale: deferred
      ? `${p.label} is generated WITHOUT a face budget — the generator's own low-poly output loses the detail the high→low bake needs — and mesh-finish retopologizes it to ${p.faceLimit} faces afterwards`
      : `${p.label} is generated inside its ${p.faceLimit}-face budget: small simple assets survive direct low-poly generation, and spending a provider roll on detail that is only decimated away later is waste`,
  };
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

export interface ResolvedAssetClass {
  /** The recognised class, or undefined — a class is NEVER invented for a caller. */
  assetClass?: AssetClass;
  /** One line naming what the mesh will actually be graded against. */
  gradedAs: string;
}

/**
 * Resolve the `assetClass` a caller sent into the class the gate will grade by, plus a
 * sentence stating it. Pure.
 *
 * The stated default is **unclassified**: absent (or unrecognised) input does NOT get
 * silently promoted to some "typical" class, because that would grade a character
 * against a prop's component budget and fail it for being assembled. It degrades to the
 * class-blind defaults — the same behaviour as before — with the difference that the
 * degradation is now REPORTED instead of invisible. An unknown string in particular used
 * to vanish into an empty threshold override with no signal anywhere.
 */
export function resolveAssetClass(assetClass: string | undefined): ResolvedAssetClass {
  if (!assetClass) {
    return {
      gradedAs: `no assetClass supplied — graded class-blind against the default ceilings; send one of ${ASSET_CLASS_IDS.join(', ')} to grade against a class budget`,
    };
  }
  const preset = polycountFor(assetClass);
  if (!preset) {
    return {
      gradedAs: `unrecognised assetClass "${assetClass}" — graded class-blind against the default ceilings; known classes are ${ASSET_CLASS_IDS.join(', ')}`,
    };
  }
  return {
    assetClass: preset.assetClass,
    gradedAs: `graded against the ${preset.label} budget (${preset.faceLimit} tri target, warn above ${preset.warnAbove}, up to ${preset.maxComponents} parts)`,
  };
}

/** Class-aware Tier-1 gate thresholds — empty for unknown classes (defaults apply). */
export function critiqueThresholdsFor(assetClass: string): Partial<CritiqueThresholds> {
  const p = polycountFor(assetClass);
  return p ? { maxFacesWarn: p.warnAbove, maxComponentsFail: p.maxComponents } : {};
}

/**
 * Tier-1 gate deps for a generator that cannot be handed a face budget (TripoSR,
 * Hunyuan3D). Pure.
 *
 * Deliberately sets `thresholds` + `size` but NOT `budget`: `budget` means "the budget
 * this generation was REQUESTED at", and these providers accept no such request — a
 * fabricated one would report "the provider ignored your budget" about a budget nobody
 * ever sent. The class CEILING (`warnAbove`) is the honest class-aware line for them,
 * and it is what these two stores were missing entirely: every local mesh was graded
 * against the class-blind 200k default, which is the exact bug `polycount-presets`
 * exists to fix.
 */
export function localCritiqueDeps(
  assetClass: string | undefined,
  targetExtentM?: number,
): { deps: CritiqueDeps; gradedAs: string } {
  const resolved = resolveAssetClass(assetClass);
  const thresholds = resolved.assetClass ? critiqueThresholdsFor(resolved.assetClass) : {};
  const extent = targetExtentM ?? nominalExtentFor(resolved.assetClass);
  const size: SizeRequest | undefined = extent !== undefined ? { targetExtentM: extent } : undefined;
  // These are GENERATORS, so what they hand this gate is pre-retopo output. Declaring the
  // stage is a statement of fact about the producer, not a guess about the mesh — and it
  // is what stops a failing verdict reading as a defect when it is an un-finished input.
  return { deps: { thresholds, size, stage: 'raw' }, gradedAs: resolved.gradedAs };
}
