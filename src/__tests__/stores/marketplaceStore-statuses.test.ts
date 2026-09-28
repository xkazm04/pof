/**
 * marketplaceStore.fetchRecommendations is fed the project's feature statuses and
 * fails CLOSED when they could not be loaded: no request, a named error, and no
 * recommendations — never 240 fictional gaps computed from an empty map.
 *
 * scan-sweep --challenge run challenge-2026-09-28c, card asset-visual-studio/B.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMarketplaceStore } from '@/stores/marketplaceStore';

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  fetchSpy.mockImplementation(async () => ({
    json: async () => ({
      success: true,
      data: { recommendations: [], totalGaps: 1, totalAssets: 30, estimatedTimeSaved: 0, unreviewed: [], totalUnreviewed: 0 },
    }),
  }));
  vi.stubGlobal('fetch', fetchSpy);
  useMarketplaceStore.setState({ recommendations: [], totalGaps: 0, isLoading: false, error: null });
});

describe('fetchRecommendations with feature statuses', () => {
  it('statusesFailed -> no POST, error names the status load failure, recommendations stay []', async () => {
    await useMarketplaceStore.getState().fetchRecommendations({ statusMap: {}, statusesFailed: true, statusesError: 'HTTP 500' });
    expect(fetchSpy).not.toHaveBeenCalled();
    const s = useMarketplaceStore.getState();
    expect(s.error).toMatch(/feature status/i);
    expect(s.error).toContain('HTTP 500');
    expect(s.recommendations).toEqual([]);
    expect(s.totalGaps).toBe(0);
    expect(s.isLoading).toBe(false);
  });

  it('a loaded map is POSTed as the statusMap body', async () => {
    await useMarketplaceStore.getState().fetchRecommendations({ statusMap: { 'arpg-loot::X': 'missing' }, moduleId: 'arpg-loot' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1].body));
    expect(body).toMatchObject({ action: 'recommend', statusMap: { 'arpg-loot::X': 'missing' }, moduleId: 'arpg-loot' });
    expect(useMarketplaceStore.getState().totalGaps).toBe(1);
  });
});
