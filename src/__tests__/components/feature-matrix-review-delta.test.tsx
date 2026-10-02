/**
 * The Feature Matrix states what the last review MOVED: a ReviewDeltaStrip
 * ("Since last review: 1 regressed, 0 improved") lists each regression as
 * "<feature>: <from> -> <to>", its "Show changed" action filters the matrix to
 * the changed rows, and a regressed row carries a "was <from>" badge beside its
 * existing actions. A delta that was not measured never renders as "no change".
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { mockFetchRoutes } from '../setup';

afterEach(cleanup);

const h = vi.hoisted(() => ({ useFeatureMatrix: vi.fn() }));
vi.mock('@/hooks/useFeatureMatrix', () => ({ useFeatureMatrix: h.useFeatureMatrix }));

import { FeatureMatrix } from '@/components/modules/shared/FeatureMatrix';
import { ReviewDeltaStrip } from '@/components/modules/shared/FeatureMatrix/ReviewDeltaStrip';

const MODULE = 'arpg-combat' as SubModuleId;

const feature = (id: number, featureName: string, status: FeatureStatus): FeatureRow => ({
  id,
  moduleId: MODULE,
  featureName,
  category: 'Core',
  status,
  description: `${featureName} desc`,
  filePaths: [],
  reviewNotes: '',
  qualityScore: 3,
  nextSteps: '',
  lastReviewedAt: '2026-09-02T00:00:00.000Z',
  source: 'review',
});

const FEATURES = [feature(1, 'Dodge roll', 'partial'), feature(2, 'Parry', 'implemented'), feature(3, 'Block', 'missing')];

const DELTA = {
  measured: true as const,
  fromReviewedAt: '2026-09-01T00:00:00.000Z',
  toReviewedAt: '2026-09-02T00:00:00.000Z',
  regressed: [{ featureName: 'Dodge roll', from: 'implemented' as const, to: 'partial' as const }],
  improved: [],
  qualityDropped: [],
  qualityRaised: [],
  assessed: [],
  cleared: [],
  added: [],
  removed: [],
};

function renderMatrix(delta: unknown) {
  mockFetchRoutes([
    { match: '/api/feature-matrix/history', response: { body: { success: true, data: { snapshots: [], projectId: '', delta } } } },
  ]);
  h.useFeatureMatrix.mockReturnValue({
    features: FEATURES,
    summary: { total: 3, implemented: 1, improved: 0, partial: 1, missing: 1, unknown: 0 },
    isLoading: false,
    error: null,
    retry: vi.fn(),
    refetch: vi.fn(),
    isVerifying: false,
    verificationResults: [],
  });
  return render(<FeatureMatrix moduleId={MODULE} accentColor={STATUS_SUCCESS} onReview={() => {}} isReviewing={false} />);
}

const rowNames = () =>
  screen.queryAllByTestId(/^pof-feature-matrix-row-/).map((el) => el.getAttribute('data-testid'));

describe('ReviewDeltaStrip in the Feature Matrix', () => {
  it('lists the regression and "Show changed" filters the matrix to the changed rows', async () => {
    renderMatrix(DELTA);
    const strip = await screen.findByTestId('pof-review-delta-strip');
    expect(strip.textContent).toContain('1 regressed, 0 improved');
    expect(within(strip).getByText('Dodge roll: implemented -> partial')).toBeTruthy();
    expect(rowNames()).toHaveLength(3);

    fireEvent.click(within(strip).getByRole('button', { name: /show changed/i }));
    await waitFor(() => expect(rowNames()).toEqual(['pof-feature-matrix-row-dodge-roll']));
  });

  it('a regressed row carries a "was implemented" badge; an unchanged row does not', async () => {
    renderMatrix(DELTA);
    await screen.findByTestId('pof-review-delta-strip');
    const dodge = screen.getByTestId('pof-feature-matrix-row-dodge-roll');
    expect(within(dodge).getByText('was implemented')).toBeTruthy();
    const parry = screen.getByTestId('pof-feature-matrix-row-parry');
    expect(within(parry).queryByText(/^was /)).toBeNull();
  });

  it('an unmeasured delta between two snapshots states its reason and offers no filter', () => {
    render(
      <ReviewDeltaStrip
        delta={{ measured: false, reason: 'The previous snapshot predates per-feature capture.', fromReviewedAt: 'a', toReviewedAt: 'b' }}
        changedOnly={false}
        onToggleChanged={() => {}}
      />,
    );
    const strip = screen.getByTestId('pof-review-delta-strip');
    expect(strip.textContent).toContain('predates');
    expect(strip.textContent).not.toContain('0 regressed');
    expect(within(strip).queryByRole('button')).toBeNull();
  });
});
