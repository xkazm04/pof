/**
 * The build dashboard's toggles, sort headers and icon-only buttons expose a name and
 * state: expand toggles carry aria-expanded, the sort headers are column headers that
 * announce aria-sort, and the two refresh buttons are named.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/modules/game-systems/CookProgress', () => ({ CookProgress: () => null }));
vi.mock('@/components/modules/game-systems/SmokeTest', () => ({ SmokeTest: () => null }));
vi.mock('@/components/modules/game-systems/NightlyBuildScheduler', () => ({ NightlyBuildScheduler: () => null }));
vi.mock('@/components/modules/game-systems/GateNotifySettings', () => ({ GateNotifySettings: () => null }));
vi.mock('@/components/modules/game-systems/PreflightPanel', () => ({ PreflightPanel: () => null }));

import { BuildHistoryDashboard } from '@/components/modules/game-systems/BuildHistoryDashboard';
import { BuildConfigSelector } from '@/components/modules/game-systems/BuildConfigSelector';
import { createDefaultProfile } from '@/lib/packaging/build-profiles';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function serve(data: unknown) {
  const body = { success: true, data };
  globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })) as unknown as typeof fetch;
}

const BUILD = {
  id: 7, projectId: '', platform: 'Win64', config: 'Shipping', status: 'success',
  sizeBytes: 1000, durationMs: 1000, version: '0.1.0', outputPath: null, errorSummary: null,
  cookTimeMs: null, warningCount: 0, errorCount: 0, notes: null, createdAt: '2026-01-01T00:00:00Z',
};
const dashboardData = {
  builds: [BUILD],
  stats: {
    totalBuilds: 1, successCount: 1, failedCount: 0, decidedBuilds: 1, cancelledCount: 0,
    successRate: 100, avgDurationMs: 1000, avgSizeBytes: 1000, latestVersion: '0.1.0', platforms: [],
  },
  trend: [], version: '0.1.0', nextVersion: '0.1.1',
};
const profile = { ...createDefaultProfile('Win64'), id: 'p1', createdAt: 'x', updatedAt: 'x' };

describe('BuildHistoryDashboard controls', () => {
  it('the build row toggle exposes aria-expanded', async () => {
    serve(dashboardData);
    render(<BuildHistoryDashboard />);
    const row = (await screen.findByText('#7')).closest('button')!;
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });

  it('all five sort headers are column headers with aria-sort, the active one directional', async () => {
    serve(dashboardData);
    render(<BuildHistoryDashboard />);
    await screen.findByText('#7');
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(5);
    const sorts = headers.map((h) => h.getAttribute('aria-sort'));
    expect(sorts.filter((s) => s === 'descending').length).toBe(1);
    expect(sorts.filter((s) => s === 'none').length).toBe(4);
    fireEvent.click(screen.getByRole('button', { name: 'Size' }));
    expect(screen.getByRole('columnheader', { name: 'Size' }).getAttribute('aria-sort')).toBe('ascending');
  });

  it('the refresh button is named', async () => {
    serve(dashboardData);
    render(<BuildHistoryDashboard />);
    await screen.findByText('#7');
    expect(screen.getByRole('button', { name: /refresh/i })).toBeTruthy();
  });
});

describe('BuildConfigSelector controls', () => {
  it('the profile card toggle is named and exposes aria-expanded', async () => {
    serve({ profiles: [profile] });
    render(<BuildConfigSelector />);
    const toggle = await screen.findByRole('button', { name: /expand/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    const open = screen.getByRole('button', { name: /collapse/i });
    expect(open.getAttribute('aria-expanded')).toBe('true');
  });

  it('the refresh button is named', async () => {
    serve({ profiles: [profile] });
    render(<BuildConfigSelector />);
    await screen.findByText('Package');
    expect(screen.getByRole('button', { name: /refresh/i })).toBeTruthy();
  });
});
