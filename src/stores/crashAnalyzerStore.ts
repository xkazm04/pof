import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type {
  CrashReport,
  CrashDiagnosis,
  CrashPattern,
  CrashStats,
  CrashAnalyzerResult,
} from '@/types/crash-analyzer';
import { emptyCrashStats } from '@/types/crash-analyzer';

/* ---- Stable empty constants (Zustand selector safety) ------------ */

/**
 * Stable empty references shared by the store's initial state and the view's
 * `?? EMPTY_*` selector fallbacks, so both sides read the identical reference
 * (no re-render churn from a fresh `[]` each render).
 */
export const EMPTY_REPORTS: CrashReport[] = [];
export const EMPTY_DIAGNOSES: CrashDiagnosis[] = [];
export const EMPTY_PATTERNS: CrashPattern[] = [];
const EMPTY_STATS: CrashStats = emptyCrashStats();

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
