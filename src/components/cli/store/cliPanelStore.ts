'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SkillId } from '../skills';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { CallbackStatus } from '@/lib/cli-task';

/**
 * Run lifecycle of a session. 'running' from dispatch until the stream ends,
 * 'settling' while the run's callback POST settles (bounded by
 * UI_TIMEOUTS.callbackSettleMax), 'idle' once endRun recorded the outcome.
 * isRunning is kept in lockstep: true in 'running' AND 'settling'.
 */
export type RunPhase = 'idle' | 'running' | 'settling';

/** The outcome endRun records atomically with the isRunning release. */
export interface RunOutcome {
  /** null = the run's outcome was never observed (e.g. recovered after a refresh). */
  success: boolean | null;
  callbackStatus?: CallbackStatus | null;
}

/** What was last sent to a session's terminal — the raw prompt (before skill injection) and its task type. */
export interface DispatchRecord {
  prompt: string;
  taskType?: string;
}

/** A `@@CALLBACK` marker whose POST failed; its payload is kept so it can be re-POSTed without a new run. */
export interface PendingCallback {
  callbackId: string;
  payload: string;
}

export interface CLISessionState {
  id: string;
  label: string;
  projectPath: string | null;
  claudeSessionId: string | null;
  currentExecutionId: string | null;
  currentTaskId: string | null;
  isRunning: boolean;
  /** Whether the last completed task succeeded (null if no task completed yet) */
  lastTaskSuccess: boolean | null;
  /**
   * Callback confirmation status of the last completed task (additive truth):
   * 'confirmed' | 'failed' | 'missing', or null for runs with no callback / none yet.
   * Consumers (e.g. useChecklistCLI) flip checklist UI to done only on 'confirmed'.
   */
  lastCallbackStatus?: 'confirmed' | 'failed' | 'missing' | null;
  accentColor: string;
  /** Module this session is displayed within (used by ModuleRenderer for inline visibility) */
  moduleId?: string;
  /** Unique key for fine-grained session lookup (multiple sessions in the same module) */
  sessionKey?: string;
  /** CLITaskType of the most recently dispatched task ('interactive' for free-typed prompts) — used to attribute spend per task type. */
  lastTaskType?: string;
  /** Human-readable label of the most recently dispatched task. */
  lastTaskLabel?: string;
  createdAt: number;
  lastActivityAt: number;
  enabledSkills: SkillId[];
  /** Transient: sequence number of the current/last run (bumped by beginRun). */
  runSeq?: number;
  /** Transient: lifecycle phase of the current run (see RunPhase). */
  runPhase?: RunPhase;
  /** Transient (never persisted): the last prompt dispatched to this terminal — what Retry replays. */
  lastDispatch?: DispatchRecord | null;
  /** Transient (never persisted): the last run's callback markers whose POST failed. */
  pendingCallbacks?: PendingCallback[];
}

interface CLIPanelStoreState {
  sessions: Record<string, CLISessionState>;
  tabOrder: string[];
  activeTabId: string | null;
  /** The single terminal currently shown inline (maximized) in its module view */
  maximizedTabId: string | null;
  /** Persisted inline terminal height in pixels */
  inlineTerminalHeight: number;

  createSession: (opts?: { label?: string; accentColor?: string; moduleId?: string; sessionKey?: string; projectPath?: string }) => string;
  removeSession: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  /** Show terminal inline in its owning module */
  maximizeTab: (tabId: string) => void;
  /** Hide the currently maximized terminal back to bottom bar only */
  minimizeTab: () => void;
  /**
   * The ONE run-lifecycle door. beginRun starts a run: isRunning=true, the previous
   * run's outcome is cleared, runSeq is bumped and returned (0 if no session).
   */
  beginRun: (id: string) => number;
  /** The run's stream ended; it stays isRunning while its callback settles. Stale seq → no-op. */
  settleRun: (id: string, seq: number) => void;
  /**
   * End run `seq`: isRunning=false AND its outcome in ONE store write, so every
   * subscriber that sees the edge sees this run's outcome. Stale seq / idle → no-op.
   */
  endRun: (id: string, seq: number, outcome: RunOutcome) => void;
  /** Record the prompt just dispatched to this terminal (in memory only). */
  recordDispatch: (id: string, dispatch: DispatchRecord) => void;
  /** Retain the current run's failed callback markers (in memory only). */
  setPendingCallbacks: (id: string, pending: PendingCallback[]) => void;
  /**
   * Record a callback resubmit of run `seq`: `remaining` are the payloads that still
   * failed. lastCallbackStatus becomes 'confirmed' when none remain, else 'failed'.
   * No-op when a newer run began or the session is running.
   */
  recordCallbackResubmit: (id: string, seq: number, remaining: PendingCallback[]) => void;
  setClaudeSessionId: (id: string, claudeSessionId: string) => void;
  setCurrentExecution: (id: string, executionId: string | null, taskId: string | null) => void;
  /** Record the task type + label of the prompt being dispatched (for spend attribution). */
  setSessionTaskMeta: (id: string, taskType: string, taskLabel?: string) => void;
  updateLastActivity: (id: string) => void;
  setSessionProjectPath: (id: string, path: string) => void;
  renameSession: (id: string, label: string) => void;
  setSessionSkills: (id: string, skills: SkillId[]) => void;
  setInlineTerminalHeight: (height: number) => void;
  findSessionByModule: (moduleId: string) => string | null;
  findSessionByKey: (sessionKey: string) => string | null;
  /** Remove all sessions (used during project switch to prevent cross-project leakage) */
  clearAllSessions: () => void;
}

