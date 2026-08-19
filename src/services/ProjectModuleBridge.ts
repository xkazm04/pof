/**
 * ProjectModuleBridge — breaks the circular dependency between
 * projectStore and moduleStore.
 *
 * Both stores used to import each other:
 *   projectStore → useModuleStore (for save/load/checklistProgress)
 *   moduleStore  → useProjectStore (for projectPath in auto-save)
 *
 * This bridge provides the same coordination using late-bound
 * store.getState() calls that resolve at runtime, not import time.
 * Neither store imports the other; both import only this bridge.
 */

import { createTimerLifecycle, type Lifecycle } from '@/lib/lifecycle';

// ─── Store accessor types (avoid importing the actual stores) ────────────────

interface ModuleStoreAccessor {
  getState: () => {
    checklistProgress: Record<string, Record<string, boolean>>;
    progressProjectPath: string | null;
    saveProgress: (projectPath: string) => Promise<void>;
    loadProgress: (projectPath: string) => Promise<void>;
    clearProgress: () => void;
  };
}

interface ProjectStoreAccessor {
  getState: () => {
    projectPath: string;
  };
}

// ─── Late-bound store references ─────────────────────────────────────────────

let moduleStore: ModuleStoreAccessor | null = null;
let projectStore: ProjectStoreAccessor | null = null;

/** Called once by moduleStore at definition time. */
export function registerModuleStore(store: ModuleStoreAccessor): void {
  moduleStore = store;
}

/** Called once by projectStore at definition time. */
export function registerProjectStore(store: ProjectStoreAccessor): void {
  projectStore = store;
}

// ─── Coordination helpers (used by projectStore actions) ─────────────────────

/** Save current module progress to SQLite. */
export async function saveModuleProgress(projectPath: string): Promise<void> {
  if (!moduleStore || !projectPath) return;
  await moduleStore.getState().saveProgress(projectPath);
}

/** Restore module progress from SQLite. */
export async function loadModuleProgress(projectPath: string): Promise<void> {
  if (!moduleStore || !projectPath) return;
  await moduleStore.getState().loadProgress(projectPath);
}

/** Read the current checklist progress snapshot. */
export function getChecklistProgress(): Record<string, Record<string, boolean>> {
  if (!moduleStore) return {};
  return moduleStore.getState().checklistProgress;
}

/**
 * Drop the outgoing project's module progress.
 *
 * Progress lives in ONE global localStorage blob while the server row is
 * per-project, so a project switch / reset that leaves it in place renders (and
 * eventually WRITES) the previous project's completions as the new project's.
 */
export function clearModuleProgress(): void {
  moduleStore?.getState().clearProgress();
}

/** Which project the in-memory module progress currently belongs to (null = unowned). */
export function getProgressOwner(): string | null {
  return moduleStore?.getState().progressProjectPath ?? null;
}

// ─── Auto-save lifecycle (used by moduleStore) ──────────────────────────────

/** Lifecycle-managed debounced auto-save to SQLite. */
export const autoSaveLifecycle: Lifecycle<void> = createTimerLifecycle(() => {
  if (!projectStore || !moduleStore) return;
  const { projectPath } = projectStore.getState();
  if (projectPath) {
    moduleStore.getState().saveProgress(projectPath);
  }
}, 2000);

/** Schedule a debounced save. Called by moduleStore after every checklist mutation. */
export function scheduleAutoSave(): void {
  autoSaveLifecycle.init();
}

/**
 * Cancel a pending auto-save.
 *
 * The timer reads `projectPath` at FIRE time, not at schedule time, so a save
 * scheduled while project A was open would otherwise fire after a switch and
 * write A's in-memory progress under B's path. Every path that changes the open
 * project must call this before setting the new path.
 */
export function cancelAutoSave(): void {
  autoSaveLifecycle.dispose();
}
