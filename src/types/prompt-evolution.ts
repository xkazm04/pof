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
  /**
   * How this variant was created. `seeded` is the auto-captured baseline (v1):
   * the first dispatch of a checklist item with no variants records the EXACT
   * prompt it served, so the A/B rail always has a measured incumbent to
   * challenge instead of an empty table.
   */
  origin: 'default' | 'mutation' | 'user-edit' | 'merged' | 'seeded';
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

/**
 * What the dispatch path was served for a checklist item: the variant whose text
 * runs, plus the running A/B test arm it counts as a trial for (both `null` when
 * the variant came from the adopted version rather than a live test).
 */
export interface ServedVariant {
  variant: PromptVariant;
  testId: string | null;
  slot: 'A' | 'B' | null;
}

/**
 * The baseline (v1) variant for a checklist item after {@link PromptVariant}
 * auto-seeding: `seeded` is true only when this call captured it, false when the
 * item already had versions (the call is idempotent, so a repeated dispatch
 * never forks a second baseline).
 */
export interface SeededBaseline {
  variant: PromptVariant;
  seeded: boolean;
}

// ── Judge-scored fitness per quality-pack prompt version ──

/**
 * How well the artifacts produced under one quality-pack version scored with the judge
 * fleet. `avgScore`/`passRate` are **null when nothing under this version has been judged** —
 * unjudged is unknown, never zero (see `lib/prompt-evolution/judge-fitness.ts`).
 */
export interface PromptVersionFitness {
  /** The `PROMPT_VERSION` stamped into the artifacts' `_provenance`. */
  promptVersion: string;
  /** Artifacts stamped with this version. */
  producedArtifacts: number;
  /** How many of those artifacts carry at least one judge verdict. */
  judgedArtifacts: number;
  /** Total verdicts counted (an artifact may be judged by several judges). */
  verdicts: number;
  /** Mean 0-100 judge score, or null when unjudged. */
  avgScore: number | null;
  /** Share of verdicts that passed (0-1), or null when unjudged. */
  passRate: number | null;
  /** Whether this is the pack version production runs under right now. */
  isCurrent: boolean;
}

/**
 * How well the artifacts produced under one SERVED VARIANT scored with the judge fleet.
 * Same honesty rule as {@link PromptVersionFitness}: unjudged is `null`, never `0`. This is
 * the objective half of a variant's record — its trial counter is what runs said about
 * themselves; this is what an independent judge scored the output at.
 */
export interface PromptVariantFitness {
  /** The variant id stamped into the artifacts' `_provenance.promptVariantId`. */
  variantId: string;
  producedArtifacts: number;
  judgedArtifacts: number;
  verdicts: number;
  avgScore: number | null;
  passRate: number | null;
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
    | 'seed-baseline-variant'
    | 'mutate-variant'
    | 'start-ab-test'
    | 'record-trial'
    | 'conclude-test'
    | 'cluster-prompts'
    | 'get-stats'
    | 'get-tests'
    | 'get-suggestions'
    | 'get-best-variant'
    | 'get-active-variant'
    | 'resolve-dispatch-variant'
    | 'record-variant-trial'
    | 'get-prompt-fitness'
    | 'get-variant-fitness'
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
