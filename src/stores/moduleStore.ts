'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SubModuleId, ModuleHealth, TaskHistoryEntry } from '@/types/modules';

/** Semantic verification status for a checklist item */
export type VerificationStatus = 'full' | 'partial' | 'stub' | 'missing';

export interface VerificationInfo {
  status: VerificationStatus;
  completeness: number;
  missingMembers: string[];
  verifiedAt: number;
}

interface ModuleState {
  moduleHistory: Record<string, TaskHistoryEntry[]>;
  moduleHealth: Record<string, ModuleHealth>;
  checklistProgress: Record<string, Record<string, boolean>>;
  /** Semantic verification results per module per item */
  checklistVerification: Record<string, Record<string, VerificationInfo>>;
  /** User preference: collapse the QuickActionsPanel sidebar */
  quickActionsPanelCollapsed: boolean;

  addHistoryEntry: (entry: TaskHistoryEntry) => void;
  updateHealth: (moduleId: SubModuleId, health: Partial<ModuleHealth>) => void;
  toggleChecklistItem: (subModuleId: string, itemId: string) => void;
  setChecklistItem: (subModuleId: string, itemId: string, checked: boolean) => void;
  setVerification: (subModuleId: string, itemId: string, info: VerificationInfo) => void;
  setQuickActionsPanelCollapsed: (collapsed: boolean) => void;
}

const defaultHealth: ModuleHealth = {
  score: 0,
  tasksCompleted: 0,
  status: 'not-started',
};

export const useModuleStore = create<ModuleState>()(
  persist(
    (set) => ({
      moduleHistory: {},
      moduleHealth: {},
      checklistProgress: {},
      checklistVerification: {},
      quickActionsPanelCollapsed: false,

      addHistoryEntry: (entry) => set((state) => {
        const existing = state.moduleHistory[entry.moduleId] || [];
        return {
          moduleHistory: {
            ...state.moduleHistory,
            [entry.moduleId]: [...existing, entry],
          },
        };
      }),

      updateHealth: (moduleId, health) => set((state) => {
        const existing = state.moduleHealth[moduleId] || defaultHealth;
        return {
          moduleHealth: {
            ...state.moduleHealth,
            [moduleId]: { ...existing, ...health },
          },
        };
      }),

      toggleChecklistItem: (subModuleId, itemId) => set((state) => {
        const moduleProgress = state.checklistProgress[subModuleId] ?? {};
        return {
          checklistProgress: {
            ...state.checklistProgress,
            [subModuleId]: {
              ...moduleProgress,
              [itemId]: !moduleProgress[itemId],
            },
          },
        };
      }),

      setChecklistItem: (subModuleId, itemId, checked) => set((state) => {
        const moduleProgress = state.checklistProgress[subModuleId] ?? {};
        if (moduleProgress[itemId] === checked) return state;
        return {
          checklistProgress: {
            ...state.checklistProgress,
            [subModuleId]: {
              ...moduleProgress,
              [itemId]: checked,
            },
          },
        };
      }),

      setVerification: (subModuleId, itemId, info) => set((state) => ({
        checklistVerification: {
          ...state.checklistVerification,
          [subModuleId]: {
            ...(state.checklistVerification[subModuleId] ?? {}),
            [itemId]: info,
          },
        },
      })),

      setQuickActionsPanelCollapsed: (collapsed) => set({ quickActionsPanelCollapsed: collapsed }),
    }),
    {
      name: 'pof-modules',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        moduleHistory: state.moduleHistory,
        moduleHealth: state.moduleHealth,
        checklistProgress: state.checklistProgress,
        checklistVerification: state.checklistVerification,
        quickActionsPanelCollapsed: state.quickActionsPanelCollapsed,
      }),
    }
  )
);
