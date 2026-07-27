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
  PromptOptimizationResult,
  VariantVersionHistory,
  PromptVersionFitness,
} from '@/types/prompt-evolution';

// ── Stable empty constants ──────────────────────────────────────────────────

const EMPTY_VARIANTS: PromptVariant[] = [];
const EMPTY_TESTS: ABTest[] = [];
const EMPTY_CLUSTERS: PromptCluster[] = [];
const EMPTY_SUGGESTIONS: EvolutionSuggestion[] = [];
const EMPTY_FITNESS: PromptVersionFitness[] = [];
const EMPTY_STATS: EvolutionStats = {
  totalVariants: 0,
  activeABTests: 0,
  concludedABTests: 0,
  avgImprovementRate: 0,
  topPerformingModule: null,
  moduleBreakdown: [],
};

// ── Request sequencing ──────────────────────────────────────────────────────
// Rapid module-picker switching puts two loadVariants/loadSuggestions fetches
// in flight at once; an out-of-order response must not overwrite the store with
// a stale module's data. Each dispatch captures a monotonic token and only
// commits its result if it is still the latest request for that loader.
let variantsRequestSeq = 0;
let suggestionsRequestSeq = 0;

// ── Store ───────────────────────────────────────────────────────────────────

interface PromptEvolutionState {
  // Data
  variants: PromptVariant[];
  abTests: ABTest[];
  clusters: PromptCluster[];
  suggestions: EvolutionSuggestion[];
  stats: EvolutionStats;
  /** Judge-scored quality per quality-pack prompt version (null score = unjudged). */
  promptFitness: PromptVersionFitness[];
  selectedModuleId: SubModuleId | null;
  selectedChecklistItemId: string | null;
  selectedVariantId: string | null;
  selectedTestId: string | null;

  // Version history (per checklist item) state
  versionHistory: VariantVersionHistory | null;
  isLoadingHistory: boolean;
  isRestoring: boolean;

  // Optimizer state
  lastOptimization: PromptOptimizationResult | null;
  isOptimizing: boolean;

  // UI state
  isLoading: boolean;
  isMutating: boolean;
  isClustering: boolean;
  error: string | null;
  activeSubTab: 'variants' | 'history' | 'tests' | 'clusters' | 'stats' | 'optimizer';

  // Actions
  init: () => Promise<void>;
  setSelectedModule: (moduleId: SubModuleId | null) => void;
  setSelectedChecklistItem: (itemId: string | null) => void;
  setSelectedVariant: (variantId: string | null) => void;
  setSelectedTest: (testId: string | null) => void;
  setActiveSubTab: (tab: PromptEvolutionState['activeSubTab']) => void;
  loadVariants: (moduleId: SubModuleId, checklistItemId?: string) => Promise<void>;
  loadTests: (moduleId?: SubModuleId) => Promise<void>;
  createVariant: (moduleId: SubModuleId, checklistItemId: string, prompt: string) => Promise<PromptVariant | null>;
  mutateVariant: (variantId: string, mutation: MutationType) => Promise<PromptVariant | null>;
  startABTest: (moduleId: SubModuleId, checklistItemId: string, variantAId: string, variantBId: string) => Promise<ABTest | null>;
  recordTrial: (testId: string, variantSlot: 'A' | 'B', success: boolean, durationMs: number) => Promise<ABTest | null>;
  concludeTest: (testId: string) => Promise<ABTest | null>;
  clusterPrompts: (moduleId: SubModuleId) => Promise<void>;
  loadStats: () => Promise<void>;
  loadPromptFitness: () => Promise<void>;
  loadSuggestions: (moduleId: SubModuleId) => Promise<void>;
  getBestVariant: (moduleId: SubModuleId, checklistItemId: string) => Promise<PromptVariant | null>;
  loadVersionHistory: (moduleId: SubModuleId, checklistItemId: string) => Promise<void>;
  restoreVariant: (variantId: string) => Promise<PromptVariant | null>;
  optimizePrompt: (moduleId: SubModuleId, prompt: string) => Promise<PromptOptimizationResult | null>;
}

