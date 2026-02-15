// ── Post-Process Recipe Studio Types ────────────────────────────────────────

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
