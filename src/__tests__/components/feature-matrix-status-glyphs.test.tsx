import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import { mockFetch } from '../setup';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);
beforeEach(() => { mockFetch(); });

const h = vi.hoisted(() => ({ useFeatureMatrix: vi.fn() }));
vi.mock('@/hooks/useFeatureMatrix', () => ({ useFeatureMatrix: h.useFeatureMatrix }));

import { FeatureMatrix } from '@/components/modules/shared/FeatureMatrix';

// One feature per status, all reviewed so the matrix renders rows (not the
// "no review yet" empty state, which fires when every feature is unknown +
// never reviewed).
const STATUSES: FeatureStatus[] = ['implemented', 'improved', 'partial', 'missing', 'unknown'];

function feature(status: FeatureStatus, i: number): FeatureRow {
  return {
    id: i,
    moduleId: 'arpg-combat' as SubModuleId,
    featureName: `Feature ${status}`,
    category: 'Core',
    status,
    description: `${status} feature`,
    filePaths: [],
    reviewNotes: '',
    qualityScore: 3,
    nextSteps: '',
    lastReviewedAt: '2026-01-01T00:00:00.000Z',
  };
}

const POPULATED = {
  features: STATUSES.map(feature),
  summary: { total: 5, implemented: 1, improved: 1, partial: 1, missing: 1, unknown: 1 },
  isLoading: false,
  error: null,
  retry: vi.fn(),
  refetch: vi.fn(),
  runAutoVerify: vi.fn(),
  isVerifying: false,
  verificationResults: [],
};

// lucide renders `<svg class="lucide lucide-<kebab-name>">`. These are the
// distinct shape glyphs STATUS_CONFIG maps each status to.
const GLYPH_CLASS: Record<FeatureStatus, string> = {
  implemented: 'lucide-circle-check-big', // CheckCircle
  improved: 'lucide-sparkles',            // Sparkles
  partial: 'lucide-circle-dashed',        // CircleDashed
  missing: 'lucide-circle',               // Circle
  unknown: 'lucide-circle-question-mark', // HelpCircle
};

function renderMatrix() {
  h.useFeatureMatrix.mockReturnValue(POPULATED);
  return render(
    <FeatureMatrix
      moduleId={'arpg-combat' as SubModuleId}
      accentColor="#00ff88"
      onReview={() => {}}
      isReviewing={false}
    />,
  );
}

describe('FeatureMatrix non-color status glyphs', () => {
  it('renders a distinct shape glyph for every status (color is not the only cue)', () => {
    const { container } = renderMatrix();

    for (const status of STATUSES) {
      const glyphs = container.querySelectorAll(`svg.${GLYPH_CLASS[status]}`);
      // Each status' glyph appears on multiple surfaces (summary legend, filter
      // chip, feature row) — all driven by the one STATUS_CONFIG map.
      expect(glyphs.length, `expected a ${GLYPH_CLASS[status]} glyph for status "${status}"`).toBeGreaterThan(0);
    }
  });

  it('renders the same glyph beside the dot on a feature row', () => {
    const { container } = renderMatrix();
    const row = container.querySelector('[data-testid="pof-feature-matrix-row-feature-missing"]');
    expect(row).toBeTruthy();
    // The "missing" row carries the Circle glyph next to its status dot.
    expect(row!.querySelector('svg.lucide-circle')).toBeTruthy();
  });

  it('keeps deselected filter chips readable (opacity ~0.6) with a visible border, not disabled-looking', () => {
    const { container } = renderMatrix();

    // The only aria-pressed buttons in the matrix are the 5 status filter chips.
    const chips = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
    expect(chips.length).toBe(5);

    // All start active.
    expect(chips.every((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true);
    expect(chips.every((c) => c.style.opacity === '1')).toBe(true);

    // Deselect one chip.
    fireEvent.click(chips[0]);

    const refreshed = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
    const inactive = refreshed.find((c) => c.getAttribute('aria-pressed') === 'false');
    expect(inactive).toBeTruthy();

    // Deselected ≠ disabled: opacity is 0.6 (not the old 0.4) and a 1px border remains.
    expect(inactive!.style.opacity).toBe('0.6');
    expect(inactive!.style.border).toContain('1px solid');
    expect(inactive!.style.border).not.toBe('');
  });
});
