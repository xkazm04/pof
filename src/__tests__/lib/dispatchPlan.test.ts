import { describe, it, expect } from 'vitest';
import { describeDispatchPlan, type DispatchPlan } from '@/lib/cli-spend/dispatchPlan';

const plan = (over: Partial<DispatchPlan> = {}): DispatchPlan => ({
  taskType: 'one-shot-step',
  label: 'Pipeline step',
  taskClass: 'produce-text',
  model: 'sonnet',
  effort: 'medium',
  estimate: { avgCostUsd: 0.42, runs: 12 },
  ...over,
});

describe('describeDispatchPlan', () => {
  it('names the model, the effort and the class that chose them', () => {
    const d = describeDispatchPlan(plan());
    expect(d.model).toContain('sonnet');
    expect(d.model).toContain('medium');
    expect(d.model).toContain('produce-text');
  });

  it('says the spawn is unpinned when no policy class covers the task type', () => {
    const d = describeDispatchPlan(plan({ taskClass: null, model: null, effort: null }));
    expect(d.model).toMatch(/no policy|unpinned|session/i);
    expect(d.model).not.toMatch(/sonnet/i);
    expect(d.pinned).toBe(false);
  });

  it('marks a policy-pinned plan as pinned', () => {
    expect(describeDispatchPlan(plan()).pinned).toBe(true);
  });

  it('prices the dispatch from real history', () => {
    const d = describeDispatchPlan(plan({ estimate: { avgCostUsd: 0.42, runs: 12 } }));
    expect(d.cost).toContain('$0.42');
    expect(d.cost).toContain('12');
  });

  it('keeps sub-cent averages legible instead of collapsing them to $0.00', () => {
    const d = describeDispatchPlan(plan({ estimate: { avgCostUsd: 0.0031, runs: 3 } }));
    expect(d.cost).toContain('$0.0031');
  });

  it('refuses to invent a number when there is no history', () => {
    const d = describeDispatchPlan(plan({ estimate: null }));
    expect(d.cost).toMatch(/no cost history/i);
    expect(d.cost).not.toMatch(/\$/);
    expect(d.priced).toBe(false);
  });

  it('does not price a single run as an average', () => {
    const d = describeDispatchPlan(plan({ estimate: { avgCostUsd: 1.5, runs: 1 } }));
    expect(d.cost).toContain('$1.50');
    // one run is a data point, not an average — the copy must not claim otherwise
    expect(d.cost).toMatch(/1 past run\b/);
    expect(d.cost).not.toMatch(/runs/);
  });

  it('is total for an unknown task type (no class, no history)', () => {
    const d = describeDispatchPlan(plan({ taskClass: null, model: null, effort: null, estimate: null }));
    expect(d.pinned).toBe(false);
    expect(d.priced).toBe(false);
    expect(d.model.length).toBeGreaterThan(0);
    expect(d.cost.length).toBeGreaterThan(0);
  });
});
