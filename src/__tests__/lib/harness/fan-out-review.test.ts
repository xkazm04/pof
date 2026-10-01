/**
 * Fan-out review request — review-at-the-fan-out-point.
 *
 * An area two or more areas depend on directly is copied, extended or styled
 * after by all of them. When it completes without a perceptual PASS, the
 * run-end coverage agenda surfaces that only after every dependent was built on
 * top (the recorded content overhaul ran 29 sessions on its design-consistency
 * area this way). So the request is raised when the area completes. It does NOT
 * hold the dependents: a hold on a gate that cannot run is a required gate by
 * another name, and on the recorded runs it would have completed 9 of 85 areas.
 */
import { describe, it, expect } from 'vitest';
import { fanOutReviewRequest, formatFanOutAgendaLines } from '@/lib/harness/orchestrator';
import type { VerificationGate } from '@/lib/harness/types';

const GATES: VerificationGate[] = [
  { name: 'build', type: 'build', required: true, command: 'next build' },
  { name: 'visual-check', type: 'visual', required: false },
];

const area = (id: string, dependsOn: string[] = []) => ({ id, dependsOn });

// The recorded content overhaul's shape: one consistency pass, six module chains on it.
const PLAN = {
  areas: [
    area('design-consistency'),
    ...['animations', 'audio', 'level', 'materials', 'models', 'uihud'].map((m) => area(`${m}-scaling`, ['design-consistency'])),
    area('animations-flow', ['animations-scaling']),
  ],
} as unknown as Parameters<typeof fanOutReviewRequest>[0];

function report(gates: Array<{ gate: string; passed: boolean; unverifiable?: boolean }>) {
  return { gates: gates.map((g) => ({ ...g, output: '', durationMs: 0 })) };
}

describe('fanOutReviewRequest', () => {
  it('raises a request when a fan-out point completes and the perceptual gate returned no verdict', () => {
    const req = fanOutReviewRequest(PLAN, 'design-consistency', report([
      { gate: 'build', passed: true },
      { gate: 'visual-check', passed: false, unverifiable: true },
    ]), GATES);
    expect(req?.dependents).toHaveLength(6);
    expect(req?.reason).toBe('visual-check returned no verdict');
  });

  it('names a judged FAIL differently from an absent verdict', () => {
    const req = fanOutReviewRequest(PLAN, 'design-consistency', report([
      { gate: 'build', passed: true },
      { gate: 'visual-check', passed: false },
    ]), GATES);
    expect(req?.reason).toBe('visual-check judged it FAIL');
  });

  it('stays silent when the perceptual gate passed', () => {
    expect(fanOutReviewRequest(PLAN, 'design-consistency', report([
      { gate: 'build', passed: true },
      { gate: 'visual-check', passed: true },
    ]), GATES)).toBeNull();
  });

  it('stays silent for an area with fewer than two dependents — its defect cannot spread', () => {
    expect(fanOutReviewRequest(PLAN, 'animations-scaling', report([{ gate: 'build', passed: true }]), GATES)).toBeNull();
    expect(fanOutReviewRequest(PLAN, 'animations-flow', report([{ gate: 'build', passed: true }]), GATES)).toBeNull();
  });

  it('stays silent when no perceptual gate is configured — nothing in the plan claims a look', () => {
    expect(fanOutReviewRequest(PLAN, 'design-consistency', report([{ gate: 'build', passed: true }]),
      GATES.filter((g) => g.type !== 'visual'))).toBeNull();
  });

  it('treats a promoted-with-gaps area (no report) as unjudged', () => {
    expect(fanOutReviewRequest(PLAN, 'design-consistency', null, GATES)?.reason).toBe('visual-check returned no verdict');
  });

  it('counts a ue-visual gate as perceptual too', () => {
    const ue: VerificationGate[] = [{ name: 'ue-visual', type: 'ue-visual', required: false }];
    expect(fanOutReviewRequest(PLAN, 'design-consistency', report([]), ue)?.reason).toBe('ue-visual returned no verdict');
  });
});

describe('formatFanOutAgendaLines', () => {
  it('puts the root first and keeps the dependents named, not deduplicated away', () => {
    const [line] = formatFanOutAgendaLines([{ areaId: 'design-consistency', dependents: ['a', 'b'], reason: 'visual-check returned no verdict' }]);
    expect(line).toMatch(/^Review first: design-consistency \(visual-check returned no verdict\) - 2 dependent area\(s\)/);
    expect(line).toContain('a, b');
    expect(line).toContain('their own items stay on the agenda');
  });

  it('is empty when nothing raised a request', () => {
    expect(formatFanOutAgendaLines([])).toEqual([]);
  });
});
