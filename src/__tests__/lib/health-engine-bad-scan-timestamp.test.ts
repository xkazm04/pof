/**
 * One persisted scan with an unparseable timestamp must degrade the quality
 * series by one point, not throw RangeError out of computeProjectHealth.
 */
import { describe, it, expect } from 'vitest';
import { computeProjectHealth } from '@/lib/health-engine';
import type { EvaluatorReport } from '@/types/evaluator';

const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);

function scan(timestamp: string, overallScore: number): EvaluatorReport {
  return { timestamp, overallScore, recommendations: [], moduleScores: [] } as unknown as EvaluatorReport;
}

describe('health-engine - malformed scan timestamp', () => {
  it('skips the scan with an invalid timestamp instead of throwing', () => {
    const history = [scan('2026-09-01T00:00:00.000Z', 60), scan('n/a', 70), scan('2026-09-20T00:00:00.000Z', 80)];
    const h = computeProjectHealth({}, history, null, null, null, {}, NOW);
    expect(h.qualityHistory).toHaveLength(2);
    expect(h.qualityHistory.map((p) => p.overallScore)).toEqual([60, 80]);
  });
});
