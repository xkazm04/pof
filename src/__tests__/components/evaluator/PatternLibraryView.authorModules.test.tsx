/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): the Author Pattern modal's Module select was
 * fed the dashboard's topModules - the at-most-10 modules that ALREADY have mined patterns. On an
 * empty library it offered exactly one hard-coded module, and a hand-authored pattern for any
 * module without mined patterns could not be filed under it.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { SUB_MODULES } from '@/lib/module-registry';
import { PatternLibraryView } from '@/components/modules/evaluator/PatternLibraryView';

beforeEach(() => {
  usePatternLibraryStore.setState({
    searchQuery: '', moduleFilter: null, categoryFilter: null, sortBy: 'success-rate', isLoading: false, error: null,
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const data = url.includes('action=dashboard')
      ? { patterns: [], totalPatterns: 0, totalSessions: 0, avgSuccessRate: 0, topModules: [{ moduleId: 'arpg-combat', patternCount: 2 }], categories: [] }
      : { antiPatterns: [] };
    return { json: async () => ({ success: true, data }) } as Response;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PatternLibraryView - authoring can target any module', () => {
  it('the Module select lists every sub-module, the ones with patterns first', async () => {
    render(<PatternLibraryView />);
    await waitFor(() => expect(usePatternLibraryStore.getState().topModules).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /author pattern/i }));

    const select = (await screen.findByDisplayValue('arpg-combat')) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values[0]).toBe('arpg-combat');
    expect(new Set(values)).toEqual(new Set(SUB_MODULES.map((m) => m.id)));
    expect(values).toHaveLength(SUB_MODULES.length);
  });
});
