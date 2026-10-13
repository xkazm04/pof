import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { recordSpend, getBudgetStatus, getRecentSpend, ensureCliSpendTables } from '@/lib/cli-spend-db';
import { getDb } from '@/lib/db';

/**
 * The budget guard reads `recorded_at` as a UTC ISO prefix and sums `cost_usd`. The write path
 * stored whatever the caller handed it, so the pair disagreed: an offset timestamp landed under
 * the wrong UTC day, an unparseable one under no day, and a negative cost subtracted from the
 * total the guard compares against the limit.
 */
describe('recordSpend - writes what the budget guard reads', () => {
  beforeEach(() => {
    ensureCliSpendTables();
    getDb().exec('DELETE FROM cli_spend; DELETE FROM cli_spend_budget;');
  });

  it('normalises an offset timestamp to the UTC instant, so the UTC-day prefix is right', () => {
    const now = new Date();
    const d = now.getUTCDate();
    // 01:00Z today, written as the PREVIOUS calendar day at 20:00 in UTC-5.
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), d - 1, 20, 0, 0));
    const pad = (n: number) => String(n).padStart(2, '0');
    const offsetStamp = `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}T20:00:00-05:00`;
    const rec = recordSpend({ costUsd: 2, tokensIn: 1, tokensOut: 1, recordedAt: offsetStamp });
    expect(rec.recordedAt).toBe(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), d, 1, 0, 0)).toISOString());
    expect(getBudgetStatus().todaySpendUsd).toBe(2);
  });

  it('an unparseable timestamp falls back to now instead of vanishing from every budget window', () => {
    const rec = recordSpend({ costUsd: 3, tokensIn: 1, tokensOut: 1, recordedAt: 'not a date' });
    expect(Number.isNaN(Date.parse(rec.recordedAt))).toBe(false);
    expect(getBudgetStatus().todaySpendUsd).toBe(3);
  });

  it('negative, NaN and infinite figures are stored as 0, never subtracted from the budgeted total', () => {
    recordSpend({ costUsd: 1, tokensIn: 10, tokensOut: 10 });
    recordSpend({ costUsd: -5, tokensIn: -10, tokensOut: -10 });
    recordSpend({ costUsd: Number.NaN, tokensIn: Number.NaN, tokensOut: Number.POSITIVE_INFINITY });
    recordSpend({ costUsd: Number.POSITIVE_INFINITY, tokensIn: 1, tokensOut: 1 });
    expect(getBudgetStatus().todaySpendUsd).toBe(1);
    const rows = getRecentSpend();
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(Number.isFinite(r.costUsd) && r.costUsd >= 0).toBe(true);
      expect(Number.isFinite(r.tokensIn) && r.tokensIn >= 0).toBe(true);
      expect(Number.isFinite(r.tokensOut) && r.tokensOut >= 0).toBe(true);
    }
  });
});
