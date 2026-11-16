/**
 * scan-sweep night 2026-11-08 (module-evaluator): a persisted deep-eval scan whose every
 * module failed is stored with `modulesEvaluated: []` (useDeepEvalResults posts
 * modulesEvaluated minus failedModules). Before any module was ever scored, such a scan
 * projected to a report with overallScore 0 and no module scores — a "0 / 100 health"
 * the Scanner gauge, sparkline and timeline drew from a run that measured nothing.
 * A report exists only once at least one module has been scored.
 */
import { describe, it, expect } from 'vitest';
import { scansToReports } from '@/lib/evaluator/scan-report';
import type { ScanLike } from '@/lib/evaluator/scan-delta';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';

function scan(id: string, t: number, modulesEvaluated: string[], findings: EvalFinding[] = []): ScanLike {
  return { scanId: id, timestamp: t, scannedAt: new Date(t).toISOString(), modulesEvaluated, findings };
}

describe('scansToReports — a scan that scored nothing is not a 0 report', () => {
  it('an all-failed first scan yields no report', () => {
    expect(scansToReports([scan('s1', 1, [])])).toEqual([]);
  });

  it('all-failed scans before the first scored one are dropped; later ones keep the carried coverage', () => {
    const reports = scansToReports([scan('s3', 3, []), scan('s2', 2, ['audio']), scan('s1', 1, [])]);
    expect(reports.map((r) => r.id)).toEqual(['s2', 's3']);
    expect(reports.every((r) => r.moduleScores.length > 0)).toBe(true);
  });
});
