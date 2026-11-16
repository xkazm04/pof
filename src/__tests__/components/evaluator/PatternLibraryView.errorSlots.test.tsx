/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): anti-pattern load, verify, pin, author and
 * update failures all wrote the one `error` the Patterns tab renders as a dashboard-load
 * FetchError, so a failed anti-pattern fetch bannered a correctly loaded list and Retry re-ran
 * the wrong request.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { PatternLibraryView } from '@/components/modules/evaluator/PatternLibraryView';

beforeEach(() => {
  usePatternLibraryStore.setState({
    patterns: [], searchQuery: '', moduleFilter: null, categoryFilter: null, sortBy: 'success-rate',
    isLoading: false, error: null, mutationError: null, antiPatternError: null,
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('action=anti-patterns')) {
      return { json: async () => ({ success: false, error: 'anti-pattern table missing' }) } as Response;
    }
    const data = { patterns: [], totalPatterns: 0, totalSessions: 0, avgSuccessRate: 0, topModules: [], categories: [] };
    return { json: async () => ({ success: true, data }) } as Response;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PatternLibraryView - errors are attributed to the operation that failed', () => {
  it('a failed anti-pattern fetch after a good dashboard load shows no load-failure banner on the Patterns tab', async () => {
    render(<PatternLibraryView />);
    // The failure lands in whichever slot the store uses; it must not be the dashboard-load one.
    await waitFor(() => {
      const s = usePatternLibraryStore.getState();
      expect(s.antiPatternError ?? s.error).toBe('anti-pattern table missing');
    });
    expect(usePatternLibraryStore.getState().error).toBeNull();
    expect(screen.queryByText(/anti-pattern table missing/)).toBeNull();
  });
});
