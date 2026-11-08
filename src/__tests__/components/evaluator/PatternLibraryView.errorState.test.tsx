/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): when the dashboard load failed, the view
 * rendered the FetchError AND the "No Patterns Yet / Extract Patterns" empty state together,
 * telling the user the library is empty when it was never read.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { PatternLibraryView } from '@/components/modules/evaluator/PatternLibraryView';

beforeEach(() => {
  usePatternLibraryStore.setState({
    patterns: [], searchQuery: '', moduleFilter: null, categoryFilter: null, sortBy: 'success-rate',
    isLoading: false, error: null,
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({
    json: async () => ({ success: false, error: 'database is locked' }),
  }) as Response));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PatternLibraryView - a failed load is not an empty library', () => {
  it('shows the load error and not the "No Patterns Yet" empty state', async () => {
    render(<PatternLibraryView />);
    await screen.findByText(/database is locked/);
    expect(screen.queryByText('No Patterns Yet')).toBeNull();
  });
});
