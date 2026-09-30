import { describe, it, expect } from 'vitest';
import {
  buildOptimizationQueue, findingFixFeature,
} from '@/components/modules/core-engine/sub_debug/_shared/optimizationQueue';
import type { PerformanceFinding, OptimizationPriority, TriageResult } from '@/types/performance-profiling';
import type { SessionComparisonResponse } from '@/lib/profiling/session-compare';

/**
 * Acceptance for scan-sweep --challenge card debug-performance/B: the Debug
 * tab's optimization queue is the newest capture's triage, ranked by priority
 * then measured savings, with a verification state that only a newer,
 * comparable capture can move to resolved / still-present.
 */

function finding(id: string, priority: OptimizationPriority, estimatedSavingsMs: number): PerformanceFinding {
  return {
    id, priority, estimatedSavingsMs,
    category: 'tick',
    title: `${id} title`,
    description: `${id} description`,
    involvedClasses: ['BP_Enemy'],
    fixPrompt: `Fix prompt for ${id}: set TickInterval to 0.1f.`,
    checklistLabel: `Optimize ${id}`,
    metric: 'tickFrequencyHz',
    metricValue: 60,
    metricThreshold: 10,
  };
}

function triage(findings: PerformanceFinding[]): TriageResult {
  return { sessionId: 'head', findings, overallScore: 50, bottleneck: 'game-thread', generatedAt: '2026-09-30T10:00:00.000Z' };
}

const HEAD_AT = '2026-09-30T10:00:00.000Z';
const BEFORE_HEAD = Date.parse('2026-09-30T09:00:00.000Z');

function comparison(patch: Partial<SessionComparisonResponse>): SessionComparisonResponse {
  const head = { id: 'head', name: 'head', importedAt: HEAD_AT, frameBudgetMs: 16.67, overallScore: 60, bottleneck: 'game-thread' as const };
  return {
    base: { ...head, id: 'base', importedAt: '2026-09-29T10:00:00.000Z' },
    head,
    comparable: true,
    metrics: [],
    findings: { resolved: [], introduced: [], persisting: [] },
    resolvedFindings: [],
    introducedFindings: [],
    realizedSavingsMs: 0,
    overall: 'unchanged',
    ...patch,
  };
}

describe('buildOptimizationQueue', () => {
  it('no triage -> no-capture with no rows', () => {
    const q = buildOptimizationQueue({ triage: null, comparison: null, dispatched: {} });
    expect(q.state).toBe('no-capture');
    expect(q.rows).toEqual([]);
  });

  it('ranks by priority, then estimated savings desc; every row open', () => {
    const q = buildOptimizationQueue({
      triage: triage([finding('m', 'medium', 0.2), finding('c', 'critical', 1.5), finding('h1', 'high', 3.0), finding('h2', 'high', 0.4)]),
      comparison: null, dispatched: {},
    });
    expect(q.state).toBe('capture');
    expect(q.rows.map((r) => [r.finding.priority, r.finding.estimatedSavingsMs])).toEqual([
      ['critical', 1.5], ['high', 3.0], ['high', 0.4], ['medium', 0.2],
    ]);
    expect(q.rows.every((r) => r.state === 'open')).toBe(true);
  });

  it('a resolved finding from the compare is a resolved row after every open row; realized savings from the compare', () => {
    const f1 = finding('F1', 'critical', 1.2);
    const q = buildOptimizationQueue({
      triage: triage([finding('a', 'low', 0.1), finding('b', 'medium', 0.3)]),
      comparison: comparison({ resolvedFindings: [f1], findings: { resolved: ['F1'], introduced: [], persisting: [] }, realizedSavingsMs: 1.2 }),
      dispatched: {},
    });
    expect(q.rows.map((r) => [r.finding.id, r.state])).toEqual([['b', 'open'], ['a', 'open'], ['F1', 'resolved']]);
    expect(q.realizedSavingsMs).toBe(1.2);
  });

  it('dispatched + persisting in a newer capture -> still-present; dispatched with no compare -> dispatched', () => {
    const persisting = comparison({
      findings: { resolved: [], introduced: [], persisting: [{ id: 'F2', baseValue: 60, headValue: 60, metricDelta: 0 }] },
    });
    const q = buildOptimizationQueue({ triage: triage([finding('F2', 'high', 1)]), comparison: persisting, dispatched: { F2: BEFORE_HEAD } });
    expect(q.rows.find((r) => r.finding.id === 'F2')?.state).toBe('still-present');

    const q2 = buildOptimizationQueue({ triage: triage([finding('F3', 'high', 1)]), comparison: null, dispatched: { F3: BEFORE_HEAD } });
    expect(q2.rows.find((r) => r.finding.id === 'F3')?.state).toBe('dispatched');
  });

  it('a fix dispatched AFTER the newest capture is not judged by that capture: dispatched, not still-present', () => {
    const persisting = comparison({
      findings: { resolved: [], introduced: [], persisting: [{ id: 'F2', baseValue: 60, headValue: 60, metricDelta: 0 }] },
    });
    const q = buildOptimizationQueue({
      triage: triage([finding('F2', 'high', 1)]), comparison: persisting, dispatched: { F2: Date.parse(HEAD_AT) + 60_000 },
    });
    expect(q.rows[0].state).toBe('dispatched');
  });

  it('comparable === false is no verification: no resolved / still-present rows, realizedSavingsMs null', () => {
    const q = buildOptimizationQueue({
      triage: triage([finding('F2', 'high', 1)]),
      comparison: comparison({
        comparable: false, overall: 'not-comparable',
        resolvedFindings: [finding('F1', 'critical', 1.2)], realizedSavingsMs: 1.2,
        findings: { resolved: ['F1'], introduced: [], persisting: [{ id: 'F2', baseValue: 60, headValue: 60, metricDelta: 0 }] },
      }),
      dispatched: { F2: BEFORE_HEAD },
    });
    expect(q.rows.map((r) => [r.finding.id, r.state])).toEqual([['F2', 'dispatched']]);
    expect(q.realizedSavingsMs).toBeNull();
    expect(q.verified).toBe(false);
  });

  it('a generated (manual-source) session -> synthetic rows, never resolved, no realized savings', () => {
    const q = buildOptimizationQueue({
      triage: triage([finding('F1', 'critical', 1.5)]),
      comparison: comparison({ resolvedFindings: [finding('F9', 'low', 0.1)], realizedSavingsMs: 0.1 }),
      dispatched: {},
      source: 'manual',
    });
    expect(q.state).toBe('synthetic');
    expect(q.rows.map((r) => [r.finding.id, r.state])).toEqual([['F1', 'synthetic']]);
    expect(q.realizedSavingsMs).toBeNull();
  });
});

describe('findingFixFeature', () => {
  it('featureFix payload: checklistLabel as the work item, fixPrompt + the triggering metric line as next steps', () => {
    const f = finding('tick-freq-BP_Enemy', 'critical', 1.5);
    const feature = findingFixFeature(f);
    expect(feature).toMatchObject({ featureName: f.checklistLabel, status: 'partial', filePaths: [], qualityScore: null });
    expect(feature.nextSteps).toContain(f.fixPrompt);
    expect(feature.nextSteps).toContain(`${f.metric}: ${f.metricValue} (threshold ${f.metricThreshold})`);
  });
});
