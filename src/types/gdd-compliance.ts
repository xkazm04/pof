import type { SubModuleId } from './modules';

export type GapSeverity = 'critical' | 'major' | 'minor' | 'info';
/**
 * Which side of the design/code split is ahead. `unmeasured` is the third,
 * honest state: neither side is ahead because nothing was ever evaluated —
 * an evidence gap, not a conformance gap. It is deliberately NOT foldable into
 * `design-ahead` (that would claim the code is behind, which we do not know).
 */
export type GapDirection = 'design-ahead' | 'code-ahead' | 'unmeasured';
export type EffortEstimate = 'trivial' | 'small' | 'medium' | 'large';

/**
 * How much of the scored surface is actually backed by evidence. `none` means
 * the score is not evidence-backed at all and must never be rendered as a
 * number — the UI reads UNMEASURED (Rule 4b: an unmeasured thing reads
 * unmeasured; nothing downstream may silently upgrade it into "evaluated").
 */
export type ComplianceConfidence = 'none' | 'low' | 'moderate' | 'high';

export interface ComplianceGap {
  id: string;
  moduleId: SubModuleId;
  moduleName: string;
  category: string;
  title: string;
  description: string;
  direction: GapDirection;
  severity: GapSeverity;
  effort: EffortEstimate;
  designState: string;
  codeState: string;
  suggestion: string;
  resolved: boolean;
}

/**
 * The evidence behind a compliance score — the half the old bare 0-100 threw
 * away. A score is only ever meaningful alongside this: `conformance` says how
 * much of what was LOOKED AT matches design, `coverage` says how much was
 * looked at. A module with `measured: false` has no conformance signal at all.
 */
export interface ComplianceEvidence {
  /** Feature rows declared for this scope (the denominator of coverage). */
  featuresTotal: number;
  /** Rows carrying a measured verdict — status is not `unknown`. */
  featuresMeasured: number;
  /** Rows declared but never evaluated (status `unknown`). */
  featuresUnmeasured: number;
  /** `featuresMeasured / featuresTotal`, 0-1. 0 when nothing is declared. */
  coverage: number;
  /** Banded from coverage; `none` ⇒ the score is not evidence-backed. */
  confidence: ComplianceConfidence;
  /** True iff at least one measured row backs the score. */
  measured: boolean;
}

export interface ModuleCompliance {
  moduleId: SubModuleId;
  moduleName: string;
  /**
   * 0-100. Conformance of the MEASURED rows, damped by unresolved conformance
   * gaps. Meaningless on its own — always read with `evidence`. It is 0 (and
   * must not be rendered) when `evidence.measured` is false.
   */
  score: number;
  /** 0-100 conformance of the measured rows, before the gap damping. */
  conformance: number;
  evidence: ComplianceEvidence;
  totalFeatures: number;
  implemented: number;
  /** Rows reviewed as improved beyond the baseline — scored, and now shown. */
  improved: number;
  partial: number;
  missing: number;
  /** Rows never evaluated. Drives the `unmeasured` gaps and the coverage gap. */
  unknown: number;
  checklistTotal: number;
  checklistDone: number;
  gaps: ComplianceGap[];
}

export interface ComplianceReport {
  generatedAt: string;
  /**
   * 0-100 conformance across the MEASURED surface only, weighted by measured
   * rows per module. Read with `evidence` — a high score over 5% coverage is
   * not a healthy project.
   */
  overallScore: number;
  /** Project-wide roll-up of the per-module evidence. */
  evidence: ComplianceEvidence;
  /** Modules the audit considered (has a checklist and/or feature rows). */
  modulesTotal: number;
  /** Of those, how many carry at least one measured row. */
  modulesMeasured: number;
  modules: ModuleCompliance[];
  totalGaps: number;
  criticalGaps: number;
  suggestions: ReconciliationSuggestion[];
}

export interface ReconciliationSuggestion {
  id: string;
  moduleId: SubModuleId;
  type: 'update-gdd' | 'implement-feature';
  title: string;
  description: string;
  effort: EffortEstimate;
  priority: number;           // 1 = highest
}

export interface ComplianceRequest {
  action: 'audit' | 'resolve-gap';
  moduleId?: string;
  gapId?: string;
}
