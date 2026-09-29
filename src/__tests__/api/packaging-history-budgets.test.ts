/**
 * The size budgets the cook gate judges against are READABLE and SETTABLE through the
 * history route, and the trend is the NEWEST window.
 *
 * Before: getSizeTrend ran `ORDER BY created_at ASC LIMIT ?`, so the dashboard's 50-point
 * trend was the OLDEST 50 green builds and the newest never reached the chart. The
 * `build_size_budgets` row behind every `[SIZE_BUDGET]` verdict had no route at all:
 * the operator could neither see nor change it, and a corrupt row was invisible.
 *
 * Budgets are informational here — nothing enforces failOnRegression, and set-budget
 * never touches it. The surface can retune a budget but cannot switch the gate off.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-packaging-history-budgets-${process.pid}.db`;
});

import { NextRequest } from 'next/server';
import { getDb, setSetting } from '@/lib/db';
import { insertBuild, getSizeTrend } from '@/lib/packaging/build-history-store';
import { getBudgetConfig, setBudgetConfig, getDefaultBudgets } from '@/lib/packaging/size-budgets';
import { GET, POST } from '@/app/api/packaging/history/route';

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const GB = 1024 ** 3;
const qA = `projectPath=${encodeURIComponent(PROJECT_A)}`;

function get(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/packaging/history?${query}`);
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/packaging/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function data<T>(res: Response): Promise<T> {
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data as T;
}

interface BudgetsPayload {
  budgets: Record<string, { budgetBytes: number; growthPercent: number }>;
  failOnRegression: boolean;
  unreadable: boolean;
}

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM build_history').run();
  db.prepare("DELETE FROM settings WHERE key LIKE 'build_size_budgets%'").run();
});

describe('trend window', () => {
  it('returns the NEWEST N green sized builds, oldest-first — not the oldest N', async () => {
    const ids: number[] = [];
    for (let i = 0; i < 60; i++) {
      ids.push(insertBuild({
        projectId: PROJECT_A, platform: 'Win64', config: 'Shipping', status: 'success',
        sizeBytes: (3 + i / 100) * GB,
      }).id);
    }
    const trend = getSizeTrend(undefined, 50, PROJECT_A);
    expect(trend).toHaveLength(50);
    expect(trend[0].id).toBe(ids[10]);
    expect(trend[49].id).toBe(ids[59]);
    expect(trend.map((p) => p.id)).toEqual(ids.slice(10));
    const d = await data<{ trend: Array<{ id: number }> }>(await GET(get(`action=dashboard&trendLimit=50&${qA}`)));
    expect(d.trend[d.trend.length - 1].id).toBe(ids[59]);
  });
});

describe('dashboard reports the budgets', () => {
  it('carries the configured budgets and says whether they were readable', async () => {
    const d = await data<{ budgets: BudgetsPayload }>(await GET(get(`action=dashboard&${qA}`)));
    expect(d.budgets.budgets.Win64).toEqual({ budgetBytes: 5368709120, growthPercent: 10 });
    expect(d.budgets.budgets).toEqual(getDefaultBudgets());
    expect(d.budgets.failOnRegression).toBe(false);
    expect(d.budgets.unreadable).toBe(false);
  });

  it('reports a corrupt budgets row as unreadable instead of hiding it', async () => {
    setSetting('build_size_budgets', '{not json');
    const d = await data<{ budgets: BudgetsPayload }>(await GET(get(`action=dashboard&${qA}`)));
    expect(d.budgets.unreadable).toBe(true);
  });
});

describe('set-budget', () => {
  it('stores under the canonical platform id and leaves other platforms and failOnRegression alone', async () => {
    setBudgetConfig({ budgets: getDefaultBudgets(), failOnRegression: true });
    const res = await POST(post({ action: 'set-budget', platform: 'Windows', budgetBytes: 6442450944, growthPercent: 10 }));
    const d = await data<{ budgets: BudgetsPayload }>(res);
    const stored = getBudgetConfig();
    expect(stored.budgets.Win64).toEqual({ budgetBytes: 6442450944, growthPercent: 10 });
    expect(stored.budgets.Windows).toBeUndefined();
    expect(stored.budgets.Linux).toEqual(getDefaultBudgets().Linux);
    expect(stored.failOnRegression).toBe(true);
    expect(d.budgets.budgets.Win64.budgetBytes).toBe(6442450944);
  });

  it('rejects a budget that would switch the gate off or is out of range with 400', async () => {
    const bad = [
      { platform: 'Win64', budgetBytes: 0, growthPercent: 10 },
      { platform: 'Win64', budgetBytes: -5, growthPercent: 10 },
      { platform: 'Win64', budgetBytes: 6 * GB, growthPercent: 0 },
      { platform: 'Win64', budgetBytes: 6 * GB, growthPercent: 101 },
      { platform: 'Win64', budgetBytes: 'big', growthPercent: 10 },
      { platform: 'PS5', budgetBytes: 6 * GB, growthPercent: 10 },
    ];
    for (const b of bad) {
      const res = await POST(post({ action: 'set-budget', ...b }));
      expect(res.status, JSON.stringify(b)).toBe(400);
    }
    expect(getBudgetConfig().budgets).toEqual(getDefaultBudgets());
  });
});
