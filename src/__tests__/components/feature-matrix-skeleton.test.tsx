import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { SubModuleId } from '@/types/modules';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Force the matrix into its loading state by mocking the data hook.
const h = vi.hoisted(() => ({ useFeatureMatrix: vi.fn() }));
vi.mock('@/hooks/useFeatureMatrix', () => ({ useFeatureMatrix: h.useFeatureMatrix }));

import { FeatureMatrix } from '@/components/modules/shared/FeatureMatrix';

const LOADING_STATE = {
  features: [],
  summary: { total: 0, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0 },
  isLoading: true,
  error: null,
  retry: vi.fn(),
  refetch: vi.fn(),
  runAutoVerify: vi.fn(),
  isVerifying: false,
  verificationResults: [],
};

describe('FeatureMatrix loading state', () => {
  it('renders a content-shaped skeleton instead of a bare spinner', () => {
    h.useFeatureMatrix.mockReturnValue(LOADING_STATE);

    const { container } = render(
      <FeatureMatrix
        moduleId={'arpg-combat' as SubModuleId}
        accentColor="#00ff88"
        onReview={() => {}}
        isReviewing={false}
      />,
    );

    // Announced as a busy status region for assistive tech.
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-label')).toBe('Loading feature matrix');
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByTestId('pof-feature-matrix-skeleton')).toBeTruthy();

    // Content-shaped: many pulsing placeholder bars (7 rows × 4 bars + summary),
    // not a single centered spinner.
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThanOrEqual(7);

    // Each skeleton row carries the 4px left rail that mirrors a real feature row.
    const railed = Array.from(container.querySelectorAll<HTMLElement>('[style]')).filter(
      (el) => el.style.borderLeft.includes('4px'),
    );
    expect(railed.length).toBeGreaterThanOrEqual(6);
  });

  it('staggers the row pulse with a 0/60/120ms wave', () => {
    h.useFeatureMatrix.mockReturnValue(LOADING_STATE);

    const { container } = render(
      <FeatureMatrix
        moduleId={'arpg-combat' as SubModuleId}
        accentColor="#00ff88"
        onReview={() => {}}
        isReviewing={false}
      />,
    );

    const delays = new Set(
      Array.from(container.querySelectorAll<HTMLElement>('.animate-pulse[style]'))
        .map((el) => el.style.animationDelay)
        .filter(Boolean),
    );
    // The wave uses three distinct offsets.
    expect(delays.has('60ms')).toBe(true);
    expect(delays.has('120ms')).toBe(true);
  });
});
