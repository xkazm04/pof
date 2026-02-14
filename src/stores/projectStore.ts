'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiFetch } from '@/lib/api-utils';
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
  completeSetup: () => void;
  resetProject: () => void;
  /** Scan the project directory for existing classes, plugins, and dependencies */
  scanProject: () => Promise<void>;
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
      ueVersion: '5.5.4',
      isSetupComplete: false,
      isNewProject: true,
      setupStep: 0,

      dynamicContext: null,
      isScanning: false,
      scanError: null,

      recentProjects: [],

      setProject: (data) => set((state) => ({ ...state, ...data })),

      completeSetup: () => {
        set({ isSetupComplete: true });
        // Auto-save to recent when setup completes
        setTimeout(() => get().saveToRecent(), 100);
      },

      resetProject: () => set({
        projectName: '',
        projectPath: '',
        ueVersion: '5.5.4',
        isSetupComplete: false,
        isNewProject: true,
        setupStep: 0,
        dynamicContext: null,
        isScanning: false,
        scanError: null,
      }),

      scanProject: async () => {
        const { projectPath, projectName, isScanning, dynamicContext } = get();
        if (!projectPath || !projectName || isScanning) return;

        // Return cached if still fresh
        if (dynamicContext?.scannedAt) {
          const age = Date.now() - new Date(dynamicContext.scannedAt).getTime();
          if (age < SCAN_CACHE_MS) return;
        }

        set({ isScanning: true, scanError: null });

        try {
          const data = await apiFetch<{
            scannedAt: string;
            classes: DynamicProjectContext['classes'];
            plugins: DynamicProjectContext['plugins'];
            buildDependencies: DynamicProjectContext['buildDependencies'];
            sourceFileCount: number;
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
              classes: data.classes,
              plugins: data.plugins,
              buildDependencies: data.buildDependencies,
              sourceFileCount: data.sourceFileCount,
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

        // Grab checklist progress from moduleStore (cross-store read)
        let checklistProgress = {};
        try {
          const moduleStoreRaw = localStorage.getItem('pof-modules');
          if (moduleStoreRaw) {
            const parsed = JSON.parse(moduleStoreRaw);
            checklistProgress = parsed?.state?.checklistProgress ?? {};
          }
        } catch { /* ignore */ }

        try {
          await apiFetch('/api/recent-projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save',
              projectName,
              projectPath,
              ueVersion,
              checklistProgress,
            }),
          });
          // Refresh the list
          get().loadRecentProjects();
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

        // Save current project state before switching
        if (projectPath && isSetupComplete) {
          await get().saveToRecent();
        }

        // Touch the target project's last_opened_at
        try {
          await apiFetch('/api/recent-projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'touch',
              projectId: target.id,
            }),
          });
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

        // Trigger a scan for the new project
        setTimeout(() => get().scanProject(), 200);
        // Refresh recent list
        get().loadRecentProjects();
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
