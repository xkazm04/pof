/**
 * GDD Compliance Engine — Cross-references design intent (GDD/checklists)
 * against implementation reality (feature matrix/reviews) to detect gaps.
 */

import type { SubModuleId } from '@/types/modules';
import { SUB_MODULES } from './module-registry';
import { countChecklist } from './checklist-progress';
import { getDb } from './db';
import { getFeaturesByModule } from './feature-matrix-db';
import type { FeatureRow, FeatureStatus, FeatureSummary } from '@/types/feature-matrix';
import type {
  ComplianceConfidence, ComplianceEvidence, ComplianceGap, ComplianceReport,
  GapResolution, GapSeverity, ModuleCompliance, ReconciliationSuggestion, EffortEstimate,
} from '@/types/gdd-compliance';

// ─── Gap Detection ──────────────────────────────────────────────────────────

function detectFeatureGaps(
  moduleId: SubModuleId,
  moduleName: string,
  features: FeatureRow[],
  checklistItems: { id: string; label: string }[],
  checklistProgress: Record<string, boolean>,
): ComplianceGap[] {
  const gaps: ComplianceGap[] = [];

  // 1. Missing features — checklist says it should exist, feature_matrix says missing/unknown
  for (const item of checklistItems) {
    const matchingFeature = features.find(
      (f) => f.featureName.toLowerCase().includes(item.label.toLowerCase().slice(0, 20)) ||
             item.label.toLowerCase().includes(f.featureName.toLowerCase().slice(0, 20))
    );

    const isChecked = checklistProgress[item.id] ?? false;

    if (isChecked && matchingFeature && matchingFeature.status === 'missing') {
      gaps.push({
        id: `gap-${moduleId}-checklist-${item.id}`,
        moduleId,
        moduleName,
        category: 'checklist-vs-scan',
        title: `"${item.label}" marked done but scan shows missing`,
        description: `Checklist item is checked off but the feature scanner found no implementation.`,
        direction: 'design-ahead',
        severity: 'major',
        effort: estimateEffort(item.label),
        designState: 'Checklist: done',
        codeState: 'Scan: missing',
        suggestion: 'Re-run feature scan or verify the implementation exists.',
        resolved: false,
      });
    }

    if (!isChecked && matchingFeature && matchingFeature.status === 'implemented') {
      gaps.push({
        id: `gap-${moduleId}-ahead-${item.id}`,
        moduleId,
        moduleName,
        category: 'code-ahead',
        title: `"${item.label}" implemented but not checked off`,
        description: `Feature scan shows implementation, but checklist item is unchecked.`,
        direction: 'code-ahead',
        severity: 'info',
        effort: 'trivial',
        designState: 'Checklist: pending',
        codeState: 'Scan: implemented',
        suggestion: 'Mark checklist item as complete.',
        resolved: false,
      });
    }
  }

  // 2. Low quality features — implemented but quality < 3
  for (const f of features) {
    if (f.status === 'implemented' && f.qualityScore !== null && f.qualityScore < 3) {
      gaps.push({
        id: `gap-${moduleId}-quality-${f.id}`,
        moduleId,
        moduleName,
        category: 'quality',
        title: `"${f.featureName}" has low quality (${f.qualityScore}/5)`,
        description: f.nextSteps || 'Quality score below acceptable threshold.',
        direction: 'design-ahead',
        severity: f.qualityScore <= 1 ? 'critical' : 'major',
        effort: 'medium',
        designState: 'Expected: quality ≥ 3',
        codeState: `Actual: ${f.qualityScore}/5`,
        suggestion: f.nextSteps || 'Review and improve implementation quality.',
        resolved: false,
      });
    }
  }

  // 3. Missing features from scan — features that exist in scan but status is 'missing'
  for (const f of features) {
    if (f.status === 'missing') {
      gaps.push({
        id: `gap-${moduleId}-missing-${f.id}`,
        moduleId,
        moduleName,
        category: 'missing-feature',
        title: `"${f.featureName}" not implemented`,
        description: f.description || 'Feature identified in design but not found in codebase.',
        direction: 'design-ahead',
        severity: 'major',
        effort: estimateEffort(f.featureName),
        designState: 'Designed',
        codeState: 'Not implemented',
        suggestion: f.nextSteps || `Implement ${f.featureName} for this module.`,
        resolved: false,
      });
    }
  }

  // 4. Partial implementations — design specifies a whole feature, the scan found
  //    part of one. Previously silent (a `partial` row produced no gap at all and
  //    took half credit for free); it is a real design-ahead finding and is now said
  //    out loud. It is excluded from the gap load (see GAP_LOAD_EXCLUDED) because the
  //    half-credit already prices it — the gap exists to be visible, not to punish twice.
  for (const f of features) {
    if (f.status === 'partial') {
      gaps.push({
        id: `gap-${moduleId}-partial-${f.id}`,
        moduleId,
        moduleName,
        category: 'partial-implementation',
        title: `"${f.featureName}" only partially implemented`,
        description: f.reviewNotes || f.description || 'Scan found a partial implementation of a fully-specified feature.',
        direction: 'design-ahead',
        severity: 'minor',
        effort: estimateEffort(f.featureName),
        designState: 'Designed: complete',
        codeState: 'Scan: partial',
        suggestion: f.nextSteps || `Finish ${f.featureName}, or narrow the design to what ships.`,
        resolved: false,
      });
    }
  }

  // 5. Coverage — features declared but never evaluated. `unknown` used to take FULL
  //    credit in the score (it simply was not counted against anything); it is now an
  //    explicit evidence gap so an un-scanned module can never read as a conforming one.
  //    One aggregate gap per module rather than one per row: the finding is "nobody
  //    looked", which is a single fact about the module, and per-row copies would bury
  //    the real conformance findings under hundreds of identical lines.
  const unmeasured = features.filter((f) => !isMeasured(f.status)).length;
  if (features.length === 0) {
    gaps.push({
      id: `gap-${moduleId}-noevidence`,
      moduleId,
      moduleName,
      category: 'unmeasured',
      title: `No feature scan for ${moduleName}`,
      description: 'This module has a design checklist but no scanned features, so there is nothing to compare the design against.',
      direction: 'unmeasured',
      severity: 'minor',
      effort: 'trivial',
      designState: `Checklist: ${checklistItems.length} item(s)`,
      codeState: 'Scan: never run',
      suggestion: 'Run a module feature scan to produce evidence.',
      resolved: false,
    });
  } else if (unmeasured > 0) {
    gaps.push({
      id: `gap-${moduleId}-unmeasured`,
      moduleId,
      moduleName,
      category: 'unmeasured',
      title: `${unmeasured} of ${features.length} features never evaluated`,
      description: `${unmeasured} feature row(s) are still 'unknown' — declared in the design but never given a verdict by a scan or review.`,
      direction: 'unmeasured',
      severity: 'minor',
      effort: 'trivial',
      designState: 'Designed',
      codeState: 'Scan: no verdict',
      suggestion: 'Re-run the feature scan (or review these rows) so the score has evidence behind it.',
      resolved: false,
    });
  }

  return gaps;
}

