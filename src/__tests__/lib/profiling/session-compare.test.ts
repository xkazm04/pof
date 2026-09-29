/**
 * compareSessions — the before/after diff behind the profiler's compare mode.
 * Direction-aware metric verdicts, a findings set-diff keyed on the triage's
 * stable ids (duplicates paired by occurrence), and no verdict across budgets.
 */
import { describe, it, expect } from 'vitest';
import { compareSessions, type CompareFinding } from '@/lib/profiling/session-compare';

const BASE = { avgFrameMs: 20, p99FrameMs: 30, avgGameThreadMs: 12, budgetHitRate: 55, frameBudgetMs: 16.67 };
const HEAD = { avgFrameMs: 15, p99FrameMs: 22, avgGameThreadMs: 8, budgetHitRate: 80, frameBudgetMs: 16.67 };

function finding(id: string, over: Partial<CompareFinding> = {}): CompareFinding {
  return { id, priority: 'medium', estimatedSavingsMs: 1, metricValue: 10, ...over };
}

describe('compareSessions', () => {
  it('metric rows carry direction-aware verdicts (lower ms is better, higher hit rate is better)', () => {
    const c = compareSessions(BASE, HEAD);
    const frame = c.metrics.find((m) => m.key === 'avgFrameMs');
    expect(frame).toMatchObject({ base: 20, head: 15, delta: -5, better: true });
    expect(c.metrics.find((m) => m.key === 'budgetHitRate')).toMatchObject({ delta: 25, better: true });
    expect(c.metrics.find((m) => m.key === 'p99FrameMs')).toMatchObject({ delta: -8, better: true });
    // frameBudgetMs is the target, not a measurement: it never becomes a row.
    expect(c.metrics.some((m) => (m.key as string) === 'frameBudgetMs')).toBe(false);
    expect(c.comparable).toBe(true);
    expect(c.overall).toBe('improved');
  });

  it('findings diff on stable id: resolved / introduced / persisting with a metric delta, and realized savings', () => {
    const base = [
      finding('tick-freq-BP_Enemy', { estimatedSavingsMs: 3.2 }),
      finding('gc-pause-long', { metricValue: 8.5 }),
    ];
    const head = [
      finding('gc-pause-long', { metricValue: 5 }),
      finding('draw-calls-high'),
    ];
    const c = compareSessions(BASE, HEAD, base, head);
    expect(c.findings.resolved).toEqual(['tick-freq-BP_Enemy']);
    expect(c.findings.introduced).toEqual(['draw-calls-high']);
    expect(c.findings.persisting).toHaveLength(1);
    expect(c.findings.persisting[0]).toMatchObject({ id: 'gc-pause-long', metricDelta: 5 - 8.5 });
    expect(c.realizedSavingsMs).toBe(3.2);
  });

  it('duplicate ids within one triage are paired by occurrence, never collapsed', () => {
    const base = [finding('tick-freq-EnemyProjectile'), finding('tick-freq-EnemyProjectile', { estimatedSavingsMs: 2 })];
    const head = [finding('tick-freq-EnemyProjectile')];
    const c = compareSessions(BASE, HEAD, base, head);
    expect(c.findings.persisting).toHaveLength(1);
    expect(c.findings.resolved).toEqual(['tick-freq-EnemyProjectile']);
    expect(c.findings.introduced).toEqual([]);
    expect(c.realizedSavingsMs).toBe(2);
  });

  it('different frame budgets -> not comparable, reason names both budgets, hit rate gets no verdict', () => {
    const c = compareSessions(BASE, { ...HEAD, frameBudgetMs: 33.33 });
    expect(c.comparable).toBe(false);
    expect(c.reason).toContain('16.67');
    expect(c.reason).toContain('33.33');
    const hit = c.metrics.find((m) => m.key === 'budgetHitRate');
    expect(hit?.delta).toBe(25);
    expect(hit?.better).toBeNull();
    expect(c.overall).toBe('not-comparable');
  });

  it('a new critical finding while avg frame improves is mixed, not improved', () => {
    const c = compareSessions(BASE, HEAD, [], [finding('frame-budget-gpu', { priority: 'critical' })]);
    expect(c.metrics.find((m) => m.key === 'avgFrameMs')?.better).toBe(true);
    expect(c.overall).toBe('mixed');
  });
});
