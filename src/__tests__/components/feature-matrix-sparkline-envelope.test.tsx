/**
 * The per-module quality sparkline reads `/api/feature-matrix/history`, which answers
 * in the standard `{ success, data }` envelope — but the matrix took `snapshots` off
 * the ENVELOPE (`json.snapshots`, always `undefined`) rather than off `json.data`.
 * The list was therefore permanently empty and the sparkline, gated on
 * `snapshots.length >= 2`, has never rendered in this view at all. (Same class as the
 * all-statuses envelope mismatch.)
 *
 * RED before this change: no `<svg>` trend line, whatever the route returned.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import type { ReviewSnapshot } from '@/lib/feature-matrix-db';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { mockFetchRoutes } from '../setup';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const h = vi.hoisted(() => ({ useFeatureMatrix: vi.fn() }));
vi.mock('@/hooks/useFeatureMatrix', () => ({ useFeatureMatrix: h.useFeatureMatrix }));

import { FeatureMatrix } from '@/components/modules/shared/FeatureMatrix';

const MODULE = 'arpg-combat' as SubModuleId;

function snapshot(i: number, avgQuality: number): ReviewSnapshot {
  return {
    id: i,
    moduleId: MODULE,
    reviewedAt: `2026-08-${String(10 + i).padStart(2, '0')}T00:00:00.000Z`,
    total: 4,
    implemented: 2,
    improved: 1,
    partial: 1,
    missing: 0,
    unknown: 0,
    avgQuality,
  };
}

const FEATURES: FeatureRow[] = [{
  id: 1,
  moduleId: MODULE,
  featureName: 'Alpha',
  category: 'Core',
  status: 'implemented',
  description: 'a feature',
  filePaths: [],
  reviewNotes: '',
  qualityScore: 4,
  nextSteps: '',
  lastReviewedAt: '2026-08-12T00:00:00.000Z',
  source: 'review',
}];

function renderMatrix(historyBody: unknown) {
  mockFetchRoutes([
    { match: '/api/feature-matrix/history', response: { body: historyBody } },
    { match: '/api/feature-matrix', response: { body: { success: true, data: { features: FEATURES } } } },
  ]);
  h.useFeatureMatrix.mockReturnValue({
    features: FEATURES,
    summary: { total: 1, implemented: 1, improved: 0, partial: 0, missing: 0, unknown: 0 },
    isLoading: false,
    error: null,
    retry: vi.fn(),
    refetch: vi.fn(),
    runAutoVerify: vi.fn(),
    isVerifying: false,
    verificationResults: [],
  });
  return render(
    <FeatureMatrix
      moduleId={MODULE}
      accentColor={STATUS_SUCCESS}
      onReview={() => {}}
      isReviewing={false}
    />,
  );
}

describe('quality sparkline', () => {
  it('renders a trend line from snapshots inside the API envelope', async () => {
    const { container } = renderMatrix({
      success: true,
      data: { snapshots: [snapshot(0, 2.5), snapshot(1, 3.5), snapshot(2, 4)] },
    });

    await waitFor(() => {
      expect(
        container.querySelector('svg path[stroke]'),
        'expected the sparkline path once history loads',
      ).toBeTruthy();
    });
  });

  it('renders nothing rather than a fabricated flat line when history is empty', async () => {
    const { container } = renderMatrix({ success: true, data: { snapshots: [] } });

    // Give the fetch a tick to settle so this cannot pass merely by racing it.
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container.querySelector('svg path[stroke]')).toBeNull();
  });
});