function estimateEffort(label: string): EffortEstimate {
  const lower = label.toLowerCase();
  if (lower.includes('config') || lower.includes('set up') || lower.includes('tune'))
    return 'small';
  if (lower.includes('system') || lower.includes('framework') || lower.includes('pipeline'))
    return 'large';
  if (lower.includes('create') || lower.includes('build') || lower.includes('implement'))
    return 'medium';
  return 'small';
}

/** Derive the per-status summary from already-fetched feature rows, avoiding a
 *  second `feature_matrix` query per module — the full rows already carry every status. */
function summarizeFeatures(features: FeatureRow[]): FeatureSummary {
  const summary: FeatureSummary = { total: 0, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0 };
  for (const f of features) {
    summary.total += 1;
    summary[f.status] += 1;
  }
  return summary;
}

// ─── Evidence & Scoring ─────────────────────────────────────────────────────
//
// The old single number conflated two unrelated things and then invented values for
// the parts it did not know: a module with no scan took a flat 60/100 "neutral", a
// module with no checklist took a flat +30, and zero gaps added +10 — so a module
// nobody had ever evaluated rendered 70/100, indistinguishable from a measured 70.
// (Measured on the real DB 2026-08-18: twelve modules scored exactly 70 with zero
// evidence, while fifteen modules whose rows were all `unknown` scored 10 — the same
// epistemic state, a 60-point spread, in opposite directions.)
//
// The number is now split at the type level:
//   coverage    — how much of the declared surface actually has a verdict
//   conformance — of what has a verdict, how much matches the design
// and `score` reports conformance only, always alongside `evidence`. There is no
// neutral constant anywhere: an unmeasured module is `measured: false`, not a number.

/** Statuses that count as evidence. `unknown` is the absence of a verdict, never one. */
const MEASURED_STATUSES: ReadonlySet<FeatureStatus> = new Set<FeatureStatus>([
  'implemented', 'improved', 'partial', 'missing',
]);

function isMeasured(status: FeatureStatus): boolean {
  return MEASURED_STATUSES.has(status);
}

