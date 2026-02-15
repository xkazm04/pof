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

// ── Stable empty constants ──────────────────────────────────────────────────

const EMPTY_METRICS: EconomyMetrics[] = [];
const EMPTY_ALERTS: InflationAlert[] = [];
const EMPTY_SUPPLY_DEMAND: SupplyDemandPoint[] = [];
const EMPTY_FLOWS: EconomyFlow[] = [];
const EMPTY_ITEMS: EconomyItem[] = [];
const EMPTY_XP_CURVE: XPCurvePoint[] = [];

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

  // Actions
  fetchDefaults: () => Promise<void>;
  runSimulation: (config: SimulationConfig) => Promise<SimulationResult | null>;
  generateCode: () => Promise<CodeGenResult | null>;
  setSelectedCategory: (category: string | null) => void;
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
}));