/**
 * The persisted view of the sessions: the last dispatch's prompt and any retained
 * callback payloads are run facts for THIS page's lifetime only — prompts can be
 * large and the callback registry they pair with is in-memory — so they never
 * reach localStorage.
 */
function stripTransientRunFacts(sessions: Record<string, CLISessionState>): Record<string, CLISessionState> {
  const out: Record<string, CLISessionState> = {};
  for (const [id, sess] of Object.entries(sessions)) {
    if (sess.lastDispatch === undefined && sess.pendingCallbacks === undefined) {
      out[id] = sess;
      continue;
    }
    const persisted = { ...sess };
    delete persisted.lastDispatch;
    delete persisted.pendingCallbacks;
    out[id] = persisted;
  }
  return out;
}

let tabCounter = 0;

/** Hard cap on simultaneous terminal sessions. Exceeded only when every session is running (a running dispatch must never be clobbered). */
const MAX_SESSIONS = 8;

function generateTabId(): string {
  tabCounter++;
  return `tab-${Date.now()}-${tabCounter}`;
}

export const useCLIPanelStore = create<CLIPanelStoreState>()(
  persist(
    (set, get) => ({
      sessions: {},
      tabOrder: [],
      activeTabId: null,
      maximizedTabId: null,
      inlineTerminalHeight: 300,

      createSession: (opts) => {
        const id = generateTabId();
        const { tabOrder, sessions } = get();
        if (tabOrder.length >= MAX_SESSIONS) {
          // At cap: reuse the least-recently-active IDLE session. Never reuse a
          // running session — that would clobber its live dispatch. If every
          // session is running, fall through and create a new one (exceeding the
          // cap beats losing a dispatch).
          const idle = tabOrder
            .map((tid) => sessions[tid])
            .filter((s): s is CLISessionState => !!s && !s.isRunning)
            .sort((a, b) => a.lastActivityAt - b.lastActivityAt);
          if (idle.length > 0) return idle[0].id;
        }

        const session: CLISessionState = {
          id,
          label: opts?.label || `Terminal ${tabOrder.length + 1}`,
          projectPath: opts?.projectPath || null,
          claudeSessionId: null,
          currentExecutionId: null,
          currentTaskId: null,
          isRunning: false,
          lastTaskSuccess: null,
          lastCallbackStatus: null,
          accentColor: opts?.accentColor || MODULE_COLORS.core,
          moduleId: opts?.moduleId,
          sessionKey: opts?.sessionKey,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          enabledSkills: [],
        };

        set((state) => ({
          sessions: { ...state.sessions, [id]: session },
          tabOrder: [...state.tabOrder, id],
          activeTabId: id,
          maximizedTabId: id,
        }));

        return id;
      },

      removeSession: (id) => {
        set((state) => {
          const newSessions = { ...state.sessions };
          delete newSessions[id];
          const newOrder = state.tabOrder.filter((t) => t !== id);
          const newActive = state.activeTabId === id
            ? newOrder[newOrder.length - 1] || null
            : state.activeTabId;
          const newMaximized = state.maximizedTabId === id ? null : state.maximizedTabId;

          return {
            sessions: newSessions,
            tabOrder: newOrder,
            activeTabId: newActive,
            maximizedTabId: newMaximized,
          };
        });
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      maximizeTab: (tabId) => set({ maximizedTabId: tabId, activeTabId: tabId }),

      minimizeTab: () => set({ maximizedTabId: null }),

      beginRun: (id) => {
        const session = get().sessions[id];
        if (!session) return 0;
        const seq = (session.runSeq ?? 0) + 1;
        set((state) => ({
          sessions: {
            ...state.sessions,
            [id]: {
              ...session,
              isRunning: true,
              runPhase: 'running',
              runSeq: seq,
              // A run START clears the previous run's outcome — nobody may read it as this run's.
              lastTaskSuccess: null,
              lastCallbackStatus: null,
              pendingCallbacks: [],
              lastActivityAt: Date.now(),
            },
          },
        }));
        return seq;
      },

      settleRun: (id, seq) => {
        const session = get().sessions[id];
        if (!session || session.runSeq !== seq || session.runPhase !== 'running') return;
        set((state) => ({
          sessions: { ...state.sessions, [id]: { ...session, runPhase: 'settling', lastActivityAt: Date.now() } },
        }));
      },

      endRun: (id, seq, outcome) => {
        const session = get().sessions[id];
        if (!session || (session.runSeq ?? 0) !== seq || !session.isRunning) return;
        set((state) => ({
          sessions: {
            ...state.sessions,
            [id]: {
              ...session,
              isRunning: false,
              runPhase: 'idle',
              lastTaskSuccess: outcome.success,
              lastCallbackStatus: outcome.callbackStatus ?? null,
              lastActivityAt: Date.now(),
            },
          },
        }));
      },

      recordDispatch: (id, dispatch) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return { sessions: { ...state.sessions, [id]: { ...session, lastDispatch: dispatch } } };
        });
      },

      setPendingCallbacks: (id, pending) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return { sessions: { ...state.sessions, [id]: { ...session, pendingCallbacks: pending } } };
        });
      },

      recordCallbackResubmit: (id, seq, remaining) => {
        const session = get().sessions[id];
        if (!session || session.isRunning || (session.runSeq ?? 0) !== seq) return;
        set((state) => ({
          sessions: {
            ...state.sessions,
            [id]: {
              ...session,
              pendingCallbacks: remaining,
              lastCallbackStatus: remaining.length === 0 ? 'confirmed' : 'failed',
            },
          },
        }));
      },

      setClaudeSessionId: (id, claudeSessionId) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, claudeSessionId, lastActivityAt: Date.now() },
            },
          };
        });
      },

      setCurrentExecution: (id, executionId, taskId) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, currentExecutionId: executionId, currentTaskId: taskId, lastActivityAt: Date.now() },
            },
          };
        });
      },

      setSessionTaskMeta: (id, taskType, taskLabel) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, lastTaskType: taskType, lastTaskLabel: taskLabel ?? session.lastTaskLabel },
            },
          };
        });
      },

      updateLastActivity: (id) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, lastActivityAt: Date.now() },
            },
          };
        });
      },

      setSessionProjectPath: (id, path) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, projectPath: path },
            },
          };
        });
      },

      renameSession: (id, label) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, label },
            },
          };
        });
      },

      setSessionSkills: (id, skills) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, enabledSkills: skills },
            },
          };
        });
      },

      setInlineTerminalHeight: (height) => set({ inlineTerminalHeight: height }),

      findSessionByModule: (moduleId) => {
        const { sessions, tabOrder } = get();
        for (const tabId of tabOrder) {
          if (sessions[tabId]?.moduleId === moduleId) return tabId;
        }
        return null;
      },

      findSessionByKey: (sessionKey) => {
        const { sessions, tabOrder } = get();
        for (const tabId of tabOrder) {
          if (sessions[tabId]?.sessionKey === sessionKey) return tabId;
        }
        return null;
      },

      clearAllSessions: () => {
        set({
          sessions: {},
          tabOrder: [],
          activeTabId: null,
          maximizedTabId: null,
        });
      },
    }),
    {
      name: 'pof-cli-panel',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: stripTransientRunFacts(state.sessions),
        tabOrder: state.tabOrder,
        activeTabId: state.activeTabId,
        maximizedTabId: state.maximizedTabId,
        inlineTerminalHeight: state.inlineTerminalHeight,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<CLIPanelStoreState>) };
        // Reset transient runtime fields — sessions can't be running after a page refresh
        if (merged.sessions) {
          const cleaned: Record<string, CLISessionState> = {};
          for (const [id, sess] of Object.entries(merged.sessions)) {
            cleaned[id] = { ...sess, isRunning: false, runPhase: 'idle', runSeq: 0, lastTaskSuccess: null, currentExecutionId: null, currentTaskId: null };
          }
          merged.sessions = cleaned;
        }
        return merged;
      },
    }
  )
);
