// ── Post-Process Recipe Studio Types ────────────────────────────────────────

/**
 * The kind of tiny visual cue rendered next to a parameter in explain mode.
 * Each kind is drawn by {@link '@/components/modules/evaluator/ParamCue'} and
 * animates against the parameter's normalized 0-1 value, so a non-technical
 * user can *see* what a slider does without knowing the UE term behind it.
 */
export type PPParamCueKind =
  | 'glow'        // halo bleeding from bright spots (bloom intensity)
  | 'blur'        // soft / wide spread (bloom size, softness)
  | 'threshold'   // a cutoff marker on a dark→bright scale
  | 'temperature' // cool-blue ↔ warm-orange color cast
  | 'tint'        // green ↔ magenta color cast
  | 'saturation'  // grey ↔ vivid color richness
  | 'contrast'    // flat ↔ punchy tonal separation
  | 'brightness'  // dark ↔ light swatch
  | 'distance'    // near ↔ far marker on a depth scale
  | 'aperture'    // camera iris opening (depth-of-field f-stop)
  | 'corners'     // contact shadows darkening in crevices (AO)
  | 'vignette'    // darkened screen edges
  | 'speed'       // motion streak / adaptation speed
  | 'fringe'      // RGB channel split (chromatic aberration)
  | 'grain'       // film-grain speckle density
  | 'fog'         // haze thickening over a scene
  | 'level'       // generic filled meter (more = more)
  | 'channel-r'   // red color-channel amount
  | 'channel-g'   // green color-channel amount
  | 'channel-b';  // blue color-channel amount

/**
 * Plain-language metadata for a parameter, surfaced when the user turns on
 * "explain mode". Demystifies a raw UE name (e.g. `SceneFringeIntensity`) with
 * an everyday label, a one-sentence explanation, a visual cue, and human words
 * for the two ends of the slider.
 */
export interface PPParamPlain {
  /** Jargon-free name, e.g. "Color Fringing" for `SceneFringeIntensity`. */
  label: string;
  /** One-sentence, everyday-language description of what the slider does. */
  explanation: string;
  /** Which tiny visual cue to render alongside the slider. */
  cue: PPParamCueKind;
  /** Human word for the low end of the slider (e.g. "Clean"). */
  lowLabel: string;
  /** Human word for the high end of the slider (e.g. "Trippy"). */
  highLabel: string;
}

/** Effect parameter with current slider value and UE5 metadata */
export interface PPStudioParam {
  name: string;
  description: string;
  type: 'float' | 'color' | 'bool' | 'int';
  defaultValue: number;
  value: number;
  min: number;
  max: number;
  step: number;
  ueProperty: string;
  /** Optional plain-language decoder metadata (drives explain mode). */
  plain?: PPParamPlain;
}

/** An effect in the studio with live-tunable parameters */
export interface PPStudioEffect {
  id: string;
  name: string;
  category: PPEffectCategory;
  ueClass: string;
  description: string;
  enabled: boolean;
  priority: number;
  params: PPStudioParam[];
  /** Estimated GPU cost in ms at 1080p */
  gpuCostMs: number;
}

export type PPEffectCategory = 'lighting' | 'color' | 'blur' | 'atmosphere' | 'special';

/** A named preset — a snapshot of a full effect stack */
export interface PPPreset {
  id: string;
  name: string;
  description: string;
  mood: PPMoodTag;
  /** Effect overrides: effectId → param name → value */
  overrides: Record<string, Record<string, number>>;
  /** Which effects are enabled */
  enabledEffects: string[];
  /** Thumbnail gradient colors for visual preview */
  gradientFrom: string;
  gradientTo: string;
}

export type PPMoodTag =
  | 'film-noir'
  | 'cyberpunk-neon'
  | 'horror-desaturation'
  | 'fantasy-bloom'
  | 'golden-hour'
  | 'arctic-cold'
  | 'underwater'
  | 'custom';

/** GPU cost estimation for a resolution tier */
export interface GPUCostEstimate {
  effectId: string;
  effectName: string;
  costMs: number;
  category: PPEffectCategory;
}

/** Full cost breakdown */
export interface GPUBudgetReport {
  resolution: PPResolution;
  totalCostMs: number;
  effects: GPUCostEstimate[];
  budgetMs: number;
  overBudget: boolean;
}

export type PPResolution = '720p' | '1080p' | '1440p' | '4K';

/** A/B comparison slot */
export type ABSlot = 'A' | 'B';

/** Snapshot of effect stack for comparison */
export interface PPStackSnapshot {
  effects: PPStudioEffect[];
  presetId: string | null;
  label: string;
  totalGpuMs: number;
}

/** Studio state summary for API */
export interface PPStudioSummary {
  activePreset: string | null;
  enabledEffectCount: number;
  totalGpuCostMs: number;
  resolution: PPResolution;
}

// ── API Types ───────────────────────────────────────────────────────────────

export interface GetPresetsResponse {
  presets: PPPreset[];
}

export interface EstimateCostRequest {
  effects: { id: string; enabled: boolean; params: Record<string, number> }[];
  resolution: PPResolution;
}

export interface EstimateCostResponse {
  budget: GPUBudgetReport;
}

export interface GenerateCodeRequest {
  effects: PPStudioEffect[];
  presetName: string | null;
}

export interface GenerateCodeResponse {
  prompt: string;
}