/**
 * Coverage → confidence band. Named so the UI can say WHY a score is soft rather
 * than tinting it. `none` is reserved for "no measured row at all" — it is not a
 * low score, it is the absence of one.
 */
export const CONFIDENCE_BANDS: ReadonlyArray<{ min: number; band: ComplianceConfidence }> = [
  { min: 0.75, band: 'high' },
  { min: 0.34, band: 'moderate' },
  { min: 0, band: 'low' },
];

function confidenceFor(featuresMeasured: number, coverage: number): ComplianceConfidence {
  if (featuresMeasured === 0) return 'none';
  return CONFIDENCE_BANDS.find((b) => coverage >= b.min)?.band ?? 'low';
}

/** Earlier / later of two nullable ISO timestamps; null only when both are null. */
function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}
function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function buildEvidence(
  featuresTotal: number,
  featuresMeasured: number,
  age: Pick<ComplianceEvidence, 'oldestEvidenceAt' | 'newestEvidenceAt' | 'undatedEvidence'>,
): ComplianceEvidence {
  const coverage = featuresTotal > 0 ? featuresMeasured / featuresTotal : 0;
  return {
    featuresTotal,
    featuresMeasured,
    featuresUnmeasured: featuresTotal - featuresMeasured,
    coverage,
    confidence: confidenceFor(featuresMeasured, coverage),
    measured: featuresMeasured > 0,
    ...age,
  };
}

/**
 * Evidence for one module, including the review timestamps of the rows the score
 * was actually computed from. Those timestamps used to be read off the rows and
 * dropped on the floor, leaving "Last audit: just now" — the time the arithmetic
 * ran — as the only freshness signal on screen, over evidence of any age.
 *
 * Only MEASURED rows contribute: the age of a row nobody gave a verdict to says
 * nothing about the age of the score.
 */
function evidenceFromRows(features: FeatureRow[]): ComplianceEvidence {
  const measured = features.filter((f) => isMeasured(f.status));
  let oldest: string | null = null;
  let newest: string | null = null;
  let undated = 0;
  for (const f of measured) {
    if (!f.lastReviewedAt) {
      undated += 1;
      continue;
    }
    oldest = earlier(oldest, f.lastReviewedAt);
    newest = later(newest, f.lastReviewedAt);
  }
  return buildEvidence(features.length, measured.length, {
    oldestEvidenceAt: oldest,
    newestEvidenceAt: newest,
    undatedEvidence: undated,
  });
}

/** Roll per-module evidence up to the project scope, preserving the age envelope. */
function mergeEvidence(parts: ComplianceEvidence[]): ComplianceEvidence {
  let total = 0;
  let measured = 0;
  let undated = 0;
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const p of parts) {
    total += p.featuresTotal;
    measured += p.featuresMeasured;
    undated += p.undatedEvidence;
    oldest = earlier(oldest, p.oldestEvidenceAt);
    newest = later(newest, p.newestEvidenceAt);
  }
  return buildEvidence(total, measured, {
    oldestEvidenceAt: oldest,
    newestEvidenceAt: newest,
    undatedEvidence: undated,
  });
}

/**
 * Severity weights for the gap load. `info` is deliberately near-zero: a code-ahead
 * "implemented but not checked off" is bookkeeping, not non-conformance.
 */
export const GAP_SEVERITY_WEIGHT: Record<GapSeverity, number> = {
  critical: 4,
  major: 2,
  minor: 1,
  info: 0.25,
};

/**
 * Gap categories already priced by the status arithmetic, excluded from the gap
 * load so nothing is punished twice: `missing` already scores 0 credit,
 * `partial` already scores half, and `unmeasured` is what `coverage` reports.
 */
const GAP_LOAD_EXCLUDED: ReadonlySet<string> = new Set([
  'missing-feature', 'partial-implementation', 'unmeasured',
]);

/**
 * Severity-weighted gap DENSITY damping, replacing `Math.min(gapCount * 2, 10)`.
 * The old penalty saturated at 10 points, so five gaps and five hundred were the
 * same number, and it ignored severity and module size entirely. The new curve is
 *
 *     factor = 1 / (1 + load / measuredRows)
 *
 * — strictly decreasing, never saturating (each additional gap always costs
 * something), scale-free (six gaps over eight features is worse than six over
 * eighty), and asymptotic to 0 rather than reaching it, because a score of exactly
 * zero would claim certainty of total failure that gap counting cannot support.
 */
