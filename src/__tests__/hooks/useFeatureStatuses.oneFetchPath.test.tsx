/**
 * ONE fetch path for `/api/feature-matrix/all-statuses`.
 *
 * Seven consumers read that unindexed full-table scan; six of them used to
 * hand-roll their own fetch, so opening the Evaluator ran the same scan once per
 * mounted view and a single `invalidateFeatureStatuses()` refreshed only the one
 * consumer that called it. These tests pin the contract:
 *
 *  1. N simultaneous consumer mounts ⇒ exactly ONE request within the TTL.
 *  2. `invalidateFeatureStatuses()` (the call AW's auto-verify / seed / PATCH
 *     paths make) refetches for EVERY live consumer, not just the caller.
 *  3. A failed load is never dressed up as data: the Constellation renders the
 *     shared InlineErrorRetry surface instead of an all-"unknown" starfield
 *     claiming "0/N lit".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false, isLoading: false, error: null, refresh: async () => {} }),
}));

import { useFeatureStatuses, invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useImplementationPlan } from '@/hooks/useImplementationPlan';
import { useDependencyGraph } from '@/components/modules/evaluator/DependencyGraph/useDependencyGraph';
import { useNexusView } from '@/components/modules/evaluator/NexusView/useNexusView';
import { useUnifiedSummaryView } from '@/components/modules/evaluator/UnifiedSummaryView/useUnifiedSummaryView';
import { useCrossModuleFeatureDashboard } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/useCrossModuleFeatureDashboard';
import { FeatureConstellation } from '@/components/modules/evaluator/FeatureConstellation';

const STATUSES = [
  { moduleId: 'arpg-character', featureName: 'AARPGCharacterBase', status: 'implemented' },
  { moduleId: 'arpg-character', featureName: 'AARPGPlayerCharacter', status: 'partial' },
];

function installRoutes(statusResponse: Parameters<typeof mockFetchRoutes>[0][number]['response']) {
  return mockFetchRoutes([
    { match: '/api/feature-matrix/all-statuses', response: statusResponse },
    { match: '/api/feature-matrix/aggregate', response: { body: { success: true, data: { modules: [] } } } },
    { match: '/api/session-analytics', response: { body: { success: true, data: { totalSessions: 0 } } } },
  ]);
}

const OK_STATUSES = { body: { success: true, data: { statuses: STATUSES } } };

function statusCalls(mock: ReturnType<typeof mockFetchRoutes>): number {
  return mock.mock.calls.filter((c) => String(c[0]).includes('all-statuses')).length;
}

// Each of the six former bypassers, plus the shared hook itself, mounted as one tree.
function ImplementationPlanProbe() { useImplementationPlan(); return <span data-testid="p1" />; }
function DependencyGraphProbe() { useDependencyGraph(); return <span data-testid="p2" />; }
function NexusProbe() { useNexusView(); return <span data-testid="p3" />; }
function UnifiedProbe() { useUnifiedSummaryView(); return <span data-testid="p4" />; }
function CrossModuleProbe() { useCrossModuleFeatureDashboard(); return <span data-testid="p5" />; }
function DirectProbe() {
  const { statusMap, loaded } = useFeatureStatuses();
  return <span data-testid="p6">{loaded ? statusMap.size : -1}</span>;
}

function AllConsumers() {
  return (
    <>
      <ImplementationPlanProbe />
      <DependencyGraphProbe />
      <NexusProbe />
      <UnifiedProbe />
      <CrossModuleProbe />
      <DirectProbe />
      <FeatureConstellation />
    </>
  );
}

beforeEach(() => {
  // Module-level cache survives remounts by design — reset it between tests so
  // each case starts from a cold cache.
  invalidateFeatureStatuses();
});
afterEach(cleanup);

describe('useFeatureStatuses — one fetch path', () => {
  it('serves 7 simultaneous consumer mounts with a single all-statuses request', async () => {
    const fetchMock = installRoutes(OK_STATUSES);

    render(<AllConsumers />);

    await waitFor(() => expect(screen.getByTestId('p6').textContent).toBe(String(STATUSES.length)));
    // ...and give any stray per-consumer fetch a chance to fire before asserting.
    await waitFor(() => expect(screen.getByRole('img', { name: /feature constellation/i })).toBeTruthy());

    expect(statusCalls(fetchMock)).toBe(1);
  });

  it('every live consumer refetches when invalidateFeatureStatuses() fires', async () => {
    const fetchMock = installRoutes(OK_STATUSES);
    render(<AllConsumers />);
    await waitFor(() => expect(statusCalls(fetchMock)).toBe(1));

    // This is the call AW's auto-verify / seed / PATCH paths make.
    await act(async () => { invalidateFeatureStatuses(); });

    // Exactly one more request — shared by all seven subscribers, not one each.
    await waitFor(() => expect(statusCalls(fetchMock)).toBe(2));
    expect(statusCalls(fetchMock)).toBe(2);
  });

  it('reuses the cached payload for a consumer mounting within the TTL', async () => {
    const fetchMock = installRoutes(OK_STATUSES);
    render(<DirectProbe />);
    await waitFor(() => expect(statusCalls(fetchMock)).toBe(1));

    render(<DirectProbe />);
    await waitFor(() => expect(screen.getAllByTestId('p6').length).toBe(2));
    expect(statusCalls(fetchMock)).toBe(1);
  });
});

describe('FeatureConstellation — a failed load is not a dark sky', () => {
  const FAILING = { body: { success: false, error: 'feature_matrix table is locked' } };

  it('renders InlineErrorRetry naming the reason instead of an all-unknown starfield', async () => {
    installRoutes(FAILING);
    render(<FeatureConstellation />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/feature_matrix table is locked/);
    expect(alert.textContent).toMatch(/Retry/);

    // The lie the direction targets: no constellation, and no "0/N lit" claim.
    expect(screen.queryByRole('img', { name: /feature constellation/i })).toBeNull();
    expect(screen.queryByText(/\d+\/\d+ lit/)).toBeNull();
  });

  it('Retry re-requests the statuses and paints the constellation once they load', async () => {
    const fetchMock = installRoutes(FAILING);
    render(<FeatureConstellation />);
    await screen.findByRole('alert');
    expect(statusCalls(fetchMock)).toBe(1);

    // The endpoint recovers; the retry button must actually re-hit it.
    installRoutes(OK_STATUSES);
    const retry = screen.getByRole('button', { name: /retry/i });
    await act(async () => { retry.click(); });

    await waitFor(() => expect(screen.getByRole('img', { name: /feature constellation/i })).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
