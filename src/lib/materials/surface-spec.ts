/**
 * The material configurator's ONE surface spec.
 *
 * The Configure tab used to keep seven hand-copied per-surface tables across
 * four files, and two of them disagreed about the UE shading model: the cost
 * estimator (shown in the Shader Budget bar) and the prompt builder (what
 * actually dispatched) differed on 352 of the 512 surface x feature
 * combinations. Every consumer now reads this module:
 *
 * - `SURFACE_SPEC` — one row per surface: prompt label, Roughness/Metallic
 *   defaults, default features, base sampler/instruction cost and the shading
 *   path (forced by the surface, or a default that features can override).
 * - `resolveShadingModel` — the only authority for which model a surface +
 *   feature set compiles with; `shadingModelLabel` is its UE display name.
 * - `FORBIDDEN_COMBINATIONS` / `refusalFor` — feature sets that must not
 *   dispatch (the estimator's error rows read the same table).
 *
 * Same shape as `lib/visual-gen/material-boundary.ts` (the Material Lab's one
 * colour theory): a table plus pure resolvers, no UI. Colours and icons stay in
 * the component's constants.ts. PURE: no imports, no clock, no I/O.
 */

export type SurfaceType = 'metal' | 'cloth' | 'skin' | 'glass' | 'water' | 'emissive' | 'foliage' | 'stone';
export type RenderFeature = 'subsurface' | 'parallax' | 'emissive' | 'refraction' | 'tessellation' | 'worldPositionOffset';

/** The UE shading model a material compiles with (Material > Shading Model). */
export type ShadingModel =
  | 'DefaultLit' | 'SubsurfaceProfile' | 'Subsurface' | 'TwoSidedFoliage' | 'ThinTranslucent' | 'Cloth';

export interface SurfaceSpec {
  /** The surface line in the dispatched prompt. */
  promptLabel: string;
  /** Slider defaults `selectSurface` (and the initial state) apply. */
  defaults: { Roughness: number; Metallic: number };
  /** Features switched on when the surface is picked. */
  defaultFeatures: RenderFeature[];
  /** Base cost before features: texture samplers, instruction count, which maps. */
  base: { samplers: number; instructions: number; mapNotes: string };
  /**
   * `forced`: the surface fixes the model whatever features are on (skin, foliage,
   * cloth). `default`: features may override it (subsurface, refraction).
   */
  shading: { kind: 'forced' | 'default'; model: ShadingModel };
}

export const SURFACE_TYPES: readonly SurfaceType[] = ['metal', 'cloth', 'skin', 'glass', 'water', 'emissive', 'foliage', 'stone'];
export const RENDER_FEATURES: readonly RenderFeature[] = ['subsurface', 'parallax', 'emissive', 'refraction', 'tessellation', 'worldPositionOffset'];