function gapDamping(gaps: ComplianceGap[], measuredRows: number): number {
  if (measuredRows === 0) return 1;
  const load = gaps
    .filter((g) => !g.resolved && !GAP_LOAD_EXCLUDED.has(g.category))
    .reduce((sum, g) => sum + GAP_SEVERITY_WEIGHT[g.severity], 0);
  return 1 / (1 + load / measuredRows);
}

/**
 * Conformance of the MEASURED rows only, 0-100. `improved` counts as implemented,
 * `partial` as half, `missing` as zero — and `unknown` rows are simply not in the
 * denominator, because a row nobody looked at is a coverage fact, not a quality one.
 */
function calculateConformance(summary: FeatureSummary, featuresMeasured: number): number {
  if (featuresMeasured === 0) return 0;
  const credit = summary.implemented + summary.improved + summary.partial * 0.5;
  return Math.max(0, Math.min(100, (credit / featuresMeasured) * 100));
}

// ─── Reconciliation Suggestions ─────────────────────────────────────────────

function generateSuggestions(
  modules: ModuleCompliance[],
): ReconciliationSuggestion[] {
  const suggestions: ReconciliationSuggestion[] = [];
  let priority = 1;

  for (const mod of modules) {
    // Suggest updating GDD for code-ahead gaps
    const codeAheadGaps = mod.gaps.filter((g) => g.direction === 'code-ahead' && !g.resolved);
    if (codeAheadGaps.length > 0) {
      suggestions.push({
        id: `sug-update-gdd-${mod.moduleId}`,
        moduleId: mod.moduleId,
        type: 'update-gdd',
        title: `Update ${mod.moduleName} checklist`,
        description: `${codeAheadGaps.length} feature(s) implemented but not tracked. Mark checklist items as done.`,
        effort: 'trivial',
        priority: priority++,
      });
    }

    // Suggest implementing critical missing features
    const criticalGaps = mod.gaps.filter(
      (g) => g.severity === 'critical' && g.direction === 'design-ahead' && !g.resolved
    );
    if (criticalGaps.length > 0) {
      suggestions.push({
        id: `sug-fix-critical-${mod.moduleId}`,
        moduleId: mod.moduleId,
        type: 'implement-feature',
        title: `Fix critical gaps in ${mod.moduleName}`,
        description: `${criticalGaps.length} critical gap(s): ${criticalGaps.map((g) => g.title).join('; ')}`,
        effort: 'large',
        priority: priority++,
      });
    }

    // Suggest batch implementation for modules with many missing features
    if (mod.missing > 3) {
      suggestions.push({
        id: `sug-batch-${mod.moduleId}`,
        moduleId: mod.moduleId,
        type: 'implement-feature',
        title: `${mod.moduleName}: ${mod.missing} features need implementation`,
        description: `This module has ${mod.missing} missing features out of ${mod.totalFeatures} total.`,
        effort: mod.missing > 6 ? 'large' : 'medium',
        priority: priority++,
      });
    }
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
}

// ─── Main Audit ─────────────────────────────────────────────────────────────

export function runComplianceAudit(
  checklistProgress: Record<string, Record<string, boolean>>,
  projectPath = '',
): ComplianceReport {
  const modules: ModuleCompliance[] = [];
  // Durable triage: resolutions live in SQLite, so a re-audit re-applies them
  // instead of resurrecting every gap the user already dealt with.
  const resolved = resolvedGapIds(projectPath);

  for (const mod of SUB_MODULES) {
    const checklist = mod.checklist ?? [];

    // Single read per module; the summary is derived from these rows below
    // instead of issuing a second `feature_matrix` query.
    const features = getFeaturesByModule(mod.id);

    // Skip modules with neither a checklist nor any scanned features.
    if (checklist.length === 0 && features.length === 0) continue;

    const summary = summarizeFeatures(features);

    const moduleProgress = checklistProgress[mod.id] ?? {};
    const { done: checklistDone, total: checklistTotal } = countChecklist(mod, moduleProgress);

    const gaps = detectFeatureGaps(
      mod.id,
      mod.label,
      features,
      checklist.map((c) => ({ id: c.id, label: c.label })),
      moduleProgress,
    ).map((g) => (resolved.has(g.id) ? { ...g, resolved: true } : g));

    const evidence = evidenceFromRows(features);
    const featuresMeasured = evidence.featuresMeasured;
    const conformance = calculateConformance(summary, featuresMeasured);
    // No evidence ⇒ no score. Not a low score, not a neutral one — the UI reads
    // `evidence.measured` and renders UNMEASURED instead of this 0.
    const score = evidence.measured
      ? Math.round(Math.max(0, Math.min(100, conformance * gapDamping(gaps, featuresMeasured))))
      : 0;

    modules.push({
      moduleId: mod.id,
      moduleName: mod.label,
      score,
      conformance: Math.round(conformance),
      evidence,
      totalFeatures: summary.total,
      implemented: summary.implemented,
      improved: summary.improved,
      partial: summary.partial,
      missing: summary.missing,
      unknown: summary.unknown,
      checklistTotal,
      checklistDone,
      gaps,
    });
  }

  // Overall = conformance across the MEASURED surface, weighted by measured rows.
  // Unmeasured modules carry weight 0 rather than dragging the mean toward an
  // invented value in either direction; how much of the project that leaves out is
  // reported by `evidence`, never hidden inside the number.
  const measuredWeight = modules.reduce((s, m) => s + m.evidence.featuresMeasured, 0);
  const overallScore = measuredWeight > 0
    ? Math.round(
        modules.reduce((s, m) => s + m.score * m.evidence.featuresMeasured, 0) / measuredWeight,
      )
    : 0;

  const evidence = mergeEvidence(modules.map((m) => m.evidence));

  const allGaps = modules.flatMap((m) => m.gaps);
  const suggestions = generateSuggestions(modules);

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    evidence,
    modulesTotal: modules.length,
    modulesMeasured: modules.filter((m) => m.evidence.measured).length,
    // Measured modules first, worst conformance first (the triage order); the
    // unmeasured ones follow, so a wall of "no evidence" cards can never bury a
    // real failure. Their count is stated in the header either way.
    modules: modules.sort((a, b) => {
      if (a.evidence.measured !== b.evidence.measured) return a.evidence.measured ? -1 : 1;
      return a.score - b.score;
    }),
    // OPEN gap counts. A gap the user has resolved is still listed on its module
    // (and is un-resolvable), but the headline counters report what is outstanding —
    // matching the client-side transform, and keeping `criticalGaps <= totalGaps`.
    totalGaps: allGaps.filter((g) => !g.resolved).length,
    criticalGaps: allGaps.filter((g) => g.severity === 'critical' && !g.resolved).length,
    suggestions,
  };
}

