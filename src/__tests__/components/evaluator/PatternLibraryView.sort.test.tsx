/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): the Sort select only took effect while a
 * search/module/category filter was set. The unfiltered list comes from the dashboard action,
 * which ignores sortBy, and the debounced effect only re-queried when a filter was active, so
 * choosing "Most Used" on the default view changed nothing.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { PatternLibraryView } from '@/components/modules/evaluator/PatternLibraryView';

const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  usePatternLibraryStore.setState({
    searchQuery: '', moduleFilter: null, categoryFilter: null, sortBy: 'success-rate',
    isLoading: false, error: null,
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const data = url.includes('action=dashboard')
      ? { patterns: [], totalPatterns: 0, totalSessions: 0, avgSuccessRate: 0, topModules: [], categories: [] }
      : url.includes('action=anti-patterns') ? { antiPatterns: [] } : { patterns: [] };
    return { json: async () => ({ success: true, data }) } as Response;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PatternLibraryView - sort applies without a filter', () => {
  it('choosing "Most Used" with no filter re-queries sorted by usage', async () => {
    render(<PatternLibraryView />);
    await waitFor(() => expect(calls.some((u) => u.includes('action=dashboard'))).toBe(true));
    await waitFor(() => expect(usePatternLibraryStore.getState().isLoading).toBe(false));

    fireEvent.change(screen.getByDisplayValue('Success Rate'), { target: { value: 'usage' } });

    await waitFor(() => expect(calls.some((u) => u.includes('action=search') && u.includes('sortBy=usage'))).toBe(true));
  });
});