export const SURFACE_SPEC: Record<SurfaceType, SurfaceSpec> = {
  // Albedo + Normal + ORM (RoughMetalAO packed) ≈ 3.
  metal: {
    promptLabel: 'Metallic (PBR metal workflow)', defaults: { Roughness: 0.2, Metallic: 1 }, defaultFeatures: [],
    base: { samplers: 3, instructions: 60, mapNotes: 'Albedo + Normal + ORM' }, shading: { kind: 'default', model: 'DefaultLit' },
  },
  cloth: {
    promptLabel: 'Cloth / Fabric (fuzz, anisotropy)', defaults: { Roughness: 0.8, Metallic: 0 }, defaultFeatures: ['subsurface'],
    base: { samplers: 4, instructions: 80, mapNotes: 'Albedo + Normal + ORM + Sheen' }, shading: { kind: 'forced', model: 'Cloth' },
  },
  // Skin: Albedo + Normal + ORM + SSS thickness + cavity.
  skin: {
    promptLabel: 'Skin (subsurface scattering profile)', defaults: { Roughness: 0.6, Metallic: 0 }, defaultFeatures: ['subsurface'],
    base: { samplers: 5, instructions: 110, mapNotes: 'Albedo + Normal + ORM + SSS + Cavity' }, shading: { kind: 'forced', model: 'SubsurfaceProfile' },
  },
  glass: {
    promptLabel: 'Glass (translucent, refractive)', defaults: { Roughness: 0.05, Metallic: 0 }, defaultFeatures: ['refraction'],
    base: { samplers: 3, instructions: 90, mapNotes: 'Albedo + Normal + Refraction normal' }, shading: { kind: 'default', model: 'ThinTranslucent' },
  },
  water: {
    promptLabel: 'Water (animated, depth-based)', defaults: { Roughness: 0.02, Metallic: 0 }, defaultFeatures: ['refraction', 'worldPositionOffset'],
    base: { samplers: 4, instructions: 130, mapNotes: 'Normal A/B + Caustics + Mask' }, shading: { kind: 'default', model: 'ThinTranslucent' },
  },
  emissive: {
    promptLabel: 'Emissive (self-illuminated)', defaults: { Roughness: 0.5, Metallic: 0 }, defaultFeatures: ['emissive'],
    base: { samplers: 3, instructions: 50, mapNotes: 'Emissive + Mask + Color ramp' }, shading: { kind: 'default', model: 'DefaultLit' },
  },
  foliage: {
    promptLabel: 'Foliage (two-sided, subsurface)', defaults: { Roughness: 0.5, Metallic: 0 }, defaultFeatures: ['subsurface', 'worldPositionOffset'],
    base: { samplers: 4, instructions: 95, mapNotes: 'Albedo + Normal + ORM + SSS' }, shading: { kind: 'forced', model: 'TwoSidedFoliage' },
  },
  stone: {
    promptLabel: 'Stone / Rock (parallax detail)', defaults: { Roughness: 0.7, Metallic: 0 }, defaultFeatures: ['parallax'],
    base: { samplers: 4, instructions: 80, mapNotes: 'Albedo + Normal + ORM + Height' }, shading: { kind: 'default', model: 'DefaultLit' },
  },
};

/**
 * The shading model a surface + feature set compiles with. A forced surface wins;
 * otherwise Subsurface beats refraction's Thin Translucent, which beats the
 * surface default.
 */
export function resolveShadingModel(surface: SurfaceType, features: readonly RenderFeature[]): ShadingModel {
  const { shading } = SURFACE_SPEC[surface];
  if (shading.kind === 'forced') return shading.model;
  if (features.includes('subsurface')) return 'Subsurface';
  if (features.includes('refraction')) return 'ThinTranslucent';
  return shading.model;
}

const SHADING_LABEL: Record<ShadingModel, string> = {
  DefaultLit: 'Default Lit',
  SubsurfaceProfile: 'Subsurface Profile',
  Subsurface: 'Subsurface',
  TwoSidedFoliage: 'Two Sided Foliage',
  ThinTranslucent: 'Thin Translucent',
  Cloth: 'Cloth',
};

/** What the Substrate slab must carry to reproduce the model (empty for a plain slab). */
const SUBSTRATE_QUALIFIER: Record<ShadingModel, string> = {
  DefaultLit: '',
  SubsurfaceProfile: 'with subsurface',
  Subsurface: 'with subsurface',
  TwoSidedFoliage: 'two-sided',
  ThinTranslucent: 'translucent',
  Cloth: 'with fuzz',
};

/** UE's display name for a shading model, as the Material Details panel shows it. */
export function shadingModelLabel(model: ShadingModel): string {
  return SHADING_LABEL[model];
}

export function substrateQualifier(model: ShadingModel): string {
  return SUBSTRATE_QUALIFIER[model];
}

export interface ForbiddenCombination {
  features: readonly RenderFeature[];
  message: string;
  suggestion: string;
}

/** Feature sets the estimator calls an error and the configurator refuses to dispatch. */
export const FORBIDDEN_COMBINATIONS: readonly ForbiddenCombination[] = [
  {
    features: ['tessellation', 'parallax'],
    message: 'Tessellation + Parallax Occlusion give compounding cost without visible benefit.',
    suggestion: 'Pick one — usually Tessellation/Nanite for hero meshes, BumpOffset for everything else.',
  },
];

export function forbiddenCombinationsIn(features: readonly RenderFeature[]): ForbiddenCombination[] {
  return FORBIDDEN_COMBINATIONS.filter((c) => c.features.every((f) => features.includes(f)));
}

/** Why this feature set must not dispatch, or null when it may. */
export function refusalFor(features: readonly RenderFeature[]): string | null {
  const hits = forbiddenCombinationsIn(features);
  return hits.length > 0 ? hits.map((c) => `${c.message} ${c.suggestion}`).join(' ') : null;
}
