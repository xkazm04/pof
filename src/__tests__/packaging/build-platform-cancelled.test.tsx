/**
 * A platform whose only cooks were cancelled has decided nothing: its card may not
 * paint a red 0% (the top-level Metrics row already says "-" for the same case).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
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

import { insertBuild, getBuildStats } from '@/lib/packaging/build-history-store';
import { PlatformBreakdown } from '@/components/modules/game-systems/BuildHistoryDashboard/PlatformBreakdown';

afterEach(cleanup);

const PROJECT = 'C:/Users/kazda/Documents/Unreal Projects/PoF';

beforeEach(() => {
  testDb.exec('DELETE FROM build_history');
});

function seed(platform: string, statuses: Array<'success' | 'failed' | 'cancelled'>) {
  for (const status of statuses) insertBuild({ projectId: PROJECT, platform, config: 'Shipping', status });
}

describe('PlatformBreakdown with a cancelled-only platform', () => {
  it('the store reports decided and cancelled per platform', () => {
    seed('Win64', ['success', 'failed', 'cancelled']);
    seed('Linux', ['cancelled', 'cancelled']);
    const byName = Object.fromEntries(getBuildStats(PROJECT).platforms.map((p) => [p.platform, p]));
    expect(byName.Win64.decided).toBe(2);
    expect(byName.Win64.cancelled).toBe(1);
    expect(byName.Linux.decided).toBe(0);
    expect(byName.Linux.cancelled).toBe(2);
  });

  it('renders "-" and the cancelled count, never 0%', () => {
    seed('Linux', ['cancelled', 'cancelled']);
    const { container } = render(<PlatformBreakdown stats={getBuildStats(PROJECT)} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b0%/);
    expect(text).toContain('-');
    expect(text).toContain('2 cancelled');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('a platform that decided something keeps its percentage', () => {
    seed('Win64', ['success', 'failed', 'cancelled']);
    const { container } = render(<PlatformBreakdown stats={getBuildStats(PROJECT)} />);
    expect(container.textContent ?? '').toContain('50%');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
  });
});
