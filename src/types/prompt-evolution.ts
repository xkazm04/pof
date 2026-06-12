import type { SubModuleId } from './modules';

// ── Prompt variant — one phrasing of a task prompt ──

export type VariantStyle = 'imperative' | 'descriptive' | 'step-by-step' | 'holistic' | 'example-rich' | 'minimal';

export interface PromptVariant {
  id: string;
  /** Module (checklist) this variant belongs to */
  moduleId: SubModuleId;
  /** Checklist item id (e.g. "ac-1") */
  checklistItemId: string;
  /** Human-readable label */
  label: string;
  /** The full prompt text */
  prompt: string;
  /** How this variant was created */
  origin: 'default' | 'mutation' | 'user-edit' | 'merged';
  /** Phrasing style classification */
  style: VariantStyle;
  /** Parent variant id (null for originals) */
  parentId: string | null;
  /** Which mutation was applied */
  mutationType?: MutationType;
  /** Whether this is the currently-active/restored version for its checklist item */
  active: boolean;
  createdAt: string;
}

// ── Version history — lineage timeline + per-version A/B stats ──

/** Aggregated A/B performance for a single variant across every test it joined. */
export interface VariantStats {
  variantId: string;
  /** Total trials across all tests where this variant was slot A or B */
  trials: number;
  /** Total successes across those trials */
  successes: number;
  /** successes / trials (0 when untested) */
  successRate: number;
  /** Number of concluded tests this variant won */
  wins: number;
  /** Number of tests this variant participated in */
  testCount: number;
}

/** A single version (variant) in a checklist item's history, with its stats. */
export interface VariantVersionEntry {
  variant: PromptVariant;
  stats: VariantStats;
  /** Whether this is the currently-active/restored version */
  isActive: boolean;
}

/** A node in the lineage tree — a version plus its mutation descendants. */
export interface VariantLineageNode extends VariantVersionEntry {
  children: VariantLineageNode[];
  /** Distance from a root (root = 0) — drives indentation */
  depth: number;
}

/** Full version history for one checklist item: flat list + lineage forest. */
export interface VariantVersionHistory {
  moduleId: SubModuleId;
  checklistItemId: string;
  /** All versions, flat, each annotated with stats + active flag */
  versions: VariantVersionEntry[];
  /** Lineage roots (originals + any variant whose parent is outside this item) */
  roots: VariantLineageNode[];
  /** Id of the currently-active version, if any */
  activeVariantId: string | null;
}

// ── Mutation types — ways to transform a prompt ──

export type MutationType =
  | 'imperative-rewrite'    // "Create X" → "You must create X"
  | 'add-examples'          // Inject inline code examples
  | 'step-by-step'          // Break into numbered steps
  | 'holistic'              // Merge steps into a single paragraph
  | 'add-context-hint'      // Add "Use project context" prefix
  | 'shorten'               // Remove redundant detail
  | 'add-verification'      // Append "Verify the build compiles"
  | 'swap-ordering';        // Reorder file creation sequence

// ── A/B test — tracks which variant performs better ──

export type ABTestStatus = 'running' | 'concluded' | 'cancelled';

export interface ABTest {
  id: string;
  moduleId: SubModuleId;
  checklistItemId: string;
  variantAId: string;
  variantBId: string;
  /** How many times each variant has been used */
  variantATrials: number;
  variantBTrials: number;
  /** How many times each succeeded */
  variantASuccesses: number;
  variantBSuccesses: number;
  /** Total duration across trials */
  variantATotalDurationMs: number;
  variantBTotalDurationMs: number;
  /** Minimum trials before we can conclude */
  minTrials: number;
  status: ABTestStatus;
  winnerId: string | null;
  /** Statistical confidence (0-1) when concluded */
  confidence: number;
  createdAt: string;
  concludedAt: string | null;
}

// ── Template family — group of similar prompts ──

export interface TemplateFamily {
  id: string;
  moduleId: SubModuleId;
  /** Representative label */
  label: string;
  /** Centroid prompt (most representative) */
  centroidVariantId: string;
  /** All variant ids in this cluster */
  variantIds: string[];
  /** Average success rate across all variants */
  avgSuccessRate: number;
  /** Average duration */
  avgDurationMs: number;
  /** Dominant style in this family */
  dominantStyle: VariantStyle;
}

// ── Prompt cluster result (from similarity analysis) ──

export interface PromptCluster {
  /** Cluster label (auto-generated) */
  label: string;
  /** Session ids in this cluster */
  sessionIds: number[];
  /** Success rate within cluster */
  successRate: number;
  /** Average prompt length */
  avgLength: number;
  /** Common keywords */
  keywords: string[];
  /** Representative prompt snippet */
  representative: string;
}

// ── Evolution stats — dashboard-level metrics ──

export interface EvolutionStats {
  totalVariants: number;
  activeABTests: number;
  concludedABTests: number;
  templateFamilies: number;
  avgImprovementRate: number;
  topPerformingModule: string | null;
  /** Per-module breakdown */
  moduleBreakdown: ModuleEvolutionStats[];
}

export interface ModuleEvolutionStats {
  moduleId: SubModuleId;
  variants: number;
  activeTests: number;
  bestSuccessRate: number;
  defaultSuccessRate: number;
  improvement: number; // bestSuccessRate - defaultSuccessRate
}

// ── Suggestion for the user ──

export interface EvolutionSuggestion {
  type: 'try-variant' | 'start-ab-test' | 'adopt-winner' | 'cluster-insight';
  moduleId: SubModuleId;
  checklistItemId?: string;
  message: string;
  variantId?: string;
  confidence: number;
}

// ── Prompt optimization result (before/after diff) ──

export interface PromptOptimizationDiff {
  type: 'add-context' | 'restructure' | 'add-verification' | 'shorten' | 'lengthen' | 'imperative-rewrite';
  description: string;
  /** Short reason based on analytics data */
  reason: string;
}

export interface PromptOptimizationResult {
  /** Original prompt text */
  original: string;
  /** Optimized prompt text */
  optimized: string;
  /** What was changed and why */
  diffs: PromptOptimizationDiff[];
  /** Predicted success rate improvement (0–1) */
  predictedImprovement: number;
  /** Number of historical sessions this is based on */
  sampleSize: number;
  /** Was the prompt actually modified? */
  wasModified: boolean;
}

// ── API types ──

export interface PromptEvolutionRequest {
  action:
    | 'get-variants'
    | 'create-variant'
    | 'mutate-variant'
    | 'start-ab-test'
    | 'record-trial'
    | 'conclude-test'
    | 'cluster-prompts'
    | 'get-stats'
    | 'get-tests'
    | 'get-suggestions'
    | 'get-best-variant'
    | 'get-version-history'
    | 'restore-variant'
    | 'optimize-prompt';
  moduleId?: string;
  checklistItemId?: string;
  variantId?: string;
  testId?: string;
  prompt?: string;
  style?: VariantStyle;
  mutationType?: MutationType;
  success?: boolean;
  durationMs?: number;
}

export interface PromptEvolutionResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
}
