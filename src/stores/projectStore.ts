'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiFetch } from '@/lib/api-utils';
import {
  registerProjectStore,
  saveModuleProgress,
  loadModuleProgress,
  getChecklistProgress,
} from '@/services/ProjectModuleBridge';
import { transitionProject } from '@/services/projectTransition';
import type { DynamicProjectContext } from '@/lib/prompt-context';

export interface RecentProject {
  id: string;
  projectName: string;
  projectPath: string;
  ueVersion: string;
  lastOpenedAt: string;
  checklistTotal: number;
  checklistDone: number;
}

interface ProjectState {
  projectName: string;
  projectPath: string;
  ueVersion: string;
  isSetupComplete: boolean;
  isNewProject: boolean;
  setupStep: number;

  /** Dynamically scanned project state (classes, plugins, deps) */
  dynamicContext: DynamicProjectContext | null;
  /** Whether a scan is currently in progress */
  isScanning: boolean;
  /** Error message from the last scan attempt */
  scanError: string | null;

  /** Recently opened projects from SQLite */
  recentProjects: RecentProject[];

  setProject: (data: Partial<ProjectState>) => void;
  completeSetup: () => Promise<void>;
  /** Close the open project (New Project / Delete). Runs the flip teardown
   *  (services/projectTransition) before clearing the identity. */
  resetProject: (trigger?: 'new' | 'delete') => void;
  /** Scan the project directory for existing classes, plugins, and dependencies.
   *  Returns early while the last scan is younger than SCAN_CACHE_MS unless
   *  `force` is set (a post-run re-check that must see files the run just wrote). */
  scanProject: (opts?: { force?: boolean }) => Promise<void>;
  /** Save current project to recent_projects in SQLite */
  saveToRecent: () => Promise<void>;
  /** Load recent projects list from SQLite */
  loadRecentProjects: () => Promise<void>;
  /** Switch to a different project (saves current, restores target) */
  switchProject: (projectId: string) => Promise<void>;
  /** Remove a project from the recent list */
  removeRecentProject: (projectId: string) => Promise<void>;
}

