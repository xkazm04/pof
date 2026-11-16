/** The timeline delta compares only modules scored in both scans; a coverage gain is not a regression. */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { EvaluatorReport } from '@/types/evaluator';
import { ScanHistoryTimeline } from '@/components/modules/evaluator/ProjectHealthDashboard/ScanHistoryTimeline';

afterEach(cleanup);

function report(id: string, ts: string, scores: Record<string, number>): EvaluatorReport {
  const moduleScores = Object.entries(scores).map(([moduleId, score]) => ({ moduleId, score, issues: [] }));
  const overallScore = Math.round(moduleScores.reduce((s, m) => s + m.score, 0) / moduleScores.length);
  return { id, timestamp: ts, overallScore, moduleScores, recommendations: [], summary: '' } as unknown as EvaluatorReport;
}

const A = report('a', '2026-01-01T10:00:00Z', { m1: 100, m2: 100, m3: 100 });
const B = report('b', '2026-01-02T10:00:00Z', { m1: 100, m2: 100, m3: 100, m4: 40 });

describe('ScanHistoryTimeline delta', () => {
  it('adding a weak fourth module shows no regression and notes the coverage change', () => {
    const { container } = render(<ScanHistoryTimeline scanHistory={[A, B]} />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('-15');
    expect(text).toContain('+1 module scored');
  });

  it('a real drop on the shared set still shows', () => {
    const C = report('c', '2026-01-03T10:00:00Z', { m1: 70, m2: 100, m3: 100, m4: 40 });
    const { container } = render(<ScanHistoryTimeline scanHistory={[B, C]} />);
    expect(container.textContent).toContain('-7');
  });
});
