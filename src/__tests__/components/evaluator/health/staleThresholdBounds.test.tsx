/** The threshold input enforces the range it advertises and has a name. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { StaleReviewsPanel } from '@/components/modules/evaluator/AggregateQualityDashboard/StaleReviewsPanel';

afterEach(cleanup);

describe('stale threshold input', () => {
  it('is labelled and clamps typed values to its max', () => {
    const setCustomStaleDays = vi.fn();
    render(
      <StaleReviewsPanel
        staleModules={[]} customStaleDays={7} setCustomStaleDays={setCustomStaleDays} handleBatchReview={vi.fn()}
        isBatchReviewing={false} reviewError={null} setSelectedModule={vi.fn()}
      />,
    );
    const input = screen.getByRole('spinbutton', { name: 'Stale threshold in days' });
    fireEvent.change(input, { target: { value: '500' } });
    expect(setCustomStaleDays).toHaveBeenCalledWith(90);
  });
});
