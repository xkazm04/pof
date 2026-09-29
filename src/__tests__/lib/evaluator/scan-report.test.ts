/**
 * scan-sweep --challenge (project-health-dashboards/A): the Scanner tab's Project
 * Health dashboard is a projection of the durable deep-eval history
 * (`evaluator_results`), not of a store nothing writes. A module never evaluated is
 * ABSENT (no score), never 0; the overall is the mean of the DEFINED scores with the
 * count beside it; regressions come from the same fingerprint diff the Deep Eval
 * banner and the Game Director tracker use.
 */
import { describe, it, expect } from 'vitest';
import {
  SEVERITY_PENALTY,
  scoreModule,
  scansToReports,
  findingToRecommendation,
  regressionAlertsFromScans,
} from '@/lib/evaluator/scan-report';
import { getEvaluableModuleIds } from '@/lib/evaluator/module-eval-prompts';
import type { ScanLike } from '@/lib/evaluator/scan-delta';
import type { EvalFinding, FindingSeverity } from '@/lib/evaluator/finding-collector';
import type { SubModuleId } from '@/types/modules';

const EVALUABLE = getEvaluableModuleIds().length;

let seq = 0;
function finding(
  moduleId: string,
  severity: FindingSeverity,
  description: string,
  over: Partial<EvalFinding> = {},
): EvalFinding {
  seq += 1;
  return {
    id: `f-${seq}`,
    scanId: 's',
    moduleId: moduleId as SubModuleId,
    pass: 'quality',
    category: `cat-${description}`,
    severity,
    file: `Source/${description}.cpp`,
    line: 10,
    description,
    suggestedFix: `fix ${description}`,
    effort: 'small',
    timestamp: 0,
    ...over,
  };
}

function scan(id: string, t: number, modulesEvaluated: string[], findings: EvalFinding[]): ScanLike {
  return { scanId: id, timestamp: t, scannedAt: new Date(t).toISOString(), modulesEvaluated, findings };
}

describe('scansToReports', () => {
  it('no scans -> no reports', () => {
    expect(scansToReports([])).toEqual([]);
  });

  it('scores only evaluated modules; overall is the mean of DEFINED scores; unevaluated modules are absent', () => {
    const findings = [
      finding('arpg-combat', 'critical', 'crit'),
      finding('arpg-combat', 'high', 'hi'),
      finding('arpg-combat', 'low', 'lo'),
    ];
    const [report] = scansToReports([scan('s1', 1000, ['arpg-combat', 'arpg-loot'], findings)]);
    expect(report.moduleScores).toEqual([
      { moduleId: 'arpg-combat', score: 71, issues: ['crit', 'hi', 'lo'] },
      { moduleId: 'arpg-loot', score: 100, issues: [] },
    ]);
    expect(report.overallScore).toBe(86);
    expect(report.moduleScores.find((m) => m.moduleId === 'animations')).toBeUndefined();
    expect(report.id).toBe('s1');
    expect(report.timestamp).toBe(1000);
  });

  it('accumulates coverage oldest -> newest and states the scored-module count', () => {
    const s1 = scan('s1', 1000, ['arpg-combat'], []);
    const s2 = scan('s2', 2000, ['arpg-loot'], []);
    const reports = scansToReports([s2, s1]);
    expect(reports.map((r) => r.id)).toEqual(['s1', 's2']);
    expect(reports[0].moduleScores).toEqual([{ moduleId: 'arpg-combat', score: 100, issues: [] }]);
    expect(reports[1].moduleScores.map((m) => m.moduleId)).toEqual(['arpg-combat', 'arpg-loot']);
    expect(reports[0].summary).toContain(`scored 1 of ${EVALUABLE} modules`);
    expect(reports[1].summary).toContain(`scored 2 of ${EVALUABLE} modules`);
  });
});

describe('scoreModule', () => {
  it('floors at 0 and the penalty is one exported constant', () => {
    expect(SEVERITY_PENALTY).toEqual({ critical: 20, high: 8, medium: 3, low: 1 });
    const six = Array.from({ length: 6 }, (_, i) => finding('arpg-combat', 'critical', `c${i}`));
    expect(scoreModule(six)).toBe(0);
    const [report] = scansToReports([scan('s', 1, ['arpg-combat'], six)]);
    expect(report.moduleScores[0].score).toBe(0);
  });
});

describe('findingToRecommendation', () => {
  it('keeps the finding id + module, maps severity to priority, names category and location', () => {
    const f = finding('arpg-combat', 'high', 'd', {
      id: 'f1',
      category: 'gas',
      file: 'Source/X.cpp',
      line: 42,
      suggestedFix: 's',
    });
    const rec = findingToRecommendation(f);
    expect(rec).toMatchObject({ id: 'f1', moduleId: 'arpg-combat', priority: 'high' });
    expect(rec.title).toContain('gas');
    expect(rec.title).toContain('Source/X.cpp:42');
  });
});

describe('regressionAlertsFromScans', () => {
  it('one alert per module that gained critical/high findings in the newest scan', () => {
    const base = finding('arpg-combat', 'high', 'old');
    const s1 = scan('s1', 1000, ['arpg-combat'], [base]);
    const s2 = scan('s2', 2000, ['arpg-combat'], [base, finding('arpg-combat', 'critical', 'new-crit')]);
    const alerts = regressionAlertsFromScans([s2, s1]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: 'arpg-combat', severity: 'critical' });
    expect(alerts[0].message).toContain('+1 critical');
  });

  it('a newer scan that only resolves findings raises nothing', () => {
    const a = finding('arpg-combat', 'critical', 'a');
    const b = finding('arpg-combat', 'high', 'b');
    const s1 = scan('s1', 1000, ['arpg-combat'], [a, b]);
    const s2 = scan('s2', 2000, ['arpg-combat'], [a]);
    expect(regressionAlertsFromScans([s2, s1])).toEqual([]);
  });
});
