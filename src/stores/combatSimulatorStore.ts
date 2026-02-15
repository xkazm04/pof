import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type {
  SimulationResult,
  CombatScenario,
  TuningOverrides,
  CombatSimConfig,
  CombatSummary,
  BalanceAlert,
  EnemyArchetype,
  CombatAbility,
  GearLoadout,
} from '@/types/combat-simulator';

// ── Stable empty constants ──────────────────────────────────────────────────

const EMPTY_ALERTS: BalanceAlert[] = [];
const EMPTY_ENEMIES: EnemyArchetype[] = [];
const EMPTY_ABILITIES: CombatAbility[] = [];
const EMPTY_GEAR: GearLoadout[] = [];

// ── Store ───────────────────────────────────────────────────────────────────

interface CombatSimulatorState {
  // Defaults
  enemies: EnemyArchetype[];
  abilities: CombatAbility[];
  gearLoadouts: GearLoadout[];
  defaultTuning: TuningOverrides | null;
  defaultConfig: CombatSimConfig | null;

  // Current sim
  result: SimulationResult | null;
  summary: CombatSummary | null;
  alerts: BalanceAlert[];

  // Tuning state (live sliders)
  tuning: TuningOverrides | null;

  // UI
  isLoading: boolean;
  isSimulating: boolean;
  error: string | null;

  // Actions
  fetchDefaults: () => Promise<void>;
  runSimulation: (scenario: CombatScenario, tuning: TuningOverrides, config: CombatSimConfig) => Promise<SimulationResult | null>;
  setTuning: (tuning: TuningOverrides) => void;
}

export const useCombatSimulatorStore = create<CombatSimulatorState>((set) => ({
  enemies: EMPTY_ENEMIES,
  abilities: EMPTY_ABILITIES,
  gearLoadouts: EMPTY_GEAR,
  defaultTuning: null,
  defaultConfig: null,

  result: null,
  summary: null,
  alerts: EMPTY_ALERTS,
  tuning: null,

  isLoading: false,
  isSimulating: false,
  error: null,

  fetchDefaults: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{
        enemies: EnemyArchetype[];
        abilities: CombatAbility[];
        gearLoadouts: GearLoadout[];
        defaultTuning: TuningOverrides;
        defaultConfig: CombatSimConfig;
      }>('/api/combat-simulator');

      set({
        enemies: data.enemies,
        abilities: data.abilities,
        gearLoadouts: data.gearLoadouts,
        defaultTuning: data.defaultTuning,
        defaultConfig: data.defaultConfig,
        tuning: data.defaultTuning,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  runSimulation: async (scenario, tuning, config) => {
    set({ isSimulating: true, error: null });
    try {
      const data = await apiFetch<{ result: SimulationResult }>(
        '/api/combat-simulator',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'simulate', scenario, tuning, config }),
        },
      );
      set({
        result: data.result,
        summary: data.result.summary,
        alerts: data.result.alerts,
        isSimulating: false,
      });
      return data.result;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isSimulating: false });
      return null;
    }
  },

  setTuning: (tuning) => set({ tuning }),
}));
