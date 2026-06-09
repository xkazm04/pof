import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import {
  recordSpend,
  getSpendDashboard,
  getBudgetConfig,
  setBudgetConfig,
  getBudgetStatus,
  getTaskTypeEstimate,
  getRecentSpend,
  ensureCliSpendTables,
} from '@/lib/cli-spend-db';
import { getDb } from '@/lib/db';

describe('cli-spend-db', () => {
  beforeEach(() => {
    ensureCliSpendTables();
    getDb().exec('DELETE FROM cli_spend; DELETE FROM cli_spend_budget;');
  });

  it('starts empty', () => {
    const d = getSpendDashboard();
    expect(d.totalRuns).toBe(0);
    expect(d.totalCostUsd).toBe(0);
    expect(d.byModule).toEqual([]);
    expect(getRecentSpend()).toEqual([]);
  });

  it('records runs and aggregates totals + groups', () => {
    recordSpend({ moduleId: 'arpg-combat', taskType: 'module-scan', costUsd: 0.5, tokensIn: 100, tokensOut: 40 });
    recordSpend({ moduleId: 'arpg-combat', taskType: 'checklist', costUsd: 0.2, tokensIn: 50, tokensOut: 20 });
    recordSpend({ moduleId: 'animations', taskType: 'checklist', costUsd: 0.3, tokensIn: 30, tokensOut: 10, success: false });

    const d = getSpendDashboard();
    expect(d.totalRuns).toBe(3);
    expect(d.totalCostUsd).toBeCloseTo(1.0, 5);
    expect(d.totalTokensIn).toBe(180);
    expect(d.totalTokensOut).toBe(70);

    const combat = d.byModule.find((m) => m.key === 'arpg-combat');
    expect(combat?.runs).toBe(2);
    expect(combat?.costUsd).toBeCloseTo(0.7, 5);
    expect(combat?.successCount).toBe(2);

    const checklist = d.byTaskType.find((t) => t.key === 'checklist');
    expect(checklist?.runs).toBe(2);
    expect(checklist?.successCount).toBe(1); // one failed
    expect(checklist?.avgCostUsd).toBeCloseTo(0.25, 5);
  });

  it('reads and writes budget config', () => {
    expect(getBudgetConfig()).toEqual({ dailyLimitUsd: null, monthlyLimitUsd: null });
    const saved = setBudgetConfig({ dailyLimitUsd: 5, monthlyLimitUsd: 100 });
    expect(saved).toEqual({ dailyLimitUsd: 5, monthlyLimitUsd: 100 });
    expect(getBudgetConfig()).toEqual({ dailyLimitUsd: 5, monthlyLimitUsd: 100 });
    // Upsert overwrites the single row
    setBudgetConfig({ dailyLimitUsd: null, monthlyLimitUsd: 50 });
    expect(getBudgetConfig()).toEqual({ dailyLimitUsd: null, monthlyLimitUsd: 50 });
  });

  it('computes budget status against today/month spend', () => {
    setBudgetConfig({ dailyLimitUsd: 1, monthlyLimitUsd: 100 });
    recordSpend({ moduleId: 'm', taskType: 'checklist', costUsd: 1.5, tokensIn: 1, tokensOut: 1 });

    const status = getBudgetStatus();
    expect(status.todaySpendUsd).toBeCloseTo(1.5, 5);
    expect(status.dailyRemainingUsd).toBeCloseTo(-0.5, 5);
    expect(status.dailyExceeded).toBe(true);
    expect(status.monthlyExceeded).toBe(false);
    expect(status.dailyPct).toBeCloseTo(150, 1);
  });

  it('estimates task-type cost from history', () => {
    expect(getTaskTypeEstimate('module-scan')).toBeNull();
    recordSpend({ moduleId: 'm', taskType: 'module-scan', costUsd: 0.4, tokensIn: 1, tokensOut: 1 });
    recordSpend({ moduleId: 'm', taskType: 'module-scan', costUsd: 0.6, tokensIn: 1, tokensOut: 1 });
    const est = getTaskTypeEstimate('module-scan');
    expect(est?.runs).toBe(2);
    expect(est?.avgCostUsd).toBeCloseTo(0.5, 5);
  });

  it('returns recent runs newest-first', () => {
    recordSpend({ moduleId: 'a', taskType: 'checklist', costUsd: 0.1, tokensIn: 1, tokensOut: 1 });
    recordSpend({ moduleId: 'b', taskType: 'checklist', costUsd: 0.1, tokensIn: 1, tokensOut: 1 });
    const recent = getRecentSpend(5);
    expect(recent[0].moduleId).toBe('b');
    expect(recent[1].moduleId).toBe('a');
  });
});
