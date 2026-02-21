'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SkillId } from '../skills';

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
  accentColor: string;
  /** Module this session is displayed within (used by ModuleRenderer for inline visibility) */
  moduleId?: string;
  /** Unique key for fine-grained session lookup (multiple sessions in the same module) */
  sessionKey?: string;
  createdAt: number;
  lastActivityAt: number;
  enabledSkills: SkillId[];
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
  setSessionRunning: (id: string, running: boolean, success?: boolean) => void;
  setClaudeSessionId: (id: string, claudeSessionId: string) => void;
  setCurrentExecution: (id: string, executionId: string | null, taskId: string | null) => void;
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

let tabCounter = 0;

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
        const { tabOrder } = get();
        if (tabOrder.length >= 8) return tabOrder[tabOrder.length - 1];

        const session: CLISessionState = {
          id,
          label: opts?.label || `Terminal ${tabOrder.length + 1}`,
          projectPath: opts?.projectPath || null,
          claudeSessionId: null,
          currentExecutionId: null,
          currentTaskId: null,
          isRunning: false,
          lastTaskSuccess: null,
          accentColor: opts?.accentColor || '#3b82f6',
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

      setSessionRunning: (id, running, success) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: {
                ...session,
                isRunning: running,
                lastActivityAt: Date.now(),
                // Record success only when transitioning to stopped
                ...(running === false && success !== undefined ? { lastTaskSuccess: success } : {}),
              },
            },
          };
        });
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
        sessions: state.sessions,
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
            cleaned[id] = { ...sess, isRunning: false, lastTaskSuccess: null, currentExecutionId: null, currentTaskId: null };
          }
          merged.sessions = cleaned;
        }
        return merged;
      },
    }
  )
);
