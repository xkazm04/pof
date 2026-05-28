import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type {
  SimulationResult,
  SimulationConfig,
  EconomyFlow,
  EconomyItem,
  EconomyMetrics,
  InflationAlert,
  SupplyDemandPoint,
  XPCurvePoint,
} from '@/types/economy-simulator';
import type { CodeGenResult } from '@/lib/economy/codegen';
import {
  economyDrift,
  extractRunMetrics,
  type EconomyRun,
  type EconomyRunDrift,
} from '@/lib/economy/economy-run';

// ── Stable empty constants ──────────────────────────────────────────────────

const EMPTY_METRICS: EconomyMetrics[] = [];
const EMPTY_ALERTS: InflationAlert[] = [];
const EMPTY_SUPPLY_DEMAND: SupplyDemandPoint[] = [];
const EMPTY_FLOWS: EconomyFlow[] = [];
const EMPTY_ITEMS: EconomyItem[] = [];
const EMPTY_XP_CURVE: XPCurvePoint[] = [];
const EMPTY_RUNS: EconomyRun[] = [];

function computeDrift(
  result: SimulationResult | null,
  baseline: EconomyRun | null,
): EconomyRunDrift | null {
  if (!result || !baseline) return null;
  return economyDrift(extractRunMetrics(result), baseline);
}

// ── Store ───────────────────────────────────────────────────────────────────

interface EconomySimulatorState {
  // Defaults from server
  defaultFlows: EconomyFlow[];
  defaultItems: EconomyItem[];
  xpCurve: XPCurvePoint[];
  defaultConfig: SimulationConfig | null;

  // Current simulation
  config: SimulationConfig | null;
  result: SimulationResult | null;
  metrics: EconomyMetrics[];
  alerts: InflationAlert[];
  supplyDemand: SupplyDemandPoint[];

  // Code generation
  codeGenResult: CodeGenResult | null;
  isGenerating: boolean;

  // UI state
  isLoading: boolean;
  isSimulating: boolean;
  error: string | null;
  selectedCategory: string | null;

  // Saved runs + drift
  savedRuns: EconomyRun[];
  baselineRun: EconomyRun | null;
  drift: EconomyRunDrift | null;
  isRunsLoading: boolean;

  // Actions
  fetchDefaults: () => Promise<void>;
  runSimulation: (config: SimulationConfig) => Promise<SimulationResult | null>;
  generateCode: () => Promise<CodeGenResult | null>;
  setSelectedCategory: (category: string | null) => void;
  listRuns: () => Promise<void>;
  saveCurrentRun: (name: string) => Promise<EconomyRun | null>;
  loadRun: (id: string) => Promise<SimulationResult | null>;
  deleteRun: (id: string) => Promise<boolean>;
  setBaselineRun: (id: string | null) => Promise<void>;
}

export const useEconomySimulatorStore = create<EconomySimulatorState>((set, get) => ({
  defaultFlows: EMPTY_FLOWS,
  defaultItems: EMPTY_ITEMS,
  xpCurve: EMPTY_XP_CURVE,
  defaultConfig: null,

  config: null,
  result: null,
  metrics: EMPTY_METRICS,
  alerts: EMPTY_ALERTS,
  supplyDemand: EMPTY_SUPPLY_DEMAND,

  codeGenResult: null,
  isGenerating: false,

  isLoading: false,
  isSimulating: false,
  error: null,
  selectedCategory: null,

  savedRuns: EMPTY_RUNS,
  baselineRun: null,
  drift: null,
  isRunsLoading: false,

  fetchDefaults: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{
        flows: EconomyFlow[];
        items: EconomyItem[];
        xpCurve: XPCurvePoint[];
        defaultConfig: SimulationConfig;
      }>('/api/economy-simulator');

      set({
        defaultFlows: data.flows,
        defaultItems: data.items,
        xpCurve: data.xpCurve,
        defaultConfig: data.defaultConfig,
        config: data.defaultConfig,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  runSimulation: async (config: SimulationConfig) => {
    set({ isSimulating: true, error: null, config });
    try {
      const data = await apiFetch<{ result: SimulationResult }>(
        '/api/economy-simulator',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'simulate', config }),
        },
      );

      set({
        result: data.result,
        metrics: data.result.metrics,
        alerts: data.result.alerts,
        supplyDemand: data.result.supplyDemand,
        drift: computeDrift(data.result, get().baselineRun),
        isSimulating: false,
      });

      return data.result;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isSimulating: false });
      return null;
    }
  },

  generateCode: async () => {
    const { result, config } = get();
    if (!result && !config) return null;

    set({ isGenerating: true, error: null });
    try {
      const data = await apiFetch<CodeGenResult>(
        '/api/economy-simulator',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate-code',
            ...(result ? { result } : { config }),
          }),
        },
      );
      set({ codeGenResult: data, isGenerating: false });
      return data;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isGenerating: false });
      return null;
    }
  },

  setSelectedCategory: (category) => set({ selectedCategory: category }),

  listRuns: async () => {
    set({ isRunsLoading: true });
    try {
      const data = await apiFetch<{ runs: EconomyRun[]; baseline: EconomyRun | null }>(
        '/api/economy-simulator?action=list-runs',
      );
      const baseline = data.baseline ?? null;
      set({
        savedRuns: data.runs,
        baselineRun: baseline,
        drift: computeDrift(get().result, baseline),
        isRunsLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isRunsLoading: false });
    }
  },

  saveCurrentRun: async (name) => {
    const { result } = get();
    if (!result) return null;
    try {
      const data = await apiFetch<{ run: EconomyRun }>('/api/economy-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-run', name, result }),
      });
      // Re-list so ordering + any baseline flag stays correct.
      await get().listRuns();
      return data.run;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  },

  loadRun: async (id) => {
    try {
      const loadData = await apiFetch<{ run: EconomyRun }>('/api/economy-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load-run', id }),
      });
      // Re-simulate the loaded run's config so the full result (charts/snapshots) is restored.
      return await get().runSimulation(loadData.run.config);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  },

  deleteRun: async (id) => {
    try {
      await apiFetch<{ deleted: boolean }>('/api/economy-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-run', id }),
      });
      await get().listRuns();
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  },

  setBaselineRun: async (id) => {
    try {
      const data = await apiFetch<{ baseline: EconomyRun | null }>('/api/economy-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-baseline', id }),
      });
      const baseline = data.baseline ?? null;
      set({
        baselineRun: baseline,
        drift: computeDrift(get().result, baseline),
      });
      // Refresh the list so the new is_baseline flags are reflected in the UI strip.
      await get().listRuns();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
