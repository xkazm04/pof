import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';
import type {
  PromptVariant,
  ABTest,
  PromptCluster,
  EvolutionStats,
  EvolutionSuggestion,
  MutationType,
  TemplateFamily,
  PromptOptimizationResult,
} from '@/types/prompt-evolution';

// ── Stable empty constants ──────────────────────────────────────────────────

const EMPTY_VARIANTS: PromptVariant[] = [];
const EMPTY_TESTS: ABTest[] = [];
const EMPTY_CLUSTERS: PromptCluster[] = [];
const EMPTY_SUGGESTIONS: EvolutionSuggestion[] = [];
const EMPTY_FAMILIES: TemplateFamily[] = [];
const EMPTY_STATS: EvolutionStats = {
  totalVariants: 0,
  activeABTests: 0,
  concludedABTests: 0,
  templateFamilies: 0,
  avgImprovementRate: 0,
  topPerformingModule: null,
  moduleBreakdown: [],
};

// ── Store ───────────────────────────────────────────────────────────────────

interface PromptEvolutionState {
  // Data
  variants: PromptVariant[];
  abTests: ABTest[];
  clusters: PromptCluster[];
  suggestions: EvolutionSuggestion[];
  families: TemplateFamily[];
  stats: EvolutionStats;
  selectedModuleId: SubModuleId | null;
  selectedChecklistItemId: string | null;
  selectedVariantId: string | null;
  selectedTestId: string | null;

  // Optimizer state
  lastOptimization: PromptOptimizationResult | null;
  isOptimizing: boolean;

  // UI state
  isLoading: boolean;
  isMutating: boolean;
  isClustering: boolean;
  error: string | null;
  activeSubTab: 'variants' | 'tests' | 'clusters' | 'stats' | 'optimizer';

  // Actions
  init: () => Promise<void>;
  setSelectedModule: (moduleId: SubModuleId | null) => void;
  setSelectedChecklistItem: (itemId: string | null) => void;
  setSelectedVariant: (variantId: string | null) => void;
  setSelectedTest: (testId: string | null) => void;
  setActiveSubTab: (tab: PromptEvolutionState['activeSubTab']) => void;
  loadVariants: (moduleId: SubModuleId, checklistItemId?: string) => Promise<void>;
  createVariant: (moduleId: SubModuleId, checklistItemId: string, prompt: string) => Promise<PromptVariant | null>;
  mutateVariant: (variantId: string, mutation: MutationType) => Promise<PromptVariant | null>;
  startABTest: (moduleId: SubModuleId, checklistItemId: string, variantAId: string, variantBId: string) => Promise<ABTest | null>;
  recordTrial: (testId: string, variantSlot: 'A' | 'B', success: boolean, durationMs: number) => Promise<ABTest | null>;
  concludeTest: (testId: string) => Promise<ABTest | null>;
  clusterPrompts: (moduleId: SubModuleId) => Promise<void>;
  loadStats: () => Promise<void>;
  loadSuggestions: (moduleId: SubModuleId) => Promise<void>;
  getBestVariant: (moduleId: SubModuleId, checklistItemId: string) => Promise<PromptVariant | null>;
  optimizePrompt: (moduleId: SubModuleId, prompt: string) => Promise<PromptOptimizationResult | null>;
}

