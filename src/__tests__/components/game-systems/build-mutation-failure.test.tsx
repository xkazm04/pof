/**
 * A failed record / delete / bump / save-profile / delete-profile action may not be
 * silent. Each handler used to catch the apiFetch error into console.error only, so a
 * locked DB left the form open (or the row in place) with no message at all
 * (law: failure-not-empty-success).
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

const res = (ok: boolean, body: unknown) => Promise.resolve({
  ok,
  status: ok ? 200 : 500,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

const BUILD = {
  id: 7, projectId: '', platform: 'Win64', config: 'Shipping', status: 'success',
  sizeBytes: 1000, durationMs: 1000, version: '0.1.0', outputPath: null, errorSummary: null,
  cookTimeMs: null, warningCount: 0, errorCount: 0, notes: null, createdAt: '2026-01-01T00:00:00Z',
};

/** Reads succeed with `data`; every non-GET fails with the same reason. */
function mutationsFail(data: unknown) {
  const f = vi.fn().mockImplementation((_url: string, init?: RequestInit) => (
    (init?.method ?? 'GET') === 'GET'
      ? res(true, { success: true, data })
      : res(false, { success: false, error: 'database is locked' })
  ));
  globalThis.fetch = f as unknown as typeof fetch;
  return f;
}

const dashboardData = {
  builds: [BUILD],
  stats: {
    totalBuilds: 1, successCount: 1, failedCount: 0, decidedBuilds: 1, cancelledCount: 0,
    successRate: 100, avgDurationMs: 1000, avgSizeBytes: 1000, latestVersion: '0.1.0', platforms: [],
  },
  trend: [], version: '0.1.0', nextVersion: '0.1.1',
};

/** Deletes ask first; confirm the dialog so the failing DELETE is actually sent. */
async function confirmDelete() {
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
}

async function alertText() {
  const alert = await screen.findByRole('alert');
  return alert.textContent ?? '';
}

describe('BuildHistoryDashboard mutation failures', () => {
  it('Record: failed POST says why', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mutationsFail(dashboardData);
    render(<BuildHistoryDashboard />);
    await screen.findByText('#7');
    fireEvent.click(screen.getByText('Record'));
    fireEvent.click(screen.getByRole('button', { name: 'Record Build' }));
    expect(await alertText()).toMatch(/database is locked/);
  });

  it('Delete: failed DELETE says why', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mutationsFail(dashboardData);
    render(<BuildHistoryDashboard />);
    fireEvent.click(await screen.findByText('#7'));
    fireEvent.click(await screen.findByText('Delete'));
    await confirmDelete();
    expect(await alertText()).toMatch(/database is locked/);
  });

  it('Bump: failed POST says why, and Retry re-sends it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = mutationsFail(dashboardData);
    render(<BuildHistoryDashboard />);
    await screen.findByText('#7');
    fireEvent.click(screen.getByRole('button', { name: 'patch' }));
    expect(await alertText()).toMatch(/database is locked/);
    const posts = () => f.mock.calls.filter((c) => c[1]?.method === 'POST').length;
    const before = posts();
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(posts()).toBeGreaterThan(before));
  });
});

const profile = { ...createDefaultProfile('Win64'), id: 'p1', createdAt: 'x', updatedAt: 'x' };

async function openCard() {
  const pkg = await screen.findByText('Package');
  const toggle = pkg.closest('button')!.nextElementSibling as HTMLElement;
  fireEvent.click(toggle);
}

describe('BuildConfigSelector mutation failures', () => {
  it('Save Profile: failed POST says why', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mutationsFail({ profiles: [profile] });
    render(<BuildConfigSelector />);
    await openCard();
    fireEvent.click(await screen.findByText('Edit'));
    fireEvent.click(await screen.findByText('Save Profile'));
    expect(await alertText()).toMatch(/database is locked/);
  });

  it('Delete profile: failed DELETE says why', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mutationsFail({ profiles: [profile] });
    render(<BuildConfigSelector />);
    await openCard();
    fireEvent.click(await screen.findByText('Delete'));
    await confirmDelete();
    expect(await alertText()).toMatch(/database is locked/);
  });
});
