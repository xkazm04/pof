import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import { compareRuns } from '@/lib/combat/simulation-engine';
import type {
  SimulationResult,
  CombatScenario,
  TuningOverrides,
  CombatSimConfig,
  CombatSummary,
  BalanceAlert,
  ABComparisonResult,
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

  // A/B comparison
  /** Run pinned as the baseline; candidate runs are diffed against it. */
  baselineResult: SimulationResult | null;
  /** Latest baseline→candidate comparison (null until a candidate run completes). */
  comparison: ABComparisonResult | null;

  // Tuning state (live sliders)
  tuning: TuningOverrides | null;

  // UI
  isLoading: boolean;
  isSimulating: boolean;
  /** Progress of the in-flight streamed run, 0..1 (0 when idle/non-streaming). */
  simProgress: number;
  error: string | null;

  // Actions
  fetchDefaults: () => Promise<void>;
  runSimulation: (scenario: CombatScenario, tuning: TuningOverrides, config: CombatSimConfig) => Promise<SimulationResult | null>;
  /** Like runSimulation, but consumes the endpoint's SSE stream and updates simProgress per batch. */
  runSimulationStreaming: (scenario: CombatScenario, tuning: TuningOverrides, config: CombatSimConfig) => Promise<SimulationResult | null>;
  setTuning: (tuning: TuningOverrides) => void;
  /** Pin the current result as the A/B baseline. No-op if there is no result. */
  pinBaseline: () => void;
  /** Drop the pinned baseline and any comparison. */
  clearBaseline: () => void;
}

export const useCombatSimulatorStore = create<CombatSimulatorState>((set, get) => ({
  enemies: EMPTY_ENEMIES,
  abilities: EMPTY_ABILITIES,
  gearLoadouts: EMPTY_GEAR,
  defaultTuning: null,
  defaultConfig: null,

  result: null,
  summary: null,
  alerts: EMPTY_ALERTS,
  baselineResult: null,
  comparison: null,
  tuning: null,

  isLoading: false,
  isSimulating: false,
  simProgress: 0,
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
      // If a baseline is pinned, diff this candidate run against it.
      const baseline = get().baselineResult;
      const comparison = baseline
        ? compareRuns(baseline, data.result, { baseline: 'Baseline', candidate: 'Candidate' })
        : null;

      set({
        result: data.result,
        summary: data.result.summary,
        alerts: data.result.alerts,
        comparison,
        isSimulating: false,
      });
      return data.result;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isSimulating: false });
      return null;
    }
  },

  runSimulationStreaming: async (scenario, tuning, config) => {
    set({ isSimulating: true, error: null, simProgress: 0 });
    try {
      const res = await fetch('/api/combat-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate', scenario, tuning, config, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error(`Simulation request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: SimulationResult | null = null;
      let streamError: string | null = null;

      // Parse the SSE stream: blank-line-delimited `data: {json}` frames.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(5).trim()) as
            | { type: 'progress'; completed: number; total: number }
            | { type: 'result'; result: SimulationResult }
            | { type: 'error'; error: string };
          if (payload.type === 'progress') {
            set({ simProgress: payload.total > 0 ? payload.completed / payload.total : 0 });
          } else if (payload.type === 'result') {
            finalResult = payload.result;
          } else if (payload.type === 'error') {
            streamError = payload.error;
          }
        }
      }

      if (streamError) throw new Error(streamError);
      if (!finalResult) throw new Error('Simulation stream ended without a result');

      const baseline = get().baselineResult;
      const comparison = baseline
        ? compareRuns(baseline, finalResult, { baseline: 'Baseline', candidate: 'Candidate' })
        : null;

      set({
        result: finalResult,
        summary: finalResult.summary,
        alerts: finalResult.alerts,
        comparison,
        isSimulating: false,
        simProgress: 1,
      });
      return finalResult;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isSimulating: false, simProgress: 0 });
      return null;
    }
  },

  setTuning: (tuning) => set({ tuning }),

  pinBaseline: () => {
    const result = get().result;
    if (!result) return;
    // Pinning resets any prior comparison — the candidate must be re-run.
    set({ baselineResult: result, comparison: null });
  },

  clearBaseline: () => set({ baselineResult: null, comparison: null }),
}));
