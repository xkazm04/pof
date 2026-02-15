import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type {
  ProfilingSession,
  TriageResult,
  PerformanceFinding,
} from '@/types/performance-profiling';

// ── Stable empty constants ──────────────────────────────────────────────────

const EMPTY_FINDINGS: PerformanceFinding[] = [];

// ── Store ───────────────────────────────────────────────────────────────────

interface SessionListItem {
  id: string;
  name: string;
  source: string;
  importedAt: string;
  frameCount: number;
  avgFPS: number;
  hasTriage: boolean;
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

  // Actions
  listSessions: () => Promise<void>;
  importCSV: (csvContent: string, name: string, projectPath: string) => Promise<ProfilingSession | null>;
  generateSample: (scenarioType: string, enemyCount: number, targetFPS: number, projectPath: string) => Promise<ProfilingSession | null>;
  loadSession: (sessionId: string) => Promise<void>;
  runTriage: (sessionId: string) => Promise<TriageResult | null>;
  deleteSession: (sessionId: string) => Promise<void>;
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
        sessionList: [...state.sessionList, {
          id: data.session.id,
          name: data.session.name,
          source: data.session.source,
          importedAt: data.session.importedAt,
          frameCount: data.session.frameCount,
          avgFPS: data.session.summary.avgFPS,
          hasTriage: false,
        }],
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
        sessionList: [...state.sessionList, {
          id: data.session.id,
          name: data.session.name,
          source: data.session.source,
          importedAt: data.session.importedAt,
          frameCount: data.session.frameCount,
          avgFPS: data.session.summary.avgFPS,
          hasTriage: false,
        }],
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
      set({
        triage: data.triage,
        findings: data.triage.findings,
        isTriaging: false,
      });
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
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
