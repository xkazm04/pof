import { describe, it, expect } from 'vitest';
import {
  isExpensiveTaskType,
  taskTypeLabel,
  evaluatePreflight,
} from '@/lib/cli-spend/preflight';

describe('cli-spend preflight', () => {
  describe('isExpensiveTaskType', () => {
    it('flags live editor runs and broad scans', () => {
      expect(isExpensiveTaskType('module-scan')).toBe(true);
      expect(isExpensiveTaskType('procgen-dungeon')).toBe(true);
      expect(isExpensiveTaskType('mixamo-import')).toBe(true);
      expect(isExpensiveTaskType('feature-review')).toBe(true);
    });

    it('does not flag cheap interactive task types', () => {
      expect(isExpensiveTaskType('checklist')).toBe(false);
      expect(isExpensiveTaskType('ask-claude')).toBe(false);
      expect(isExpensiveTaskType('interactive')).toBe(false);
    });
  });

  it('taskTypeLabel falls back to the raw id for unknown types', () => {
    expect(taskTypeLabel('module-scan')).toBe('Module scan');
    expect(taskTypeLabel('totally-new-type')).toBe('totally-new-type');
  });

  describe('evaluatePreflight', () => {
    it('does not warn for an expensive task when no budget is configured', () => {
      const v = evaluatePreflight({ taskType: 'module-scan', estimate: { avgCostUsd: 0.5, runs: 4 }, budget: null });
      expect(v.expensive).toBe(true);
      expect(v.warn).toBe(false);
      expect(v.severity).toBe('info');
      expect(v.estimatedCostUsd).toBe(0.5);
      expect(v.sampleSize).toBe(4);
      expect(v.reasons.join(' ')).toMatch(/averaged/i);
    });

    it('warns (danger) when a budget is already exceeded', () => {
      const v = evaluatePreflight({
        taskType: 'checklist',
        estimate: null,
        budget: { dailyExceeded: true, monthlyExceeded: false, dailyRemainingUsd: -0.2, monthlyRemainingUsd: 5 },
      });
      expect(v.budgetExceeded).toBe(true);
      expect(v.warn).toBe(true);
      expect(v.severity).toBe('danger');
    });

    it('warns (warning) when an expensive run would exceed the remaining daily budget', () => {
      const v = evaluatePreflight({
        taskType: 'module-scan',
        estimate: { avgCostUsd: 0.8, runs: 3 },
        budget: { dailyExceeded: false, monthlyExceeded: false, dailyRemainingUsd: 0.3, monthlyRemainingUsd: 10 },
      });
      expect(v.warn).toBe(true);
      expect(v.severity).toBe('warning');
      expect(v.reasons.join(' ')).toMatch(/exceeds today/i);
    });

    it('does not warn when budget is set but comfortably under', () => {
      const v = evaluatePreflight({
        taskType: 'module-scan',
        estimate: { avgCostUsd: 0.1, runs: 3 },
        budget: { dailyExceeded: false, monthlyExceeded: false, dailyRemainingUsd: 5, monthlyRemainingUsd: 50 },
      });
      expect(v.warn).toBe(false);
    });

    it('never warns for a cheap task under a healthy budget', () => {
      const v = evaluatePreflight({
        taskType: 'checklist',
        estimate: { avgCostUsd: 0.02, runs: 10 },
        budget: { dailyExceeded: false, monthlyExceeded: false, dailyRemainingUsd: 1, monthlyRemainingUsd: 10 },
      });
      expect(v.expensive).toBe(false);
      expect(v.warn).toBe(false);
    });
  });
});