/** Cache duration: 5 minutes. Avoids re-scanning on every prompt. */
const SCAN_CACHE_MS = 5 * 60 * 1000;

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectName: '',
      projectPath: '',
      ueVersion: '5.8.0',
      isSetupComplete: false,
      isNewProject: true,
      setupStep: 0,

      dynamicContext: null,
      isScanning: false,
      scanError: null,

      recentProjects: [],

      setProject: (data) => set((state) => ({ ...state, ...data })),

      completeSetup: async () => {
        set({ isSetupComplete: true });
        const { projectPath, isNewProject } = get();
        // Auto-save to recent when setup completes
        await get().saveToRecent();
        // For existing projects, restore saved module progress from SQLite
        // For new projects, save the (empty) initial state
        if (isNewProject) {
          await saveModuleProgress(projectPath);
        } else {
          await loadModuleProgress(projectPath);
        }
      },

      resetProject: (trigger = 'new') => {
        // The owner saves the outgoing progress (snapshot taken synchronously),
        // cancels the auto-save, clears progress / CLI sessions / activity feed
        // and cancels the open session-log rows — all before the identity below
        // is cleared. Without the progress clear, "New Project" would inherit the
        // previous project's completed checklist and write it into the new row.
        const { projectPath, isSetupComplete } = get();
        void transitionProject({ kind: trigger, from: { projectPath, isSetupComplete } });
        set({
          projectName: '',
          projectPath: '',
          ueVersion: '5.8.0',
          isSetupComplete: false,
          isNewProject: true,
          setupStep: 0,
          dynamicContext: null,
          isScanning: false,
          scanError: null,
        });
      },

      scanProject: async (opts) => {
        const { projectPath, projectName, isScanning, dynamicContext } = get();
        if (!projectPath || !projectName || isScanning) return;

        // Return cached if still fresh (a forced re-check skips the cache)
        if (!opts?.force && dynamicContext?.scannedAt) {
          const age = Date.now() - new Date(dynamicContext.scannedAt).getTime();
          if (age < SCAN_CACHE_MS) return;
        }

        set({ isScanning: true, scanError: null });

        try {
          const data = await apiFetch<{
            scannedAt: string;
            projectType?: DynamicProjectContext['projectType'];
            classes: DynamicProjectContext['classes'];
            plugins: DynamicProjectContext['plugins'];
            buildDependencies: DynamicProjectContext['buildDependencies'];
            sourceFileCount: number;
            framework?: string;
            apiRoutes?: string[];
            databaseType?: string;
            hasMcp?: boolean;
            mcpServerNames?: string[];
            mcpInstructions?: string;
          }>('/api/filesystem/scan-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath, moduleName: projectName }),
          });
          set({
            isScanning: false,
            scanError: null,
            dynamicContext: {
              scannedAt: data.scannedAt,
              projectType: data.projectType ?? 'ue5',
              classes: data.classes,
              plugins: data.plugins,
              buildDependencies: data.buildDependencies,
              sourceFileCount: data.sourceFileCount,
              framework: data.framework,
              apiRoutes: data.apiRoutes,
              databaseType: data.databaseType,
              hasMcp: data.hasMcp,
              mcpServerNames: data.mcpServerNames,
              mcpInstructions: data.mcpInstructions,
            },
          });
        } catch (err) {
          set({
            isScanning: false,
            scanError: err instanceof Error ? err.message : 'Failed to scan project',
          });
        }
      },

      saveToRecent: async () => {
        const { projectName, projectPath, ueVersion, isSetupComplete } = get();
        if (!projectName || !projectPath || !isSetupComplete) return;

        const checklistProgress = getChecklistProgress();

        try {
          // The save action returns the freshened list, so we set it directly
          // instead of issuing a follow-up GET (one round-trip instead of two).
          const { projects } = await apiFetch<{ id: string; projects?: RecentProject[] }>(
            '/api/recent-projects',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'save',
                projectName,
                projectPath,
                ueVersion,
                checklistProgress,
              }),
            }
          );
          if (projects) set({ recentProjects: projects });
        } catch {
          // Silent fail — not critical
        }
      },

      loadRecentProjects: async () => {
        try {
          const projects = await apiFetch<RecentProject[]>('/api/recent-projects');
          set({ recentProjects: projects });
        } catch {
          // Silent fail
        }
      },

      switchProject: async (projectId: string) => {
        const { recentProjects, projectPath, isSetupComplete } = get();
        const target = recentProjects.find((p) => p.id === projectId);
        if (!target) return;

        // Record the outgoing project in the recent list (reads its progress
        // synchronously), then hand the outgoing teardown to the flip owner:
        // save progress, cancel the auto-save BEFORE the new path is set, clear
        // progress / CLI sessions / activity feed, cancel the open session log.
        const savingRecent = projectPath && isSetupComplete ? get().saveToRecent() : undefined;
        await Promise.all([
          savingRecent,
          transitionProject({ kind: 'switch', from: { projectPath, isSetupComplete } }),
        ]);

        // Touch the target project's last_opened_at. The touch action returns
        // the freshened list (reflecting the new ordering), so we set it
        // directly here — no separate loadRecentProjects() GET is needed.
        try {
          const { projects } = await apiFetch<{ touched: boolean; projects?: RecentProject[] }>(
            '/api/recent-projects',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'touch',
                projectId: target.id,
              }),
            }
          );
          if (projects) set({ recentProjects: projects });
        } catch {
          // Continue switching even if touch fails
        }

        // Restore the target project's state
        set({
          projectName: target.projectName,
          projectPath: target.projectPath,
          ueVersion: target.ueVersion,
          isSetupComplete: true,
          isNewProject: false,
          setupStep: 0,
          dynamicContext: null, // Will re-scan
          isScanning: false,
          scanError: null,
        });

        // Restore module progress from SQLite for the target project
        await loadModuleProgress(target.projectPath);

        // Trigger a scan for the new project
        setTimeout(() => get().scanProject(), 200);
        // Recent list was already refreshed by the touch response above.
      },

      removeRecentProject: async (projectId: string) => {
        try {
          await apiFetch('/api/recent-projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove', projectId }),
          });
          set((state) => ({
            recentProjects: state.recentProjects.filter((p) => p.id !== projectId),
          }));
        } catch {
          // Silent fail
        }
      },
    }),
    {
      name: 'pof-project',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projectName: state.projectName,
        projectPath: state.projectPath,
        ueVersion: state.ueVersion,
        isSetupComplete: state.isSetupComplete,
        isNewProject: state.isNewProject,
        setupStep: state.setupStep,
        dynamicContext: state.dynamicContext,
      }),
    }
  )
);

// Register with bridge so moduleStore can read projectPath without importing us
registerProjectStore(useProjectStore);
