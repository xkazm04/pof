import { describe, it, expect } from 'vitest';
import { summarizeScenarios } from '@/types/ai-testing';
import type { TestScenario, ScenarioStatus } from '@/types/ai-testing';

// These tests lock the "single source of truth" contract: the DB summary
// (getTestingSummary) and the AITestingSandbox UI both derive their counts from
// summarizeScenarios, so the aggregation semantics — especially that `error`
// counts as failed — can never drift apart.

function scenario(status: ScenarioStatus): TestScenario {
  return {
    id: 1,
    suiteId: 1,
    name: 'scenario',
    description: '',
    stimuli: [],
    expectedActions: [],
    status,
    lastRunOutput: '',
    lastRunAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('summarizeScenarios', () => {
  it('returns all-zero counts and 0 pass-rate for an empty list', () => {
    expect(summarizeScenarios([])).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
      draft: 0,
      passRate: 0,
    });
  });

  it('counts error as failed', () => {
    const summary = summarizeScenarios([scenario('failed'), scenario('error')]);
    expect(summary.failed).toBe(2);
    expect(summary.passed).toBe(0);
  });

  it('does not count running/ready toward passed, failed, or draft', () => {
    const summary = summarizeScenarios([scenario('running'), scenario('ready')]);
    expect(summary).toEqual({
      total: 2,
      passed: 0,
      failed: 0,
      draft: 0,
      passRate: 0,
    });
  });

  it('computes a rounded pass-rate', () => {
    // 1 passed of 3 → 33%
    const summary = summarizeScenarios([
      scenario('passed'),
      scenario('failed'),
      scenario('draft'),
    ]);
    expect(summary).toEqual({
      total: 3,
      passed: 1,
      failed: 1,
      draft: 1,
      passRate: 33,
    });
  });

  it('reports 100% pass-rate when every scenario passed', () => {
    const summary = summarizeScenarios([scenario('passed'), scenario('passed')]);
    expect(summary.passRate).toBe(100);
  });
});
