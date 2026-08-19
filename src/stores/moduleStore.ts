'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import {
  registerModuleStore,
  scheduleAutoSave,
} from '@/services/ProjectModuleBridge';
import type { SubModuleId, ModuleHealth, TaskHistoryEntry } from '@/types/modules';
import type { ScanFinding } from '@/types/scan';

/** Semantic verification status for a checklist item */
export type VerificationStatus = 'full' | 'partial' | 'stub' | 'missing';

/**
 * localStorage key of the persisted project store. Read directly (never imported)
 * so moduleStore keeps its zero-import relationship with projectStore — the exact
 * circular dependency ProjectModuleBridge exists to break.
 */
const PROJECT_PERSIST_KEY = 'pof-project';

/** The projectPath the persisted project store was last left on, or null. */
export function readPersistedProjectPath(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(PROJECT_PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { projectPath?: unknown } };
    const path = parsed?.state?.projectPath;
    return typeof path === 'string' && path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

interface OwnerClaim {
  progressProjectPath: string | null;
  progressAdopted: true;
}

/**
 * One-time adoption of the pre-identity global progress blob.
 *
 * Before this slice, `pof-modules` held ONE global blob while the server row is
 * per-project — so existing installs have real, unattributed user work in
 * localStorage. It is attributed (never discarded) to the project that was open
 * when it was written: the persisted `projectPath`. Runs once, then `progressAdopted`
 * keeps it from ever re-claiming.
 *
 * Returns null when the state is already adopted (nothing to do).
 */
export function claimUnadoptedOwner(
  state: { progressAdopted?: boolean } | null | undefined,
  persistedProjectPath: string | null = readPersistedProjectPath(),
): OwnerClaim | null {
  if (!state || state.progressAdopted === true) return null;
  return { progressProjectPath: persistedProjectPath, progressAdopted: true };
}

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

  /**
   * Which project the in-memory progress belongs to. `null` = empty / unowned.
   * The blob above is ONE project's ground truth while the server row is
   * per-project, so every read/write is gated on this identity.
   */
  progressProjectPath: string | null;
  /** One-shot: the pre-identity global blob has been attributed to a project. */
  progressAdopted: boolean;
  /** Last load failure — surfaced with a retry, never swallowed. */
  progressLoadError: string | null;
  /** Last refused or failed save — surfaced, never swallowed. */
  progressSaveError: string | null;
  /** Path of the most recent load attempt (retry target). */
  progressLoadPath: string | null;
  /** True while loadProgress is in flight. */
  isLoadingProgress: boolean;

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
  /** Drop all per-project progress (used on project switch / reset). */
  clearProgress: () => void;
  /** Re-attempt the last failed load. */
  retryLoadProgress: () => Promise<void>;
  /** Dismiss the visible load/save error without retrying. */
  dismissProgressError: () => void;
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

      progressProjectPath: null,
      progressAdopted: false,
      progressLoadError: null,
      progressSaveError: null,
      progressLoadPath: null,
      isLoadingProgress: false,

      addHistoryEntry: (entry) => {
        set((state) => {
          const existing = state.moduleHistory[entry.moduleId] || [];
          const updated = [...existing, entry];
          // Cap at 200 entries per module — keep most recent, matching scanResults pattern
          const capped = updated.length > 200 ? updated.slice(-200) : updated;
          return {
            moduleHistory: {
              ...state.moduleHistory,
              [entry.moduleId]: capped,
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
        const {
          checklistProgress,
          moduleHealth,
          checklistVerification,
          moduleHistory,
          progressProjectPath,
        } = get();

        // Identity gate. The server POST unions checklist `true`s into the stored
        // blob and can never un-do them, so a write under the wrong path fabricates
        // permanent "done" marks for work never done. Refuse and REPORT rather than
        // writing memory into whatever project happens to be open (a stale auto-save
        // timer, or a switch whose load failed, both land here).
        if (progressProjectPath !== null && progressProjectPath !== projectPath) {
          const message =
            `Progress not saved: the loaded progress belongs to "${progressProjectPath}", ` +
            `but the open project is "${projectPath}".`;
          logger.warn(`moduleStore.saveProgress refused — ${message}`);
          set({ progressSaveError: message });
          return;
        }
        // Unowned (freshly cleared, or a first save after adoption found no project):
        // this write claims the blob for the project being written.
        if (progressProjectPath === null) set({ progressProjectPath: projectPath });

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
          set({ progressSaveError: null });
        } catch (err) {
          // localStorage still holds the state, but the DB — which every other
          // surface reads — does not. Say so instead of failing silently.
          set({
            progressSaveError: `Progress not saved to the project database: ${
              err instanceof Error ? err.message : 'unknown error'
            }`,
          });
        }
      },

      loadProgress: async (projectPath: string) => {
        if (!projectPath) return;
        set({ isLoadingProgress: true, progressLoadError: null, progressLoadPath: projectPath });
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
            progressProjectPath: projectPath,
            progressLoadError: null,
            progressSaveError: null,
            isLoadingProgress: false,
          });
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'unknown error';
          const owner = get().progressProjectPath;
          // Whatever is in memory is ANOTHER project's progress. Rendering it as
          // this project's is the corruption — drop it and say the numbers are
          // unknown, rather than letting the next auto-save write it into this row.
          const foreign = owner !== null && owner !== projectPath;
          set({
            ...(foreign
              ? {
                  checklistProgress: {},
                  moduleHealth: {},
                  checklistVerification: {},
                  moduleHistory: {},
                  scanResults: {},
                }
              : {}),
            progressProjectPath: projectPath,
            isLoadingProgress: false,
            progressLoadError: foreign
              ? `Could not load this project's progress (${reason}). Showing nothing — the previously open project's marks were discarded rather than shown here.`
              : `Could not load this project's progress (${reason}). Showing the last locally cached values, which may be out of date.`,
          });
          logger.warn(`moduleStore.loadProgress failed for "${projectPath}" — ${reason}`);
        }
      },

      clearProgress: () => {
        set({
          checklistProgress: {},
          moduleHealth: {},
          checklistVerification: {},
          moduleHistory: {},
          scanResults: {},
          progressProjectPath: null,
          progressLoadError: null,
          progressSaveError: null,
          progressLoadPath: null,
          isLoadingProgress: false,
        });
      },

      retryLoadProgress: async () => {
        const path = get().progressLoadPath;
        if (!path) return;
        await get().loadProgress(path);
      },

      dismissProgressError: () => set({ progressLoadError: null, progressSaveError: null }),
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
        // Identity of the persisted blob — without it a reload cannot tell whose
        // progress it is holding. Errors / in-flight flags are transient by design.
        progressProjectPath: state.progressProjectPath,
        progressAdopted: state.progressAdopted,
        // scanResults intentionally excluded — restored from DB on mount via ScanTab's fetchAndMergeFindings
      }),
      onRehydrateStorage: () => (state) => {
        const claim = claimUnadoptedOwner(state);
        if (!state || !claim) return;
        // Adopt (never discard) pre-identity progress into the project it was
        // written under. Mutating the just-hydrated state is intentional: this runs
        // at boot, before any subscriber can read a wrong owner.
        state.progressProjectPath = claim.progressProjectPath;
        state.progressAdopted = claim.progressAdopted;
      },
    }
  )
);

// Register with bridge so projectStore can coordinate without importing us
registerModuleStore(useModuleStore);
