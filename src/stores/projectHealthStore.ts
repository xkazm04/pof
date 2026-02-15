import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type {
  ProjectHealthSummary,
  ModuleHealthSummary,
  VelocityPoint,
  QualityPoint,
  Milestone,
  BurnChartPoint,
  SubsystemSignal,
} from '@/types/project-health';
import type { EvaluatorReport } from '@/types/evaluator';

/* ---- Stable empty constants (Zustand selector safety) ------------ */

const EMPTY_MODULE_HEALTH: ModuleHealthSummary[] = [];
const EMPTY_VELOCITY: VelocityPoint[] = [];
const EMPTY_QUALITY: QualityPoint[] = [];
const EMPTY_MILESTONES: Milestone[] = [];
const EMPTY_BURN: BurnChartPoint[] = [];
const EMPTY_SIGNALS: SubsystemSignal[] = [];

/* ---- State interface --------------------------------------------- */

interface ProjectHealthState {
  summary: ProjectHealthSummary | null;
  moduleHealth: ModuleHealthSummary[];
  velocityHistory: VelocityPoint[];
  qualityHistory: QualityPoint[];
  milestones: Milestone[];
  burnChart: BurnChartPoint[];
  subsystemSignals: SubsystemSignal[];

  isLoading: boolean;
  error: string | null;

  fetchHealth: (
    checklistProgress: Record<string, Record<string, boolean>>,
    scanHistory: EvaluatorReport[],
    lastScan: EvaluatorReport | null,
  ) => Promise<void>;
}

/* ---- Store ------------------------------------------------------- */

export const useProjectHealthStore = create<ProjectHealthState>((set) => ({
  summary: null,
  moduleHealth: EMPTY_MODULE_HEALTH,
  velocityHistory: EMPTY_VELOCITY,
  qualityHistory: EMPTY_QUALITY,
  milestones: EMPTY_MILESTONES,
  burnChart: EMPTY_BURN,
  subsystemSignals: EMPTY_SIGNALS,

  isLoading: false,
  error: null,

  fetchHealth: async (checklistProgress, scanHistory, lastScan) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<ProjectHealthSummary>('/api/project-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistProgress, scanHistory, lastScan }),
      });
      set({
        summary: data,
        moduleHealth: data.moduleHealth,
        velocityHistory: data.velocityHistory,
        qualityHistory: data.qualityHistory,
        milestones: data.milestones,
        burnChart: data.burnChart,
        subsystemSignals: data.subsystemSignals,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },
}));
