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

/**
 * How old the evidence behind a score is — a separate axis from how much of it
 * there is, and from when the audit ran. `unknown` is not "fresh by default":
 * evidence with no review timestamps has an age nobody knows.
 */
export type EvidenceFreshness = 'unknown' | 'fresh' | 'aging' | 'stale';

/**
 * Evidence older than this many days no longer counts as current. Stated, not
 * implicit, so the UI can name the threshold it is judging against.
 */
export const EVIDENCE_STALE_AFTER_DAYS = 30;

export interface EvidenceAge {
  state: EvidenceFreshness;
  /** Days since the most recent review, or null when nothing is dated. */
  newestDays: number | null;
  /** Days since the oldest contributing review, or null when nothing is dated. */
  oldestDays: number | null;
  /** Measured rows carrying no review timestamp at all. */
  undated: number;
}

const MS_PER_DAY = 86_400_000;

function daysBetween(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.max(0, (nowMs - then) / MS_PER_DAY);
}

/**
 * Pure evidence-age derivation, shared by the audit engine and the client view.
 * It lives in the types module (alongside `FEATURE_STATUSES`' precedent in
 * `types/feature-matrix.ts`) because `lib/gdd-compliance.ts` pulls in
 * better-sqlite3 and cannot be imported from a `'use client'` surface.
 *
 * `now` is passed in — never read from the clock — so this is safe to call
 * during render (react-hooks/purity) and so the UI measures evidence age against
 * the audit that produced it, which is precisely the comparison the freshness
 * display exists to make.
 */
export function evidenceAge(evidence: ComplianceEvidence, now: string | number): EvidenceAge {
  const nowMs = typeof now === 'number' ? now : Date.parse(now);
  const undated = evidence.undatedEvidence;
  const newestDays = daysBetween(evidence.newestEvidenceAt, nowMs);
  const oldestDays = daysBetween(evidence.oldestEvidenceAt, nowMs);

  // Nothing measured, or nothing dated: the age is unknown. Never "fresh".
  if (!evidence.measured || newestDays === null || Number.isNaN(nowMs)) {
    return { state: 'unknown', newestDays: null, oldestDays: null, undated };
  }
  // Even the most recent review is past the threshold — none of it is current.
  if (newestDays > EVIDENCE_STALE_AFTER_DAYS) {
    return { state: 'stale', newestDays, oldestDays, undated };
  }
  // Some of it is past the threshold, or some of it has no date to judge.
  if ((oldestDays !== null && oldestDays > EVIDENCE_STALE_AFTER_DAYS) || undated > 0) {
    return { state: 'aging', newestDays, oldestDays, undated };
  }
  return { state: 'fresh', newestDays, oldestDays, undated };
}

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
  /**
   * Oldest / newest `lastReviewedAt` across the MEASURED rows the score was
   * computed from. The audit timestamp says when the arithmetic ran; these say
   * how old the facts it ran over are. Null when no contributing row is dated.
   */
  oldestEvidenceAt: string | null;
  newestEvidenceAt: string | null;
  /** Measured rows carrying no review timestamp — age unknown, never assumed fresh. */
  undatedEvidence: number;
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

/** A durable triage decision: this gap was dealt with, when, and optionally why. */
export interface GapResolution {
  gapId: string;
  moduleId: string;
  resolvedAt: string;
  /** Free-text reason. Empty string when the user gave none — never null. */
  note: string;
}

export interface ComplianceRequest {
  action: 'audit' | 'resolve-gap' | 'unresolve-gap' | 'resolutions';
  moduleId?: string;
  gapId?: string;
  /** Scopes resolutions; gap ids are only unique within one project. */
  projectPath?: string;
  note?: string;
}
