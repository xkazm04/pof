'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiFetch } from '@/lib/api-utils';
import {
  registerModuleStore,
  scheduleAutoSave,
} from '@/services/ProjectModuleBridge';
import type { SubModuleId, ModuleHealth, TaskHistoryEntry } from '@/types/modules';
import type { ScanFinding } from '@/types/scan';

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
  /** Accumulated scan findings per module */
  scanResults: Record<string, ScanFinding[]>;

  addHistoryEntry: (entry: TaskHistoryEntry) => void;
  updateHealth: (moduleId: SubModuleId, health: Partial<ModuleHealth>) => void;
  toggleChecklistItem: (subModuleId: SubModuleId, itemId: string) => void;
  setChecklistItem: (subModuleId: SubModuleId, itemId: string, checked: boolean) => void;
  setVerification: (subModuleId: SubModuleId, itemId: string, info: VerificationInfo) => void;
  setQuickActionsPanelCollapsed: (collapsed: boolean) => void;
  addScanFindings: (moduleId: SubModuleId, findings: ScanFinding[]) => void;
  clearScanFindings: (moduleId: SubModuleId) => void;
  resolveScanFinding: (moduleId: SubModuleId, findingId: string) => void;

  /** Persist all module progress to SQLite for the given project path */
  saveProgress: (projectPath: string) => Promise<void>;
  /** Restore module progress from SQLite for the given project path */
  loadProgress: (projectPath: string) => Promise<void>;
}

const defaultHealth: ModuleHealth = {
  score: 0,
  tasksCompleted: 0,
  status: 'not-started',
};

export const useModuleStore = create<ModuleState>()(
  persist(
    (set, get) => ({
      moduleHistory: {},
      moduleHealth: {},
      checklistProgress: {},
      checklistVerification: {},
      quickActionsPanelCollapsed: true,
      scanResults: {},

      addHistoryEntry: (entry) => {
        set((state) => {
          const existing = state.moduleHistory[entry.moduleId] || [];
          return {
            moduleHistory: {
              ...state.moduleHistory,
              [entry.moduleId]: [...existing, entry],
            },
          };
        });
        scheduleAutoSave();
      },

      updateHealth: (moduleId, health) => {
        set((state) => {
          const existing = state.moduleHealth[moduleId] || defaultHealth;
          return {
            moduleHealth: {
              ...state.moduleHealth,
              [moduleId]: { ...existing, ...health },
            },
          };
        });
        scheduleAutoSave();
      },

      toggleChecklistItem: (subModuleId, itemId) => {
        set((state) => {
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
        });
        scheduleAutoSave();
      },

      setChecklistItem: (subModuleId, itemId, checked) => {
        set((state) => {
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
        });
        scheduleAutoSave();
      },

      setVerification: (subModuleId, itemId, info) => {
        set((state) => ({
          checklistVerification: {
            ...state.checklistVerification,
            [subModuleId]: {
              ...(state.checklistVerification[subModuleId] ?? {}),
              [itemId]: info,
            },
          },
        }));
        scheduleAutoSave();
      },

      setQuickActionsPanelCollapsed: (collapsed) => set({ quickActionsPanelCollapsed: collapsed }),

      addScanFindings: (moduleId, findings) => {
        set((state) => {
          const existing = state.scanResults[moduleId] ?? [];
          // Deduplicate by description+file to avoid re-adding the same finding
          const existingKeys = new Set(existing.map((f) => `${f.file}::${f.description}`));
          const novel = findings.filter((f) => !existingKeys.has(`${f.file}::${f.description}`));
          // Skip update when no novel findings — avoids creating a new array reference
          if (novel.length === 0) return state;
          const merged = [...existing, ...novel];
          // Cap at 100 findings per module — keep most recent
          const capped = merged.length > 100 ? merged.slice(-100) : merged;
          return {
            scanResults: {
              ...state.scanResults,
              [moduleId]: capped,
            },
          };
        });
      },

      clearScanFindings: (moduleId) => {
        set((state) => ({
          scanResults: { ...state.scanResults, [moduleId]: [] },
        }));
      },

      resolveScanFinding: (moduleId, findingId) => {
        set((state) => {
          const findings = (state.scanResults[moduleId] ?? []).map((f) =>
            f.id === findingId ? { ...f, resolvedAt: new Date().toISOString() } : f,
          );
          return { scanResults: { ...state.scanResults, [moduleId]: findings } };
        });
      },

      saveProgress: async (projectPath: string) => {
        if (!projectPath) return;
        const { checklistProgress, moduleHealth, checklistVerification, moduleHistory } = get();
        try {
          await apiFetch('/api/project-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectPath,
              checklistProgress,
              moduleHealth,
              checklistVerification,
              moduleHistory,
            }),
          });
        } catch {
          // Silent fail — localStorage is still the primary store
        }
      },

      loadProgress: async (projectPath: string) => {
        if (!projectPath) return;
        try {
          const data = await apiFetch<{
            checklistProgress: Record<string, Record<string, boolean>>;
            moduleHealth: Record<string, ModuleHealth>;
            checklistVerification: Record<string, Record<string, VerificationInfo>>;
            moduleHistory: Record<string, TaskHistoryEntry[]>;
          }>(`/api/project-progress?path=${encodeURIComponent(projectPath)}`);

          set({
            checklistProgress: data.checklistProgress ?? {},
            moduleHealth: data.moduleHealth ?? {},
            checklistVerification: data.checklistVerification ?? {},
            moduleHistory: data.moduleHistory ?? {},
          });
        } catch {
          // Silent fail — keep whatever localStorage had
        }
      },
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
        // scanResults intentionally excluded — restored from DB on mount via ScanTab's fetchAndMergeFindings
      }),
    }
  )
);

// Register with bridge so projectStore can coordinate without importing us
registerModuleStore(useModuleStore);
