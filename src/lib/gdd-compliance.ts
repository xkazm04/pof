/**
 * GDD Compliance Engine — Cross-references design intent (GDD/checklists)
 * against implementation reality (feature matrix/reviews) to detect gaps.
 */

import { getDb } from './db';
import { SUB_MODULES, SUB_MODULE_MAP } from './module-registry';
import { getFeaturesByModule, getFeatureSummary, getAllModuleAggregates } from './feature-matrix-db';
import type { FeatureRow, FeatureSummary } from '@/types/feature-matrix';
import type {
  ComplianceGap, ComplianceReport, ModuleCompliance,
  ReconciliationSuggestion, GapSeverity, GapDirection, EffortEstimate,
} from '@/types/gdd-compliance';

// ─── Gap Detection ──────────────────────────────────────────────────────────

function detectFeatureGaps(
  moduleId: string,
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

// ─── Scoring ────────────────────────────────────────────────────────────────

function calculateModuleScore(
  summary: FeatureSummary,
  checklistTotal: number,
  checklistDone: number,
  gapCount: number,
): number {
  if (summary.total === 0 && checklistTotal === 0) return 100;

  let score = 100;

  // Feature implementation weight (60%)
  if (summary.total > 0) {
    const featureScore =
      ((summary.implemented + summary.partial * 0.5) / summary.total) * 100;
    score = featureScore * 0.6;
  } else {
    score = 60; // No scan data, assume neutral
  }

  // Checklist weight (30%)
  if (checklistTotal > 0) {
    score += (checklistDone / checklistTotal) * 100 * 0.3;
  } else {
    score += 30;
  }

  // Gap penalty (10%)
  const gapPenalty = Math.min(gapCount * 2, 10);
  score += 10 - gapPenalty;

  return Math.round(Math.max(0, Math.min(100, score)));
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
): ComplianceReport {
  const modules: ModuleCompliance[] = [];

  for (const mod of SUB_MODULES) {
    const checklist = mod.checklist ?? [];
    if (checklist.length === 0) {
      // Try to get features even for modules without checklists
      const features = getFeaturesByModule(mod.id);
      if (features.length === 0) continue;
    }

    const features = getFeaturesByModule(mod.id);
    const summary = features.length > 0
      ? getFeatureSummary(mod.id)
      : { total: 0, implemented: 0, partial: 0, missing: 0, unknown: 0 };

    const moduleProgress = checklistProgress[mod.id] ?? {};
    const checklistDone = checklist.filter((c) => moduleProgress[c.id]).length;

    const gaps = detectFeatureGaps(
      mod.id,
      mod.label,
      features,
      checklist.map((c) => ({ id: c.id, label: c.label })),
      moduleProgress,
    );

    const score = calculateModuleScore(summary, checklist.length, checklistDone, gaps.length);

    modules.push({
      moduleId: mod.id,
      moduleName: mod.label,
      score,
      totalFeatures: summary.total,
      implemented: summary.implemented,
      partial: summary.partial,
      missing: summary.missing,
      checklistTotal: checklist.length,
      checklistDone,
      gaps,
    });
  }

  // Overall score = weighted by total items per module
  const totalItems = modules.reduce((s, m) => s + m.totalFeatures + m.checklistTotal, 0);
  const overallScore = totalItems > 0
    ? Math.round(
        modules.reduce(
          (s, m) => s + m.score * (m.totalFeatures + m.checklistTotal),
          0,
        ) / totalItems,
      )
    : 100;

  const allGaps = modules.flatMap((m) => m.gaps);
  const suggestions = generateSuggestions(modules);

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    modules: modules.sort((a, b) => a.score - b.score),
    totalGaps: allGaps.length,
    criticalGaps: allGaps.filter((g) => g.severity === 'critical').length,
    suggestions,
  };
}

export function resolveGap(
  report: ComplianceReport,
  gapId: string,
): ComplianceReport {
  const updated = { ...report };
  for (const mod of updated.modules) {
    const gap = mod.gaps.find((g) => g.id === gapId);
    if (gap) {
      gap.resolved = true;
      break;
    }
  }
  updated.totalGaps = updated.modules.flatMap((m) => m.gaps).filter((g) => !g.resolved).length;
  updated.criticalGaps = updated.modules
    .flatMap((m) => m.gaps)
    .filter((g) => g.severity === 'critical' && !g.resolved).length;
  return updated;
}
