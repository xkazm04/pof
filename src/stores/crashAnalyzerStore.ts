import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type {
  CrashReport,
  CrashDiagnosis,
  CrashPattern,
  CrashStats,
  CrashAnalyzerResult,
} from '@/types/crash-analyzer';

/* ---- Stable empty constants (Zustand selector safety) ------------ */

const EMPTY_REPORTS: CrashReport[] = [];
const EMPTY_DIAGNOSES: CrashDiagnosis[] = [];
const EMPTY_PATTERNS: CrashPattern[] = [];
const EMPTY_STATS: CrashStats = {
  totalCrashes: 0,
  crashesByType: {
    nullptr_deref: 0, access_violation: 0, assertion_failed: 0, ensure_failed: 0,
    gc_reference: 0, stack_overflow: 0, out_of_memory: 0, unhandled_exception: 0,
    fatal_error: 0, gpu_crash: 0, unknown: 0,
  },
  crashesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
  crashesByModule: {},
  patternsDetected: 0,
  systemicIssues: 0,
  recentCrashes: 0,
  mostCommonType: 'unknown',
  mostAffectedModule: 'none',
};

/* ---- State interface --------------------------------------------- */

interface CrashAnalyzerState {
  reports: CrashReport[];
  diagnoses: CrashDiagnosis[];
  patterns: CrashPattern[];
  stats: CrashStats;

  // Selected crash for detail view
  selectedCrashId: string | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAnalysis: () => Promise<void>;
  importCrashLog: (rawText: string) => Promise<CrashReport | null>;
  selectCrash: (id: string | null) => void;
}

/* ---- Store ------------------------------------------------------- */

export const useCrashAnalyzerStore = create<CrashAnalyzerState>((set, get) => ({
  reports: EMPTY_REPORTS,
  diagnoses: EMPTY_DIAGNOSES,
  patterns: EMPTY_PATTERNS,
  stats: EMPTY_STATS,

  selectedCrashId: null,

  isLoading: false,
  error: null,

  /* ---- Fetch full analysis --------------------------------------- */
  fetchAnalysis: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<CrashAnalyzerResult>('/api/crash-analyzer');
      set({
        reports: data.reports,
        diagnoses: data.diagnoses,
        patterns: data.patterns,
        stats: data.stats,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  /* ---- Import crash log ------------------------------------------ */
  importCrashLog: async (rawText: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{ report: CrashReport; diagnosis: CrashDiagnosis | null }>(
        '/api/crash-analyzer',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'parse-log', rawText }),
        },
      );

      const current = get();
      const newReports = [...current.reports, data.report];
      const newDiagnoses = data.diagnosis
        ? [...current.diagnoses, data.diagnosis]
        : current.diagnoses;

      set({
        reports: newReports,
        diagnoses: newDiagnoses,
        isLoading: false,
      });

      return data.report;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
      return null;
    }
  },

  /* ---- Select crash ---------------------------------------------- */
  selectCrash: (id) => set({ selectedCrashId: id }),
}));
