'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SubModuleId, ModuleHealth, TaskHistoryEntry } from '@/types/modules';

interface ModuleState {
  moduleHistory: Record<string, TaskHistoryEntry[]>;
  moduleHealth: Record<string, ModuleHealth>;
  checklistProgress: Record<string, Record<string, boolean>>;

  addHistoryEntry: (entry: TaskHistoryEntry) => void;
  updateHealth: (moduleId: SubModuleId, health: Partial<ModuleHealth>) => void;
  toggleChecklistItem: (subModuleId: string, itemId: string) => void;
  setChecklistItem: (subModuleId: string, itemId: string, checked: boolean) => void;
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
    }),
    {
      name: 'pof-modules',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
