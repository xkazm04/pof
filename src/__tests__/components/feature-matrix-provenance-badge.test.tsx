/**
 * Per-row provenance in the matrix.
 *
 * Before this change the matrix carried ONE module-level freshness dot, derived from
 * `features.find(f => f.lastReviewedAt)` — the first row in (category, feature_name)
 * order that happened to carry a timestamp. A module reviewed a year ago rendered
 * "2 hours ago" because one recently-fixed row sorted to the top, and no row could
 * say which write path had set it.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureSource } from '@/types/feature-matrix';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { formatRelativeTime } from '@/components/modules/shared/FeatureMatrix/helpers';
import { mockFetch } from '../setup';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);
beforeEach(() => { mockFetch(); });

const h = vi.hoisted(() => ({ useFeatureMatrix: vi.fn() }));
vi.mock('@/hooks/useFeatureMatrix', () => ({ useFeatureMatrix: h.useFeatureMatrix }));

import { FeatureMatrix } from '@/components/modules/shared/FeatureMatrix';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const hoursAgo = (n: number) => new Date(Date.now() - n * HOUR).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

function feature(
  name: string,
  over: Partial<FeatureRow> = {},
): FeatureRow {
  return {
    id: name.length,
    moduleId: 'arpg-combat' as SubModuleId,
    featureName: name,
    category: 'Core',
    status: 'implemented',
    description: `${name} description`,
    filePaths: [],
    reviewNotes: '',
    qualityScore: 3,
    nextSteps: '',
    lastReviewedAt: daysAgo(1),
    ...over,
  };
}

function renderWith(features: FeatureRow[]) {
  h.useFeatureMatrix.mockReturnValue({
    features,
    summary: { total: features.length, implemented: features.length, improved: 0, partial: 0, missing: 0, unknown: 0 },
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
      moduleId={'arpg-combat' as SubModuleId}
      accentColor={STATUS_SUCCESS}
      onReview={() => {}}
      isReviewing={false}
    />,
  );
}

function badge(container: HTMLElement, slug: string) {
  return container.querySelector<HTMLElement>(`[data-testid="pof-feature-matrix-provenance-${slug}"]`);
}

describe('per-row provenance badge', () => {
  it('renders a badge on every row naming that row’s source and its own age', () => {
    const { container } = renderWith([
      feature('Alpha', { source: 'review', lastReviewedAt: hoursAgo(2) }),
      feature('Beta', { source: 'fix', lastReviewedAt: daysAgo(200) }),
    ]);

    const alpha = badge(container, 'alpha');
    const beta = badge(container, 'beta');
    expect(alpha, 'expected a provenance badge on the Alpha row').toBeTruthy();
    expect(beta).toBeTruthy();

    expect(alpha!.getAttribute('data-source')).toBe('review');
    expect(beta!.getAttribute('data-source')).toBe('fix');
    // Each row states its OWN age — they are 200 days apart and must not agree.
    expect(alpha!.textContent).not.toBe(beta!.textContent);
  });

  it.each<[FeatureSource, string]>([
    ['review', 'reviewed'],
    ['verify', 'verified'],
    ['fix', 'fixed'],
    ['seed', 'seeded'],
    ['unknown', 'unrecorded'],
  ])('labels source %s in words, not by hue alone', (source, word) => {
    const { container } = renderWith([feature('Alpha', { source })]);
    expect(badge(container, 'alpha')!.textContent).toContain(word);
  });

  it('reads a row with no recorded source as "unrecorded", never as reviewed', () => {
    const { container } = renderWith([feature('Alpha', { source: undefined })]);
    const b = badge(container, 'alpha')!;
    expect(b.getAttribute('data-source')).toBe('unknown');
    expect(b.textContent).toContain('unrecorded');
  });

  it('says "never" for an undated row instead of rendering it as brand new', () => {
    const { container } = renderWith([feature('Alpha', { lastReviewedAt: null, source: 'seed' })]);
    expect(badge(container, 'alpha')!.textContent).toContain('never');
  });
});

describe('module freshness dot', () => {
  it('reports the OLDEST review in the module, not the first row that carries a date', () => {
    // "Alpha" sorts first and was fixed an hour ago; "Zulu" has not been reviewed in
    // 300 days. The old `find()` reported Alpha's age for the whole module.
    const fresh = hoursAgo(1);
    const ancient = daysAgo(300);
    const { container } = renderWith([
      feature('Alpha', { source: 'fix', lastReviewedAt: fresh }),
      feature('Zulu', { source: 'review', lastReviewedAt: ancient }),
    ]);

    const dot = container.querySelector<HTMLElement>('[data-testid="pof-feature-matrix-oldest-review"]');
    expect(dot).toBeTruthy();
    expect(dot!.getAttribute('title')).toContain('Oldest review');
    expect(dot!.textContent).toContain(formatRelativeTime(ancient).label);
    expect(dot!.textContent).not.toContain(formatRelativeTime(fresh).label);
    // Past the 7-day threshold the module is flagged outdated, not fresh.
    expect(dot!.textContent).toContain('outdated');
  });

  it('counts rows that carry a verdict but no review date instead of aging them as zero', () => {
    const { container } = renderWith([
      feature('Alpha', { lastReviewedAt: daysAgo(2) }),
      feature('Zulu', { lastReviewedAt: null }),
    ]);

    const dot = container.querySelector<HTMLElement>('[data-testid="pof-feature-matrix-oldest-review"]')!;
    expect(dot.textContent).toContain('+1 undated');
  });
});
