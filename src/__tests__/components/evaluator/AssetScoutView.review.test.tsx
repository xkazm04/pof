/**
 * Asset Scout reads the shared feature-status map (useFeatureStatuses), shows real
 * gaps apart from unreviewed modules, and offers a one-click module review. The
 * review is a paid CLI run, so it must fire ONLY on an explicit click — never on
 * mount, on a refetch, or when the status map identity changes (which it does on
 * every invalidation).
 *
 * scan-sweep --challenge run challenge-2026-09-28c, card asset-visual-studio/B
 * (coordinator revision).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { scoutReviewTask } from '@/lib/marketplace/scout-review';
import { getAppOrigin } from '@/lib/constants';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { POST } from '@/app/api/marketplace/route';

afterEach(cleanup);

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  statuses: {
    statusMap: new Map<string, string>(),
    statuses: [],
    isLoading: false,
    loaded: true,
    failed: false,
    error: null as string | null,
    scope: null,
    refresh: () => {},
  },
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: h.execute, sendPrompt: vi.fn(), isRunning: false }),
}));

vi.mock('@/hooks/useFeatureStatuses', () => ({
  useFeatureStatuses: () => h.statuses,
  invalidateFeatureStatuses: vi.fn(),
}));

import { AssetScoutView } from '@/components/modules/evaluator/AssetScoutView';

/** Every defined feature implemented except arpg-combat and arpg-loot (never reviewed). */
function statusMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [moduleId, defs] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    if (moduleId === 'arpg-combat' || moduleId === 'arpg-loot') continue;
    for (const d of defs ?? []) map.set(`${moduleId}::${d.featureName}`, 'implemented');
  }
  return map;
}

const posts: unknown[] = [];

beforeEach(() => {
  h.execute.mockReset();
  h.execute.mockResolvedValue(undefined);
  h.statuses = { ...h.statuses, statusMap: statusMap(), loaded: true, failed: false };
  posts.length = 0;
  useMarketplaceStore.setState({ recommendations: [], totalGaps: 0, isLoading: false, error: null, moduleFilter: null });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url !== '/api/marketplace') throw new Error(`unexpected fetch ${url}`);
    posts.push(JSON.parse(String(init?.body)));
    return POST(new NextRequest('http://localhost/api/marketplace', { method: 'POST', body: String(init?.body) }));
  }));
});

describe('AssetScoutView — review only on an explicit click', () => {
  it('mount, refetch and a new status-map identity never dispatch; one click reviews arpg-loot once', async () => {
    const { rerender } = render(<AssetScoutView />);

    const lootRow = await screen.findByTestId('scout-unreviewed-arpg-loot');
    expect(screen.getByTestId('scout-unreviewed-arpg-combat')).toBeTruthy();
    expect(posts).toHaveLength(1);
    expect(h.execute).not.toHaveBeenCalled();

    // Invalidation hands every subscriber a NEW Map with the same rows → the Scout refetches.
    h.statuses = { ...h.statuses, statusMap: statusMap() };
    rerender(<AssetScoutView />);
    await waitFor(() => expect(posts).toHaveLength(2));
    await screen.findByTestId('scout-unreviewed-arpg-loot');
    expect(h.execute).not.toHaveBeenCalled();

    const lootNames = (MODULE_FEATURE_DEFINITIONS['arpg-loot'] ?? []).map((d) => d.featureName);
    fireEvent.click(screen.getByTestId('scout-unreviewed-arpg-loot').querySelector('button')!);
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.execute.mock.calls[0][0]).toEqual(scoutReviewTask('arpg-loot', lootNames, getAppOrigin(), 'Loot System'));
    expect(lootRow).toBeTruthy();
  });

  it('statuses that failed to load render an error, not gaps, and send no request', async () => {
    h.statuses = { ...h.statuses, statusMap: new Map(), failed: true, error: 'HTTP 500' };
    render(<AssetScoutView />);
    await screen.findByText(/feature status/i);
    expect(posts).toHaveLength(0);
    expect(h.execute).not.toHaveBeenCalled();
  });
});