export const usePromptEvolutionStore = create<PromptEvolutionState>((set, get) => ({
  // Initial state
  variants: EMPTY_VARIANTS,
  abTests: EMPTY_TESTS,
  clusters: EMPTY_CLUSTERS,
  suggestions: EMPTY_SUGGESTIONS,
  stats: EMPTY_STATS,
  promptFitness: EMPTY_FITNESS,
  selectedModuleId: null,
  selectedChecklistItemId: null,
  selectedVariantId: null,
  selectedTestId: null,
  versionHistory: null,
  isLoadingHistory: false,
  isRestoring: false,
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
      // Hydrate persisted A/B tests so they survive reloads — abTests was
      // otherwise only ever populated by this session's own start/record/
      // conclude responses, so a reload orphaned every running test while
      // Stats still counted it as Active.
      await get().loadTests();
      await get().loadPromptFitness();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to initialize', isLoading: false });
    }
  },

  loadTests: async (moduleId) => {
    try {
      const abTests = await apiFetch<ABTest[]>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-tests', ...(moduleId ? { moduleId } : {}) }),
      });
      set({ abTests });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load A/B tests' });
    }
  },

  setSelectedModule: (moduleId) => set({ selectedModuleId: moduleId, selectedChecklistItemId: null }),
  setSelectedChecklistItem: (itemId) => set({ selectedChecklistItemId: itemId }),
  setSelectedVariant: (variantId) => set({ selectedVariantId: variantId }),
  setSelectedTest: (testId) => set({ selectedTestId: testId }),
  setActiveSubTab: (tab) => set({ activeSubTab: tab }),

  loadVariants: async (moduleId, checklistItemId) => {
    const requestSeq = ++variantsRequestSeq;
    set({ isLoading: true, error: null });
    try {
      const variants = await apiFetch<PromptVariant[]>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-variants', moduleId, checklistItemId }),
      });
      // A newer loadVariants (e.g. the user switched modules) has superseded
      // this request — drop the stale response so it can't overwrite the store.
      if (requestSeq !== variantsRequestSeq) return;
      set({ variants, isLoading: false });
    } catch (err) {
      if (requestSeq !== variantsRequestSeq) return;
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
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to record trial' });
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
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to conclude test' });
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
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load stats' });
    }
  },

  loadPromptFitness: async () => {
    try {
      const promptFitness = await apiFetch<PromptVersionFitness[]>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-prompt-fitness' }),
      });
      set({ promptFitness });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load prompt fitness' });
    }
  },

  loadSuggestions: async (moduleId) => {
    const requestSeq = ++suggestionsRequestSeq;
    try {
      const suggestions = await apiFetch<EvolutionSuggestion[]>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-suggestions', moduleId }),
      });
      // Ignore an out-of-order response from a superseded module selection.
      if (requestSeq !== suggestionsRequestSeq) return;
      set({ suggestions });
    } catch (err) {
      if (requestSeq !== suggestionsRequestSeq) return;
      set({ error: err instanceof Error ? err.message : 'Failed to load suggestions' });
    }
  },

  getBestVariant: async (moduleId, checklistItemId) => {
    try {
      return await apiFetch<PromptVariant | null>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-best-variant', moduleId, checklistItemId }),
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch best variant' });
      return null;
    }
  },

  loadVersionHistory: async (moduleId, checklistItemId) => {
    set({ isLoadingHistory: true, error: null });
    try {
      const history = await apiFetch<VariantVersionHistory>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-version-history', moduleId, checklistItemId }),
      });
      set({ versionHistory: history, isLoadingHistory: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load version history', isLoadingHistory: false });
    }
  },

  restoreVariant: async (variantId) => {
    set({ isRestoring: true, error: null });
    try {
      const restored = await apiFetch<PromptVariant>('/api/prompt-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore-variant', variantId }),
      });
      // Reflect the new active version locally without a round-trip: flip the
      // active flag on the matching item's versions in the loaded history.
      set((s) => {
        if (!s.versionHistory || s.versionHistory.checklistItemId !== restored.checklistItemId) {
          return { isRestoring: false };
        }
        const versions = s.versionHistory.versions.map((v) => ({
          ...v,
          isActive: v.variant.id === restored.id,
          variant: { ...v.variant, active: v.variant.id === restored.id },
        }));
        const flip = (node: VariantVersionHistory['roots'][number]): VariantVersionHistory['roots'][number] => ({
          ...node,
          isActive: node.variant.id === restored.id,
          variant: { ...node.variant, active: node.variant.id === restored.id },
          children: node.children.map(flip),
        });
        return {
          isRestoring: false,
          versionHistory: {
            ...s.versionHistory,
            versions,
            roots: s.versionHistory.roots.map(flip),
            activeVariantId: restored.id,
          },
        };
      });
      return restored;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to restore version', isRestoring: false });
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
