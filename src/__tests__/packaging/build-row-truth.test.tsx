/**
 * A build row may not claim a state nobody wrote.
 *
 * Four `BuildRecord` fields were rendered as if measured and written by nobody on the
 * real cook paths:
 *  - `version` was stamped ONLY by the manual Record form, so every cooked build was
 *    `version: null` under a Version card showing a counter no build was produced at.
 *  - `warning_count` / `error_count` have zero production writers, yet `BuildComparison`
 *    rendered a Warnings row — a permanent `0 vs 0 · same` presented as a comparison.
 *  - a `cancelled` build rendered a clock labelled "Build in progress" — forever, as the
 *    `else` branch of a `'success' | 'failed' | 'cancelled'` union.
 *  - `getBuildStats` counted cancelled rows in the `successRate` denominator while
 *    excluding them from `failedCount`, so `100 - successRate` overstated failures.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
testDb.exec(`
  CREATE TABLE IF NOT EXISTS build_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL,
    config TEXT NOT NULL,
    status TEXT NOT NULL,
    size_bytes INTEGER,
    duration_ms INTEGER,
    version TEXT,
    output_path TEXT,
    error_summary TEXT,
    cook_time_ms INTEGER,
    warning_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return { ...actual, getDb: () => testDb };
});

import { insertBuild, getBuildStats, type BuildRecord } from '@/lib/packaging/build-history-store';
import { BuildRow } from '@/components/modules/game-systems/BuildHistoryDashboard/BuildRow';
import { BuildComparison } from '@/components/modules/game-systems/BuildComparison';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const PROJECT = 'C:/Users/kazda/Documents/Unreal Projects/PoF';

beforeEach(() => {
  testDb.exec('DELETE FROM build_history');
});

function record(over: Partial<BuildRecord> = {}): BuildRecord {
  return {
    id: 1,
    projectId: PROJECT.toLowerCase(),
    platform: 'Win64',
    config: 'Shipping',
    status: 'success',
    sizeBytes: 1024,
    durationMs: 1000,
    version: null,
    outputPath: null,
    errorSummary: null,
    cookTimeMs: null,
    warningCount: 0,
    errorCount: 0,
    notes: null,
    createdAt: '2026-08-19T00:00:00.000Z',
    ...over,
  };
}

describe('a cancelled build says cancelled', () => {
  it('does NOT render "Build in progress" — build_history holds only terminal rows', () => {
    render(<BuildRow build={record({ status: 'cancelled' })} onDelete={() => {}} />);
    expect(screen.queryByLabelText('Build in progress')).toBeNull();
    expect(screen.getByLabelText('Build cancelled')).toBeTruthy();
  });

  it('carries the WORD too, not just a different glyph', () => {
    const { container } = render(<BuildRow build={record({ status: 'cancelled' })} onDelete={() => {}} />);
    expect((container.textContent ?? '').toLowerCase()).toContain('cancelled');
  });

  it('leaves success and failure rows exactly as they were', () => {
    const { unmount } = render(<BuildRow build={record({ status: 'success' })} onDelete={() => {}} />);
    expect(screen.getByLabelText('Build succeeded')).toBeTruthy();
    expect(screen.queryByLabelText('Build cancelled')).toBeNull();
    unmount();
    render(<BuildRow build={record({ status: 'failed' })} onDelete={() => {}} />);
    expect(screen.getByLabelText('Build failed')).toBeTruthy();
  });
});

describe('getBuildStats keeps cancelled out of the success/failure split', () => {
  function seed(statuses: BuildRecord['status'][]): void {
    for (const status of statuses) {
      insertBuild({ projectId: PROJECT, platform: 'Win64', config: 'Shipping', status });
    }
  }

  it('reports cancelled SEPARATELY and excludes it from the rate denominator', () => {
    // 3 green, 1 red, 2 aborted. The honest rate is 3/4 = 75%, not 3/6 = 50%.
    seed(['success', 'success', 'success', 'failed', 'cancelled', 'cancelled']);
    const stats = getBuildStats(PROJECT);
    expect(stats.totalBuilds).toBe(6);
    expect(stats.successCount).toBe(3);
    expect(stats.failedCount).toBe(1);
    expect(stats.cancelledCount).toBe(2);
    expect(stats.decidedBuilds).toBe(4);
    expect(stats.successRate).toBeCloseTo(75, 5);
    // The Failed card's sub-label is `100 - successRate`; it must equal the real
    // failure share of decided builds (1/4), never 50% because two runs were aborted.
    expect(100 - stats.successRate).toBeCloseTo(25, 5);
  });

  it('applies the same rule per platform', () => {
    seed(['success', 'cancelled']);
    const stats = getBuildStats(PROJECT);
    const win = stats.platforms.find((p) => p.platform === 'Win64')!;
    expect(win.total).toBe(2);
    expect(win.successRate).toBeCloseTo(100, 5);
  });

  it('reports 0% rather than dividing by zero when every build was cancelled', () => {
    seed(['cancelled', 'cancelled']);
    const stats = getBuildStats(PROJECT);
    expect(stats.decidedBuilds).toBe(0);
    expect(stats.successRate).toBe(0);
    expect(stats.cancelledCount).toBe(2);
  });
});

describe('BuildComparison does not fabricate a warnings delta', () => {
  const a = record({ id: 1, createdAt: '2026-08-18T00:00:00.000Z' });
  const b = record({ id: 2, sizeBytes: 2048, createdAt: '2026-08-19T00:00:00.000Z' });

  it('states that warnings are unrecorded instead of rendering "0 vs 0 · same"', () => {
    render(<BuildComparison builds={[b, a]} />);
    const note = screen.getByTestId('build-comparison-warnings-unrecorded');
    expect((note.textContent ?? '')).toMatch(/not recorded/i);
    expect((note.textContent ?? '')).toMatch(/no cook path writes these counts/i);
    // And no delta badge claiming the warnings metric.
    expect(screen.queryByLabelText(/^Warnings (increased|decreased)/)).toBeNull();
  });

  it('renders the real comparison when a build actually carries counts', () => {
    render(<BuildComparison builds={[record({ id: 2, warningCount: 7, createdAt: '2026-08-19T00:00:00.000Z' }), a]} />);
    expect(screen.queryByTestId('build-comparison-warnings-unrecorded')).toBeNull();
    expect(screen.getByLabelText(/Warnings increased by 7/)).toBeTruthy();
  });

  it('still renders the metrics that ARE measured', () => {
    // Preserved-behaviour pin: green before and after. Size/Duration/Status/Version/
    // Config rows are untouched by this change.
    const { container } = render(<BuildComparison builds={[b, a]} />);
    const text = container.textContent ?? '';
    for (const label of ['STATUS', 'SIZE', 'DURATION', 'VERSION', 'CONFIG']) {
      expect(text.toUpperCase()).toContain(label);
    }
  });
});
