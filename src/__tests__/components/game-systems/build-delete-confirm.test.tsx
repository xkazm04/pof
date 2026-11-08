/**
 * Deleting a recorded build or a build profile asks first.
 *
 * Both Delete buttons sent the DELETE on the first click: a build row is the size-trend
 * and version authority, and a profile is a whole cook configuration, with no undo.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';

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

const res = (body: unknown) => Promise.resolve({
  ok: true, status: 200,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

function okFetch(data: unknown) {
  const f = vi.fn().mockImplementation(() => res({ success: true, data }));
  globalThis.fetch = f as unknown as typeof fetch;
  return f;
}
const deletes = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter((c) => c[1]?.method === 'DELETE').length;

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

describe('delete asks first', () => {
  it('build row: no DELETE until the dialog is confirmed', async () => {
    const f = okFetch(dashboardData);
    render(<BuildHistoryDashboard />);
    fireEvent.click(await screen.findByText('#7'));
    fireEvent.click(await screen.findByText('Delete'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent ?? '').toContain('#7');
    expect(deletes(f)).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deletes(f)).toBe(1));
  });

  it('build row: Cancel sends nothing', async () => {
    const f = okFetch(dashboardData);
    render(<BuildHistoryDashboard />);
    fireEvent.click(await screen.findByText('#7'));
    fireEvent.click(await screen.findByText('Delete'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(deletes(f)).toBe(0);
  });

  it('profile card: no DELETE until the dialog is confirmed', async () => {
    const f = okFetch({ profiles: [profile] });
    render(<BuildConfigSelector />);
    const pkg = await screen.findByText('Package');
    fireEvent.click(pkg.closest('button')!.nextElementSibling as HTMLElement);
    fireEvent.click(await screen.findByText('Delete'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent ?? '').toContain(profile.name);
    expect(deletes(f)).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deletes(f)).toBe(1));
  });
});
