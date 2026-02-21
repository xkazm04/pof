'use client';

import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';
import type {
  ImplementationPattern,
  PatternCategory,
  PatternLibraryDashboard,
  PatternSuggestion,
} from '@/types/pattern-library';

const EMPTY_PATTERNS: ImplementationPattern[] = [];
const EMPTY_SUGGESTIONS: PatternSuggestion[] = [];
const EMPTY_MODULES: { moduleId: SubModuleId; patternCount: number }[] = [];
const EMPTY_CATEGORIES: { category: PatternCategory; count: number }[] = [];

interface PatternLibraryState {
  patterns: ImplementationPattern[];
  totalPatterns: number;
  totalSessions: number;
  avgSuccessRate: number;
  topModules: { moduleId: SubModuleId; patternCount: number }[];
  categories: { category: PatternCategory; count: number }[];

  suggestions: PatternSuggestion[];

  isLoading: boolean;
  isExtracting: boolean;
  error: string | null;

  searchQuery: string;
  moduleFilter: SubModuleId | null;
  categoryFilter: PatternCategory | null;
  sortBy: 'success-rate' | 'usage' | 'recent' | 'duration';

  fetchDashboard: () => Promise<void>;
  searchPatterns: () => Promise<void>;
  extractPatterns: () => Promise<{ extracted: number; updated: number }>;
  fetchSuggestions: (moduleId: SubModuleId, label?: string) => Promise<void>;

  setSearchQuery: (q: string) => void;
  setModuleFilter: (m: SubModuleId | null) => void;
  setCategoryFilter: (c: PatternCategory | null) => void;
  setSortBy: (s: 'success-rate' | 'usage' | 'recent' | 'duration') => void;
}

export const usePatternLibraryStore = create<PatternLibraryState>()(
  (set, get) => ({
    patterns: EMPTY_PATTERNS,
    totalPatterns: 0,
    totalSessions: 0,
    avgSuccessRate: 0,
    topModules: EMPTY_MODULES,
    categories: EMPTY_CATEGORIES,
    suggestions: EMPTY_SUGGESTIONS,
    isLoading: false,
    isExtracting: false,
    error: null,
    searchQuery: '',
    moduleFilter: null,
    categoryFilter: null,
    sortBy: 'success-rate',

    fetchDashboard: async () => {
      if (get().isLoading) return;
      set({ isLoading: true, error: null });
      try {
        const data = await apiFetch<PatternLibraryDashboard>(
          '/api/pattern-library?action=dashboard',
        );
        set({
          patterns: data.patterns,
          totalPatterns: data.totalPatterns,
          totalSessions: data.totalSessions,
          avgSuccessRate: data.avgSuccessRate,
          topModules: data.topModules,
          categories: data.categories,
          isLoading: false,
        });
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load patterns',
        });
      }
    },

    searchPatterns: async () => {
      const { searchQuery, moduleFilter, categoryFilter, sortBy } = get();
      set({ isLoading: true, error: null });
      try {
        const params = new URLSearchParams({ action: 'search', sortBy });
        if (searchQuery) params.set('query', searchQuery);
        if (moduleFilter) params.set('moduleId', moduleFilter);
        if (categoryFilter) params.set('category', categoryFilter);

        const data = await apiFetch<{ patterns: ImplementationPattern[] }>(
          `/api/pattern-library?${params}`,
        );
        set({ patterns: data.patterns, isLoading: false });
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Search failed',
        });
      }
    },

    extractPatterns: async () => {
      set({ isExtracting: true, error: null });
      try {
        const result = await apiFetch<{ extracted: number; updated: number }>(
          '/api/pattern-library',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'extract' }),
          },
        );
        set({ isExtracting: false });
        // Refresh after extraction
        get().fetchDashboard();
        return result;
      } catch (err) {
        set({
          isExtracting: false,
          error: err instanceof Error ? err.message : 'Extraction failed',
        });
        return { extracted: 0, updated: 0 };
      }
    },

    fetchSuggestions: async (moduleId, label) => {
      try {
        const params = new URLSearchParams({ action: 'suggest', moduleId });
        if (label) params.set('label', label);
        const data = await apiFetch<{ suggestions: PatternSuggestion[] }>(
          `/api/pattern-library?${params}`,
        );
        set({ suggestions: data.suggestions });
      } catch {
        // Silent fail for suggestions
      }
    },

    setSearchQuery: (q) => set({ searchQuery: q }),
    setModuleFilter: (m) => set({ moduleFilter: m }),
    setCategoryFilter: (c) => set({ categoryFilter: c }),
    setSortBy: (s) => set({ sortBy: s }),
  }),
);
