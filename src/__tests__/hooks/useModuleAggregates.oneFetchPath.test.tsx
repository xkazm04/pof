/**
 * ONE fetch path for `/api/feature-matrix/aggregate`.
 *
 * THREE consumers read that per-module roll-up — the Aggregate Quality
 * dashboard, the Cross-Module Feature dashboard and the Unified Summary — and
 * each used to hand-roll its own fetch. Opening the Evaluator therefore ran the
 * roll-up query once per mounted dashboard, and because nothing tied their
 * refreshes together the three could show different numbers for a whole TTL
 * window. These tests pin the contract:
 *
 *  1. N simultaneous consumer mounts ⇒ exactly ONE aggregate request within the TTL.
 *  2. One invalidation refetches for EVERY live consumer, not just the caller,
 *     and `invalidateFeatureData()` moves the statuses cache with it (an
 *     aggregate is derived from the same rows).
 *  3. A failed load is never dressed up as data: each consumer surfaces the
 *     reason instead of an all-"unknown" heatmap / a "no evaluation data yet"
 *     empty state that reads as a healthy-but-unreviewed project.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import {
  useModuleAggregates,
  invalidateModuleAggregates,
  invalidateFeatureData,
} from '@/hooks/useModuleAggregates';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useUnifiedSummaryView } from '@/components/modules/evaluator/UnifiedSummaryView/useUnifiedSummaryView';
import { useCrossModuleFeatureDashboard } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/useCrossModuleFeatureDashboard';
import { CrossModuleFeatureDashboard } from '@/components/modules/evaluator/CrossModuleFeatureDashboard';
import { UnifiedSummaryView } from '@/components/modules/evaluator/UnifiedSummaryView';
import { AggregateQualityDashboard } from '@/components/modules/evaluator/AggregateQualityDashboard';

const MODULES = [
  { moduleId: 'arpg-character', total: 4, implemented: 2, improved: 0, partial: 1, missing: 1, unknown: 0, avgQuality: 3.5, lastReviewedAt: '2026-08-18T00:00:00.000Z' },
  { moduleId: 'arpg-combat', total: 3, implemented: 3, improved: 0, partial: 0, missing: 0, unknown: 0, avgQuality: 4.2, lastReviewedAt: '2026-08-18T00:00:00.000Z' },
];

const OK_AGGREGATE = { body: { success: true, data: { modules: MODULES } } };
const FAILING_AGGREGATE = { body: { success: false, error: 'feature_matrix aggregate query failed' } };

function installRoutes(aggregateResponse: Parameters<typeof mockFetchRoutes>[0][number]['response']) {
  return mockFetchRoutes([
    { match: '/api/feature-matrix/aggregate', response: aggregateResponse },
    { match: '/api/feature-matrix/history', response: { body: { success: true, data: { history: {} } } } },
    { match: '/api/feature-matrix/all-statuses', response: { body: { success: true, data: { statuses: [] } } } },
    { match: '/api/session-analytics', response: { body: { success: true, data: { totalSessions: 0 } } } },
  ]);
}

function callsTo(mock: ReturnType<typeof mockFetchRoutes>, fragment: string): number {
  return mock.mock.calls.filter((c) => String(c[0]).includes(fragment)).length;
}
const aggregateCalls = (m: ReturnType<typeof mockFetchRoutes>) => callsTo(m, 'feature-matrix/aggregate');

function UnifiedProbe() { useUnifiedSummaryView(); return <span data-testid="p1" />; }
function CrossModuleProbe() { useCrossModuleFeatureDashboard(); return <span data-testid="p2" />; }
function DirectProbe() {
  const { aggregates, loaded } = useModuleAggregates();
  return <span data-testid="p3">{loaded ? aggregates.length : -1}</span>;
}

function AllConsumers() {
  return (
    <>
      <UnifiedProbe />
      <CrossModuleProbe />
      <DirectProbe />
      <AggregateQualityDashboard />
    </>
  );
}

beforeEach(() => {
  // Module-level caches survive remounts by design — reset both between tests so
  // each case starts cold.
  invalidateFeatureData();
});
afterEach(cleanup);

describe('useModuleAggregates — one fetch path', () => {
  it('serves 4 simultaneous consumer mounts with a single aggregate request', async () => {
    const fetchMock = installRoutes(OK_AGGREGATE);

    render(<AllConsumers />);

    await waitFor(() => expect(screen.getByTestId('p3').textContent).toBe(String(MODULES.length)));
    // ...and give any stray per-consumer fetch a chance to fire before asserting.
    await waitFor(() => expect(aggregateCalls(fetchMock)).toBeGreaterThan(0));

    expect(aggregateCalls(fetchMock)).toBe(1);
  });

  it('every live consumer refetches when the aggregate cache is invalidated', async () => {
    const fetchMock = installRoutes(OK_AGGREGATE);
    render(<AllConsumers />);
    await waitFor(() => expect(aggregateCalls(fetchMock)).toBe(1));

    await act(async () => { invalidateModuleAggregates(); });

    // Exactly one more request — shared by all four subscribers, not one each.
    await waitFor(() => expect(aggregateCalls(fetchMock)).toBe(2));
    expect(aggregateCalls(fetchMock)).toBe(2);
  });

  it('invalidateFeatureData() moves BOTH derived caches (statuses + aggregates)', async () => {
    const fetchMock = installRoutes(OK_AGGREGATE);
    render(<AllConsumers />);
    await waitFor(() => expect(aggregateCalls(fetchMock)).toBe(1));
    await waitFor(() => expect(callsTo(fetchMock, 'all-statuses')).toBe(1));

    await act(async () => { invalidateFeatureData(); });

    await waitFor(() => expect(aggregateCalls(fetchMock)).toBe(2));
    await waitFor(() => expect(callsTo(fetchMock, 'all-statuses')).toBe(2));
  });

  it('reuses the cached payload for a consumer mounting within the TTL', async () => {
    const fetchMock = installRoutes(OK_AGGREGATE);
    render(<DirectProbe />);
    await waitFor(() => expect(aggregateCalls(fetchMock)).toBe(1));

    render(<DirectProbe />);
    await waitFor(() => expect(screen.getAllByTestId('p3').length).toBe(2));
    expect(aggregateCalls(fetchMock)).toBe(1);
  });

  it('a load started before an invalidation is never seated as the cache', async () => {
    // Generation guard: the pre-mutation read must not win over the newer one.
    installRoutes(OK_AGGREGATE);
    render(<DirectProbe />);
    await waitFor(() => expect(screen.getByTestId('p3').textContent).toBe('2'));

    // The row set changes and the caller invalidates while a stale read is open.
    installRoutes({ body: { success: true, data: { modules: [MODULES[0]] } } });
    await act(async () => { invalidateModuleAggregates(); });

    await waitFor(() => expect(screen.getByTestId('p3').textContent).toBe('1'));
  });
});

describe('a failed aggregate load is never a silent empty summary', () => {
  it('CrossModuleFeatureDashboard renders the reason instead of an all-unknown heatmap', async () => {
    installRoutes(FAILING_AGGREGATE);
    render(<CrossModuleFeatureDashboard />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/feature_matrix aggregate query failed/);
    expect(alert.textContent).toMatch(/Retry/);
    // The lie this targets: a project-wide "0%" summary built from nothing.
    expect(screen.queryByText(/Overall Completion/i)).toBeNull();
  });

  it('CrossModuleFeatureDashboard Retry re-requests the aggregate', async () => {
    const fetchMock = installRoutes(FAILING_AGGREGATE);
    render(<CrossModuleFeatureDashboard />);
    await screen.findByRole('alert');
    expect(aggregateCalls(fetchMock)).toBe(1);

    installRoutes(OK_AGGREGATE);
    const retry = screen.getByRole('button', { name: /retry/i });
    await act(async () => { retry.click(); });

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('UnifiedSummaryView reports the failure instead of "No Evaluation Data Yet"', async () => {
    installRoutes(FAILING_AGGREGATE);
    render(<UnifiedSummaryView onNavigateTab={() => {}} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/feature_matrix aggregate query failed/);
    // With zero live sources the view used to claim the project simply had no
    // evaluation data — indistinguishable from a healthy, unreviewed project.
    expect(screen.queryByText(/No Evaluation Data Yet/i)).toBeNull();
  });

  it('AggregateQualityDashboard renders its error state, not an unreviewed heatmap', async () => {
    installRoutes(FAILING_AGGREGATE);
    render(<AggregateQualityDashboard />);

    const heading = await screen.findByText(/Couldn't load quality data/i);
    expect(heading).toBeTruthy();
    expect(screen.getByText(/feature_matrix aggregate query failed/)).toBeTruthy();
  });
});

describe('the shared cache does not leak across the two endpoints', () => {
  it('invalidating statuses alone leaves the aggregate cache intact', async () => {
    const fetchMock = installRoutes(OK_AGGREGATE);
    render(<DirectProbe />);
    await waitFor(() => expect(aggregateCalls(fetchMock)).toBe(1));

    await act(async () => { invalidateFeatureStatuses(); });
    await new Promise((r) => setTimeout(r, 0));

    // Only the composed invalidator is meant to move both; this proves the two
    // caches are genuinely separate rather than accidentally coupled.
    expect(aggregateCalls(fetchMock)).toBe(1);
  });
});
