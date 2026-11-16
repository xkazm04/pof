/**
 * scan-sweep night 2026-11-08 (module-topology-graph): a failed all-statuses read must
 * not fall through to the Nexus map. buildModuleTopology places every module from the
 * feature DEFINITIONS, so an empty status map paints all 34 modules as "0/N" — which
 * reads as "nothing implemented", not "nothing loaded". DependencyGraph and
 * FeatureConstellation already say what broke (InlineErrorRetry); Nexus must too.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false, isLoading: false, error: null, refresh: async () => {} }),
}));

import { NexusView } from '@/components/modules/evaluator/NexusView';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';

const ok = (data: unknown) => ({ body: { success: true, data } });

function routes(statusesFail: boolean) {
  return mockFetchRoutes([
    {
      match: '/api/feature-matrix/all-statuses',
      response: statusesFail
        ? { body: { success: false, error: 'matrix db locked' }, status: 500 }
        : ok({ statuses: [{ moduleId: 'arpg-combat', featureName: 'core', status: 'implemented' }] }),
    },
    { match: '/api/pattern-library', response: ok({ patterns: [] }) },
    { match: '/api/evaluator/results', response: ok({ scans: [] }) },
    { match: '/api/session-analytics', response: ok({ totalSessions: 0, moduleStats: [] }) },
  ]);
}

const allStatusCalls = (m: ReturnType<typeof mockFetchRoutes>) =>
  m.mock.calls.filter((c) => String(c[0]).includes('/api/feature-matrix/all-statuses')).length;

beforeEach(() => invalidateFeatureStatuses());
afterEach(cleanup);

describe('NexusView — a failed status read is an error, never an unlit map', () => {
  it('shows the failure with Retry and draws no module nodes', async () => {
    const fetchMock = routes(true);
    const { container } = render(<NexusView />);

    expect(await screen.findByText(/Could not load feature statuses: .*matrix db locked/)).toBeTruthy();
    expect(container.querySelector('svg[width="100%"]')).toBeNull();
    expect(screen.queryByText(/Nexus Intelligence Map/)).toBeTruthy();

    const before = allStatusCalls(fetchMock);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(allStatusCalls(fetchMock)).toBeGreaterThan(before));
  });

  it('control: a successful read still draws the map', async () => {
    routes(false);
    const { container } = render(<NexusView />);
    await waitFor(() => expect(container.querySelector('svg[width="100%"]')).not.toBeNull());
    expect(screen.queryByText(/Could not load feature statuses/)).toBeNull();
  });

  it('the first-load spinner announces itself', () => {
    routes(false);
    render(<NexusView />);
    const status = screen.getByRole('status');
    expect(status.textContent ?? '').toMatch(/loading/i);
  });
});