// ─── Gap resolution persistence ─────────────────────────────────────────────
//
// Triage used to die with the browser tab: the store held resolutions in memory,
// nothing wrote them anywhere, and this module exported a `resolveGap` that
// rewrote a report object nobody imported while the API declared a `resolve-gap`
// action that 400'd. All three phantoms are replaced by one real path — the API
// action calls these, they write SQLite, and `runComplianceAudit` re-applies them.

/** Ids of the gaps resolved for a project, as a set for the audit merge. */
function resolvedGapIds(projectPath: string): Set<string> {
  const rows = getDb()
    .prepare('SELECT gap_id FROM gdd_gap_resolutions WHERE project_path = ?')
    .all(projectPath) as { gap_id: string }[];
  return new Set(rows.map((r) => r.gap_id));
}

/**
 * Mark a gap resolved for a project. Idempotent — re-resolving refreshes the
 * timestamp and note rather than erroring, so a double click is harmless.
 */
export function resolveGap(
  projectPath: string,
  gapId: string,
  opts: { moduleId?: string; note?: string } = {},
): GapResolution {
  const resolvedAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO gdd_gap_resolutions (project_path, gap_id, module_id, resolved_at, note)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_path, gap_id) DO UPDATE SET
         module_id = excluded.module_id,
         resolved_at = excluded.resolved_at,
         note = excluded.note`,
    )
    .run(projectPath, gapId, opts.moduleId ?? '', resolvedAt, opts.note ?? '');
  return { gapId, moduleId: opts.moduleId ?? '', resolvedAt, note: opts.note ?? '' };
}

/** Re-open a resolved gap. Returns whether a resolution was actually removed. */
export function unresolveGap(projectPath: string, gapId: string): boolean {
  const info = getDb()
    .prepare('DELETE FROM gdd_gap_resolutions WHERE project_path = ? AND gap_id = ?')
    .run(projectPath, gapId);
  return info.changes > 0;
}

/** Every resolution recorded for a project, newest first. */
export function listResolutions(projectPath: string): GapResolution[] {
  const rows = getDb()
    .prepare(
      `SELECT gap_id, module_id, resolved_at, note
       FROM gdd_gap_resolutions WHERE project_path = ?
       ORDER BY resolved_at DESC`,
    )
    .all(projectPath) as { gap_id: string; module_id: string; resolved_at: string; note: string }[];
  return rows.map((r) => ({
    gapId: r.gap_id,
    moduleId: r.module_id,
    resolvedAt: r.resolved_at,
    note: r.note,
  }));
}
