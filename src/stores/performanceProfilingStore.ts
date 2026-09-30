import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type {
  ProfilingSession,
  TriageResult,
  PerformanceFinding,
} from '@/types/performance-profiling';
import type { SessionComparisonResponse } from '@/lib/profiling/session-compare';

// ── Stable empty constants ──────────────────────────────────────────────────

const EMPTY_FINDINGS: PerformanceFinding[] = [];

// ── Store ───────────────────────────────────────────────────────────────────

export interface SessionListItem {
  id: string;
  name: string;
  source: string;
  importedAt: string;
  frameCount: number;
  avgFPS: number;
  hasTriage: boolean;
  /** null while the session is untriaged. */
  overallScore: number | null;
  bottleneck: TriageResult['bottleneck'] | null;
}

const PROFILING_URL = '/api/performance-profiling';

function postProfiling<T>(body: Record<string, unknown>): Promise<T> {
  return apiFetch<T>(PROFILING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** A freshly captured session's rail row — newest first, so it is prepended. */
function toListItem(session: ProfilingSession): SessionListItem {
  return {
    id: session.id,
    name: session.name,
    source: session.source,
    importedAt: session.importedAt,
    frameCount: session.frameCount,
    avgFPS: session.summary.avgFPS,
    hasTriage: false,
    overallScore: null,
    bottleneck: null,
  };
}

/** Mark rows triaged with their score (after a triage or a compare triaged them). */
function withTriage(
  list: SessionListItem[],
  scored: Array<{ id: string; overallScore: number; bottleneck: TriageResult['bottleneck'] }>,
): SessionListItem[] {
  return list.map((row) => {
    const hit = scored.find((s) => s.id === row.id);
    return hit ? { ...row, hasTriage: true, overallScore: hit.overallScore, bottleneck: hit.bottleneck } : row;
  });
}

interface PerformanceProfilingState {
  // Sessions
  sessionList: SessionListItem[];
  activeSession: ProfilingSession | null;
  triage: TriageResult | null;
  findings: PerformanceFinding[];

  // UI state
  isLoading: boolean;
  isImporting: boolean;
  isTriaging: boolean;
  error: string | null;

  // Compare mode — a before/after diff of two sessions
  comparison: SessionComparisonResponse | null;
  isComparing: boolean;

  // Actions
  listSessions: () => Promise<void>;
  importCSV: (csvContent: string, name: string, projectPath: string) => Promise<ProfilingSession | null>;
  generateSample: (scenarioType: string, enemyCount: number, targetFPS: number, projectPath: string) => Promise<ProfilingSession | null>;
  loadSession: (sessionId: string) => Promise<void>;
  runTriage: (sessionId: string) => Promise<TriageResult | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  compare: (baseId: string, headId: string) => Promise<SessionComparisonResponse | null>;
  clearComparison: () => void;
}

export const usePerformanceProfilingStore = create<PerformanceProfilingState>((set) => ({
  sessionList: [],
  activeSession: null,
  triage: null,
  findings: EMPTY_FINDINGS,

  isLoading: false,
  isImporting: false,
  isTriaging: false,
  error: null,

  comparison: null,
  isComparing: false,

  listSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{ sessions: SessionListItem[] }>(
        '/api/performance-profiling',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list-sessions' }),
        },
      );
      set({ sessionList: data.sessions, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  importCSV: async (csvContent, name, projectPath) => {
    set({ isImporting: true, error: null });
    try {
      const data = await apiFetch<{ session: ProfilingSession }>(
        '/api/performance-profiling',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'import-csv', csvContent, sessionName: name, projectPath }),
        },
      );
      set((state) => ({
        activeSession: data.session,
        triage: null,
        findings: EMPTY_FINDINGS,
        isImporting: false,
        sessionList: [toListItem(data.session), ...state.sessionList],
      }));
      return data.session;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isImporting: false });
      return null;
    }
  },

  generateSample: async (scenarioType, enemyCount, targetFPS, projectPath) => {
    set({ isImporting: true, error: null });
    try {
      const data = await apiFetch<{ session: ProfilingSession }>(
        '/api/performance-profiling',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate-sample', scenarioType, enemyCount, targetFPS, projectPath }),
        },
      );
      set((state) => ({
        activeSession: data.session,
        triage: null,
        findings: EMPTY_FINDINGS,
        isImporting: false,
        sessionList: [toListItem(data.session), ...state.sessionList],
      }));
      return data.session;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isImporting: false });
      return null;
    }
  },

  loadSession: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<{ session: ProfilingSession; triage: TriageResult | null }>(
        '/api/performance-profiling',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-session', sessionId }),
        },
      );
      set({
        activeSession: data.session,
        triage: data.triage,
        findings: data.triage?.findings ?? EMPTY_FINDINGS,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  runTriage: async (sessionId) => {
    set({ isTriaging: true, error: null });
    try {
      const data = await apiFetch<{ triage: TriageResult }>(
        '/api/performance-profiling',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'triage', sessionId }),
        },
      );
      set((state) => ({
        triage: data.triage,
        findings: data.triage.findings,
        isTriaging: false,
        sessionList: withTriage(state.sessionList, [{ id: sessionId, ...data.triage }]),
      }));
      return data.triage;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isTriaging: false });
      return null;
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await apiFetch<{ deleted: boolean }>(
        '/api/performance-profiling',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete-session', sessionId }),
        },
      );
      set((state) => ({
        sessionList: state.sessionList.filter((s) => s.id !== sessionId),
        activeSession: state.activeSession?.id === sessionId ? null : state.activeSession,
        triage: state.activeSession?.id === sessionId ? null : state.triage,
        findings: state.activeSession?.id === sessionId ? EMPTY_FINDINGS : state.findings,
        comparison: state.comparison?.base.id === sessionId || state.comparison?.head.id === sessionId
          ? null : state.comparison,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  compare: async (baseId, headId) => {
    set({ isComparing: true, error: null });
    try {
      const data = await postProfiling<SessionComparisonResponse>({ action: 'compare', baseId, headId });
      // The route triages an untriaged side first — reflect that in the rail.
      set((state) => ({
        comparison: data,
        isComparing: false,
        sessionList: withTriage(state.sessionList, [data.base, data.head]),
      }));
      return data;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isComparing: false });
      return null;
    }
  },

  clearComparison: () => set({ comparison: null }),
}));
