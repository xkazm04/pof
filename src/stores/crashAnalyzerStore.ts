import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import { detectPatterns, computeStats } from '@/lib/crash-analyzer/analysis-engine';
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

/**
 * Persistence lives on the SERVER, in `crash_history` (better-sqlite3 + WAL +
 * idempotent bootstrap — the repo's DB idiom), not in this store.
 *
 * That is deliberate. An imported crash used to exist only in the array below,
 * and `fetchAnalysis` overwrote it with the same eight static samples on the next
 * mount, so nothing an operator imported survived a reload. Persisting the array
 * into `localStorage` would have fixed the reload but left the history trapped in
 * one browser, capped at ~5 MB of raw crash logs, and — worst — would have
 * written the eight built-in DEMO crashes into it as though they were crashes
 * observed in the project. The server keeps only what was actually observed,
 * bounded and stated (`CRASH_HISTORY_LIMITS`), and `fetchAnalysis` now returns
 * samples + history together.
 *
 * Consequence for Zustand v5: there is no `persist()` here at all, so the
 * "never persist transient state" rule is satisfied structurally — `isLoading`,
 * `error` and `selectedCrashId` cannot leak into storage because nothing is
 * stored client-side.
 */

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
      const data = await apiFetch<{
        report: CrashReport;
        diagnosis: CrashDiagnosis | null;
        seenBefore?: boolean;
      }>(
        '/api/crash-analyzer',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'parse-log', rawText }),
        },
      );

      const current = get();
      // Re-importing a crash PoF has already seen returns the record it is stored
      // under — same id, incremented occurrences. Merge by id so a repeat updates
      // the existing row's counters instead of appending a second copy; a list
      // that grows by one on every re-import is the opposite of "seen before".
      const existing = current.reports.findIndex((r) => r.id === data.report.id);
      const newReports = existing >= 0
        ? current.reports.map((r, i) => (i === existing ? data.report : r))
        : [...current.reports, data.report];

      const newDiagnoses = data.diagnosis
        ? [
            ...current.diagnoses.filter((d) => d.crashId !== data.diagnosis!.crashId),
            data.diagnosis,
          ]
        : current.diagnoses.filter((d) => d.crashId !== data.report.id);

      // Recompute derived state so pattern list + severity pills reflect the
      // imported crash (patterns first — stats depends on the pattern array).
      const newPatterns = detectPatterns(newReports);
      const newStats = computeStats(newReports, newPatterns);

      set({
        reports: newReports,
        diagnoses: newDiagnoses,
        patterns: newPatterns,
        stats: newStats,
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
