/**
 * The Trends tab judges each build with the COOK GATE'S OWN rule, per platform.
 *
 * Before: the chart drew every platform as one polyline and its headline delta was
 * last-minus-first across whatever platforms were interleaved (a Win64 build followed
 * by an Android build read as a huge shrink). The growth rule lived only in
 * size-budgets.ts, which imports the DB through settings-blob, so no client component
 * could apply it — a chart could only re-implement it.
 *
 * Rule: size-verdict.ts is the single pure implementation; size-budgets.ts wraps it
 * with the stored config. The trend model projects points into per-platform series,
 * each point's baseline is the previous green sized point of the SAME platform, and a
 * point with no prior in the window is 'no-baseline' — no reference is not "ok".
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { SizeTrendPoint } from '@/lib/packaging/build-history-store';
import { buildSizeTrendModel, whatIf } from '@/lib/packaging/size-trend-model';
import * as verdict from '@/lib/packaging/size-verdict';
import * as budgets from '@/lib/packaging/size-budgets';

const GB = 1024 ** 3;
const P = 'c:/users/kazda/documents/unreal projects/pof';

function pt(id: number, platform: string, gib: number, version: string | null = null): SizeTrendPoint {
  return { id, projectId: P, platform, sizeBytes: gib * GB, version, createdAt: `2026-09-0${id} 10:00:00` };
}

const MIXED = [pt(1, 'Win64', 3.0, '0.1.1'), pt(2, 'Android', 1.0, '0.1.2'), pt(3, 'Win64', 3.4, '0.1.3')];
const DEFAULTS = { budgets: verdict.getDefaultBudgets(), failOnRegression: false };

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('per-platform series', () => {
  it('splits an interleaved window into one series per platform; the delta is within the platform', () => {
    const model = buildSizeTrendModel(MIXED, DEFAULTS);
    const win = model.series.find((s) => s.platform === 'Win64')!;
    const android = model.series.find((s) => s.platform === 'Android')!;
    expect(model.series).toHaveLength(2);
    expect(win.points.map((p) => p.id)).toEqual([1, 3]);
    expect(android.points.map((p) => p.id)).toEqual([2]);
    expect(win.deltaPercent).toBeCloseTo(13.33, 1);
    expect(win.deltaBytes).toBeCloseTo(0.4 * GB, 0);
    expect(android.deltaPercent).toBeNull();
    expect(win.budget.budgetBytes).toBe(5 * GB);
  });
});

describe('verdicts', () => {
  it('flags Win64 #3 on growth with its comparison pair; each series head is no-baseline, never ok', () => {
    const model = buildSizeTrendModel(MIXED, DEFAULTS);
    const win = model.series.find((s) => s.platform === 'Win64')!;
    const android = model.series.find((s) => s.platform === 'Android')!;
    const [first, third] = win.points;
    expect(third.state).toBe('flagged');
    expect(third.verdict?.exceedsGrowth).toBe(true);
    expect(third.verdict?.exceedsBudget).toBe(false);
    expect(third.comparePair).toEqual({ left: 1, right: 3 });
    expect(first.state).toBe('no-baseline');
    expect(first.comparePair).toBeNull();
    expect(android.points[0].state).toBe('no-baseline');
    expect(win.flaggedCount).toBe(1);
  });

  it('writes the byte-identical note the cook gate writes — one rule, one implementation', () => {
    const model = buildSizeTrendModel(MIXED, DEFAULTS);
    const third = model.series.find((s) => s.platform === 'Win64')!.points[1];
    const gate = budgets.evaluateBuildSize('Win64', 3.4 * GB, 3.0 * GB, DEFAULTS, {
      buildId: 1, projectId: P, sizeBytes: 3.0 * GB, version: '0.1.1', createdAt: '2026-09-01 10:00:00',
    });
    expect(gate).not.toBeNull();
    expect(third.verdict?.note).toBe(gate!.note);
    // size-budgets re-exports the pure half; it does not carry a second copy.
    expect(budgets.describeSizeBaseline).toBe(verdict.describeSizeBaseline);
    expect(budgets.getDefaultBudgets).toBe(verdict.getDefaultBudgets);
    expect(budgets.extractRegressionNote).toBe(verdict.extractRegressionNote);
    // …and the pure half is client-safe: no DB, no settings I/O.
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/packaging/size-verdict.ts'), 'utf8');
    expect(src).not.toMatch(/@\/lib\/db|settings-blob|better-sqlite3/);
  });
});

describe('what-if', () => {
  it('previews how many builds a candidate budget would flag, without any fetch', () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const series = [pt(11, 'Win64', 3.8), pt(12, 'Win64', 4.1), pt(13, 'Win64', 4.3)];
    const tight = whatIf(series, { Win64: { budgetBytes: 4 * GB, growthPercent: 0 } });
    expect(tight.flagged).toBe(2);
    expect(tight.total).toBe(3);
    const loose = whatIf(series, { Win64: { budgetBytes: 5 * GB, growthPercent: 0 } });
    expect(loose.flagged).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
