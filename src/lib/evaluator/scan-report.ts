/**
 * Scan report projection — turns the durable deep-eval scan history
 * (`evaluator_results`, served newest-first by `/api/evaluator/results`) into the
 * `EvaluatorReport` series the Scanner tab's Project Health dashboard renders.
 *
 * Pure (no DB / no React). Two rules make it honest:
 * - A module that was never evaluated has NO score — it is absent from
 *   `moduleScores`, never 0. Coverage accumulates oldest -> newest (each persisted
 *   scan holds the merged baseline, so a module evaluated once stays scored from
 *   the carried-over findings). The overall is the rounded mean of the DEFINED
 *   scores, and the summary states how many modules that mean covers.
 * - Regressions come from {@link deriveScanDeltas} — the same fingerprint diff the
 *   Deep Eval banner and the Game Director's tracker use — not a second
 *   score-threshold rule.
 */

import type { EvaluatorReport, ModuleScore, Recommendation } from '@/types/evaluator';
import type { SubModuleId } from '@/types/modules';
import { MODULE_LABELS } from '@/lib/module-registry';
import type { EvalFinding, FindingSeverity } from './finding-collector';
import { getEvaluableModuleIds } from './module-eval-prompts';
import { deriveScanDeltas } from './scan-delta';
import type { ScanLike } from './scan-delta';

/** Points one finding of each severity takes off a module's 100. */
export const SEVERITY_PENALTY: Readonly<Record<FindingSeverity, number>> = Object.freeze({
  critical: 20,
  high: 8,
  medium: 3,
  low: 1,
});

/** A module-scoped regression raised by the newest scan. */
export interface ScanRegressionAlert {
  /** The module id (one alert per module). */
  id: string;
  message: string;
  severity: 'critical' | 'high';
}

/** Health of one evaluated module: 100 minus its findings' penalties, floored at 0. */
export function scoreModule(findings: readonly Pick<EvalFinding, 'severity'>[]): number {
  const penalty = findings.reduce((sum, f) => sum + (SEVERITY_PENALTY[f.severity] ?? 0), 0);
  return Math.max(0, 100 - penalty);
}

function locationOf(f: EvalFinding): string {
  if (!f.file) return 'no file';
  return f.line != null ? `${f.file}:${f.line}` : f.file;
}

/** A finding as a dashboard recommendation. `id` is the finding id, so Fix can look it up. */
export function findingToRecommendation(f: EvalFinding): Recommendation {
  return {
    id: f.id,
    moduleId: f.moduleId,
    priority: f.severity,
    title: `${f.category} · ${locationOf(f)}`,
    description: f.description,
    suggestedPrompt: f.suggestedFix,
  };
}

function reportOf(scan: ScanLike, covered: readonly string[], universe: number): EvaluatorReport {
  const coveredSet = new Set(covered);
  const byModule = new Map<string, EvalFinding[]>(covered.map((m) => [m, []]));
  for (const f of scan.findings) byModule.get(f.moduleId)?.push(f);

  const moduleScores: ModuleScore[] = covered.map((moduleId) => {
    const fs = byModule.get(moduleId) ?? [];
    return { moduleId: moduleId as SubModuleId, score: scoreModule(fs), issues: fs.map((f) => f.description) };
  });
  const overallScore = moduleScores.length
    ? Math.round(moduleScores.reduce((s, m) => s + m.score, 0) / moduleScores.length)
    : 0;
  const scoped = scan.findings.filter((f) => coveredSet.has(f.moduleId));
  const count = (sev: FindingSeverity) => scoped.filter((f) => f.severity === sev).length;

  return {
    id: scan.scanId,
    timestamp: scan.timestamp,
    overallScore,
    moduleScores,
    recommendations: scoped.map(findingToRecommendation),
    summary:
      `Deep eval scored ${moduleScores.length} of ${universe} modules · ${scoped.length} findings ` +
      `(${count('critical')} critical, ${count('high')} high)`,
  };
}

/**
 * Project the scan history into reports.
 *
 * @param scansNewestFirst  Persisted scans, newest first (as the route serves them).
 * @param universe          The evaluable module ids (the "of N" denominator).
 * @returns                 Reports OLDEST first — the order the timeline/sparkline read.
 */
export function scansToReports(
  scansNewestFirst: readonly ScanLike[],
  universe: readonly string[] = getEvaluableModuleIds(),
): EvaluatorReport[] {
  const covered: string[] = [];
  const reports: EvaluatorReport[] = [];
  for (const scan of [...scansNewestFirst].reverse()) {
    for (const m of scan.modulesEvaluated) if (!covered.includes(m)) covered.push(m);
    const denominator = new Set([...universe, ...covered]).size;
    reports.push(reportOf(scan, [...covered], denominator));
  }
  return reports;
}

function onlyModule(scan: ScanLike, moduleId: string): ScanLike {
  return { ...scan, modulesEvaluated: [moduleId], findings: scan.findings.filter((f) => f.moduleId === moduleId) };
}

/**
 * One alert per module that gained critical/high findings in the newest scan,
 * versus the scan immediately older. A module evaluated for the first time has no
 * baseline and raises nothing (its findings are not a regression); neither does a
 * scan that only resolves findings.
 */
export function regressionAlertsFromScans(scansNewestFirst: readonly ScanLike[]): ScanRegressionAlert[] {
  const [newest, previous] = scansNewestFirst;
  if (!newest || !previous) return [];
  const coveredBefore = new Set(scansNewestFirst.slice(1).flatMap((s) => s.modulesEvaluated));

  const alerts: ScanRegressionAlert[] = [];
  for (const moduleId of newest.modulesEvaluated) {
    if (!coveredBefore.has(moduleId)) continue;
    const [delta] = deriveScanDeltas([onlyModule(newest, moduleId), onlyModule(previous, moduleId)]);
    const { critical, high } = delta.newBySeverity;
    if (critical + high === 0) continue;
    const parts = [critical ? `+${critical} critical` : '', high ? `+${high} high` : ''].filter(Boolean);
    alerts.push({
      id: moduleId,
      severity: critical > 0 ? 'critical' : 'high',
      message: `${MODULE_LABELS[moduleId] ?? moduleId}: ${parts.join(', ')} since the previous scan`,
    });
  }
  return alerts;
}
