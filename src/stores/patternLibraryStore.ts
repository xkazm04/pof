'use client';

import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';
import type {
  ImplementationPattern,
  PatternCategory,
  PatternLibraryDashboard,
  PatternSuggestion,
  PatternAuthorInput,
  PatternMetaPatch,
  AntiPattern,
  AntiPatternWarning,
} from '@/types/pattern-library';

const EMPTY_PATTERNS: ImplementationPattern[] = [];
const EMPTY_SUGGESTIONS: PatternSuggestion[] = [];
const EMPTY_MODULES: { moduleId: SubModuleId; patternCount: number }[] = [];
const EMPTY_CATEGORIES: { category: PatternCategory; count: number }[] = [];
const EMPTY_ANTI_PATTERNS: AntiPattern[] = [];
const EMPTY_WARNINGS: AntiPatternWarning[] = [];

interface PatternLibraryState {
  patterns: ImplementationPattern[];
  totalPatterns: number;
  totalSessions: number;
  avgSuccessRate: number;
  topModules: { moduleId: SubModuleId; patternCount: number }[];
  categories: { category: PatternCategory; count: number }[];

  suggestions: PatternSuggestion[];

  antiPatterns: AntiPattern[];
  /** Warnings produced by the most recent pre-dispatch check. */
  lastDispatchWarnings: AntiPatternWarning[];
  /** Module the last dispatch check ran against (for surfacing context). */
  lastDispatchModuleId: SubModuleId | null;

  isLoading: boolean;
  isExtracting: boolean;
  isExtractingAnti: boolean;
  error: string | null;

  searchQuery: string;
  moduleFilter: SubModuleId | null;
  categoryFilter: PatternCategory | null;
  sortBy: 'success-rate' | 'usage' | 'recent' | 'duration';

  fetchDashboard: () => Promise<void>;
  searchPatterns: () => Promise<void>;
  extractPatterns: () => Promise<{ extracted: number; updated: number }>;
  fetchSuggestions: (moduleId: SubModuleId, label?: string) => Promise<void>;

  fetchAntiPatterns: () => Promise<void>;
  extractAntiPatterns: () => Promise<{ extracted: number; updated: number }>;
  /** Match a prompt against trigger keywords and record warnings (non-blocking). */
  checkPromptBeforeDispatch: (prompt: string, moduleId?: SubModuleId) => Promise<AntiPatternWarning[]>;
  clearDispatchWarnings: () => void;

  authorPattern: (input: PatternAuthorInput) => Promise<ImplementationPattern | null>;
  verifyPattern: (id: string, verified: boolean, verifiedBy?: string) => Promise<void>;
  pinPattern: (id: string, pinned: boolean) => Promise<void>;
  updatePattern: (id: string, patch: PatternMetaPatch) => Promise<void>;

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
    antiPatterns: EMPTY_ANTI_PATTERNS,
    lastDispatchWarnings: EMPTY_WARNINGS,
    lastDispatchModuleId: null,
    isLoading: false,
    isExtracting: false,
    isExtractingAnti: false,
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
        // Piggyback the anti-pattern load so the new tab paints with the rest.
        get().fetchAntiPatterns();
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

    authorPattern: async (input) => {
      try {
        const { pattern } = await apiFetch<{ pattern: ImplementationPattern }>(
          '/api/pattern-library',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'author', input }),
          },
        );
        await get().fetchDashboard();
        return pattern;
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to author pattern' });
        return null;
      }
    },

    verifyPattern: async (id, verified, verifiedBy) => {
      // Optimistic: flip the flag locally first, then reconcile via fetch.
      set({
        patterns: get().patterns.map((p) =>
          p.id === id ? { ...p, verified, verifiedAt: verified ? new Date().toISOString() : undefined, verifiedBy: verified ? verifiedBy : undefined } : p,
        ),
      });
      try {
        await apiFetch('/api/pattern-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', id, verified, verifiedBy }),
        });
        await get().fetchDashboard();
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to verify pattern' });
        await get().fetchDashboard();
      }
    },

    pinPattern: async (id, pinned) => {
      set({
        patterns: get().patterns.map((p) => (p.id === id ? { ...p, pinned } : p)),
      });
      try {
        await apiFetch('/api/pattern-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pin', id, pinned }),
        });
        await get().fetchDashboard();
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to pin pattern' });
        await get().fetchDashboard();
      }
    },

    updatePattern: async (id, patch) => {
      try {
        const { pattern } = await apiFetch<{ pattern: ImplementationPattern }>(
          '/api/pattern-library',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', id, patch }),
          },
        );
        set({
          patterns: get().patterns.map((p) => (p.id === id ? pattern : p)),
        });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to update pattern' });
      }
    },

    fetchAntiPatterns: async () => {
      try {
        const data = await apiFetch<{ antiPatterns: AntiPattern[] }>(
          '/api/pattern-library?action=anti-patterns',
        );
        set({ antiPatterns: data.antiPatterns });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to load anti-patterns' });
      }
    },

    extractAntiPatterns: async () => {
      set({ isExtractingAnti: true, error: null });
      try {
        const result = await apiFetch<{ extracted: number; updated: number }>(
          '/api/pattern-library',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'extract-anti' }),
          },
        );
        set({ isExtractingAnti: false });
        get().fetchAntiPatterns();
        return result;
      } catch (err) {
        set({
          isExtractingAnti: false,
          error: err instanceof Error ? err.message : 'Anti-pattern extraction failed',
        });
        return { extracted: 0, updated: 0 };
      }
    },

    checkPromptBeforeDispatch: async (prompt, moduleId) => {
      const trimmed = prompt.trim();
      if (trimmed.length < 20) {
        set({ lastDispatchWarnings: EMPTY_WARNINGS, lastDispatchModuleId: moduleId ?? null });
        return EMPTY_WARNINGS;
      }
      try {
        const params = new URLSearchParams({ action: 'check-prompt', prompt: trimmed });
        if (moduleId) params.set('moduleId', moduleId);
        const data = await apiFetch<{ warnings: AntiPatternWarning[] }>(
          `/api/pattern-library?${params}`,
        );
        set({
          lastDispatchWarnings: data.warnings,
          lastDispatchModuleId: moduleId ?? null,
        });
        return data.warnings;
      } catch {
        return EMPTY_WARNINGS;
      }
    },

    clearDispatchWarnings: () =>
      set({ lastDispatchWarnings: EMPTY_WARNINGS, lastDispatchModuleId: null }),

    setSearchQuery: (q) => set({ searchQuery: q }),
    setModuleFilter: (m) => set({ moduleFilter: m }),
    setCategoryFilter: (c) => set({ categoryFilter: c }),
    setSortBy: (s) => set({ sortBy: s }),
  }),
);