export const usePromptEvolutionStore = create<PromptEvolutionState>((set, get) => ({
  // Initial state
  variants: EMPTY_VARIANTS,
  abTests: EMPTY_TESTS,
  clusters: EMPTY_CLUSTERS,
  suggestions: EMPTY_SUGGESTIONS,
  families: EMPTY_FAMILIES,
  stats: EMPTY_STATS,
  selectedModuleId: null,
  selectedChecklistItemId: null,
  selectedVariantId: null,
  selectedTestId: null,
  lastOptimization: null,
  isOptimizing: false,
  isLoading: false,
  isMutating: false,
  isClustering: false,
  error: null,
  activeSubTab: 'variants',

  init: async () => {
    set({ isLoading: true, error: null });
    try {
      const stats = await apiFetch<EvolutionStats>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-stats' }),
      });
      set({ stats, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to initialize', isLoading: false });
    }
  },

  setSelectedModule: (moduleId) => set({ selectedModuleId: moduleId, selectedChecklistItemId: null }),
  setSelectedChecklistItem: (itemId) => set({ selectedChecklistItemId: itemId }),
  setSelectedVariant: (variantId) => set({ selectedVariantId: variantId }),
  setSelectedTest: (testId) => set({ selectedTestId: testId }),
  setActiveSubTab: (tab) => set({ activeSubTab: tab }),

  loadVariants: async (moduleId, checklistItemId) => {
    set({ isLoading: true, error: null });
    try {
      const variants = await apiFetch<PromptVariant[]>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-variants', moduleId, checklistItemId }),
      });
      set({ variants, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load variants', isLoading: false });
    }
  },

  createVariant: async (moduleId, checklistItemId, prompt) => {
    set({ isMutating: true, error: null });
    try {
      const variant = await apiFetch<PromptVariant>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-variant', moduleId, checklistItemId, prompt }),
      });
      set((s) => ({ variants: [...s.variants, variant], isMutating: false }));
      return variant;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create variant', isMutating: false });
      return null;
    }
  },

  mutateVariant: async (variantId, mutationType) => {
    set({ isMutating: true, error: null });
    try {
      const variant = await apiFetch<PromptVariant>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mutate-variant', variantId, mutationType }),
      });
      set((s) => ({ variants: [...s.variants, variant], isMutating: false }));
      return variant;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to mutate variant', isMutating: false });
      return null;
    }
  },

  startABTest: async (moduleId, checklistItemId, variantAId, variantBId) => {
    set({ isMutating: true, error: null });
    try {
      const test = await apiFetch<ABTest>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-ab-test', moduleId, checklistItemId, variantId: variantAId, testId: variantBId }),
      });
      set((s) => ({ abTests: [...s.abTests, test], isMutating: false }));
      return test;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to start test', isMutating: false });
      return null;
    }
  },

  recordTrial: async (testId, variantSlot, success, durationMs) => {
    try {
      const test = await apiFetch<ABTest>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-trial',
          testId,
          variantId: variantSlot,
          success,
          durationMs,
        }),
      });
      set((s) => ({
        abTests: s.abTests.map((t) => (t.id === testId ? test : t)),
      }));
      return test;
    } catch {
      return null;
    }
  },

  concludeTest: async (testId) => {
    try {
      const test = await apiFetch<ABTest>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'conclude-test', testId }),
      });
      set((s) => ({
        abTests: s.abTests.map((t) => (t.id === testId ? test : t)),
      }));
      return test;
    } catch {
      return null;
    }
  },

  clusterPrompts: async (moduleId) => {
    set({ isClustering: true, error: null });
    try {
      const clusters = await apiFetch<PromptCluster[]>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cluster-prompts', moduleId }),
      });
      set({ clusters, isClustering: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Clustering failed', isClustering: false });
    }
  },

  loadStats: async () => {
    try {
      const stats = await apiFetch<EvolutionStats>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-stats' }),
      });
      set({ stats });
    } catch { /* ignore */ }
  },

  loadSuggestions: async (moduleId) => {
    try {
      const suggestions = await apiFetch<EvolutionSuggestion[]>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-suggestions', moduleId }),
      });
      set({ suggestions });
    } catch { /* ignore */ }
  },

  getBestVariant: async (moduleId, checklistItemId) => {
    try {
      return await apiFetch<PromptVariant | null>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-best-variant', moduleId, checklistItemId }),
      });
    } catch {
      return null;
    }
  },

  optimizePrompt: async (moduleId, prompt) => {
    set({ isOptimizing: true, error: null });
    try {
      const result = await apiFetch<PromptOptimizationResult>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'optimize-prompt', moduleId, prompt }),
      });
      set({ lastOptimization: result, isOptimizing: false });
      return result;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Optimization failed', isOptimizing: false });
      return null;
    }
  },
}));
