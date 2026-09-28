/**
 * projectTransition — the ONE owner of what happens when the open project flips.
 *
 * Per-project state lives in several client caches (module progress, the CLI
 * sessions, the persisted activity feed) and one server ledger (the open
 * session-log rows). Every trigger that changes the open project runs the same
 * ordered teardown of the OUTGOING project from here, instead of each trigger
 * carrying its own partial copy of the list.
 *
 * Placement: this module sits BELOW both the identity store (projectStore calls
 * it from switchProject / resetProject) and the caches it clears (it imports
 * them). projectStore therefore never imports a cache directly.
 *
 * Adding a per-project cache = one entry in TEARDOWN_STEPS. Nothing else.
 */

import { apiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import {
  saveModuleProgress,
  cancelAutoSave,
  clearModuleProgress,
} from '@/services/ProjectModuleBridge';

/** Every trigger that changes the open project. Each runs the full teardown. */
export const PROJECT_FLIP_TRIGGERS = ['switch', 'new', 'delete'] as const;
export type ProjectFlipTrigger = (typeof PROJECT_FLIP_TRIGGERS)[number];

/**
 * Recorded exclusions — project edits that are NOT flips and run no teardown.
 * `rename` changes the display name only: projectPath (the identity every
 * per-project cache is keyed by) never moves, because no folder is renamed on
 * disk and the build command must keep pointing at the real .uproject.
 */
export const PROJECT_FLIP_EXCLUSIONS = ['rename'] as const;

/** The project being left. */
export interface OutgoingProject {
  projectPath: string;
  isSetupComplete: boolean;
}

export interface ProjectFlip {
  kind: ProjectFlipTrigger;
  from: OutgoingProject;
}

interface TeardownStep {
  id: string;
  /** A returned promise is awaited by the caller (after every step has run). */
  run: (from: OutgoingProject) => Promise<unknown> | void;
}

/**
 * Ordered. Everything here runs synchronously before the caller sets the new
 * identity; only the outgoing save's network round-trip is left pending.
 */
const TEARDOWN_STEPS: readonly TeardownStep[] = [
  {
    // saveProgress snapshots the state synchronously, so clearing right after is safe.
    id: 'save-outgoing-progress',
    run: ({ projectPath, isSetupComplete }) =>
      projectPath && isSetupComplete ? saveModuleProgress(projectPath) : undefined,
  },
  {
    // The debounced auto-save reads projectPath at FIRE time; left running it
    // would write the outgoing project's progress into the incoming one's row.
    id: 'cancel-auto-save',
    run: () => cancelAutoSave(),
  },
  {
    // One global progress blob: never render (or re-save) it as the next project's.
    id: 'clear-module-progress',
    run: () => clearModuleProgress(),
  },
  {
    // Sessions carry the outgoing projectPath; a surviving tab runs against it.
    id: 'clear-cli-sessions',
    run: () => useCLIPanelStore.getState().clearAllSessions(),
  },
  {
    // Fire-and-forget: the flip never waits on the ledger, but a failure is reported.
    id: 'cancel-open-session-log',
    run: ({ projectPath }) => {
      if (!projectPath) return;
      apiFetch('/api/session-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel-open', projectPath }),
      }).catch((err: unknown) => reportStepFailure('cancel-open-session-log', projectPath, err));
    },
  },
  {
    // Events (and their Fix prompts) were recorded against the outgoing project;
    // a Fix after the flip would dispatch them into a session on the new path.
    id: 'clear-activity-feed',
    run: () => useActivityFeedStore.getState().clearEvents(),
  },
];

/** The ordered step ids, for docs and tests. */
export const PROJECT_FLIP_STEPS: readonly string[] = TEARDOWN_STEPS.map((s) => s.id);

function reportStepFailure(stepId: string, projectPath: string, err: unknown): void {
  const reason = err instanceof Error ? err.message : String(err);
  logger.warn(`projectTransition: step "${stepId}" failed while leaving "${projectPath}" — ${reason}`);
}

/**
 * Tear down the outgoing project. Every step is isolated: a throwing step is
 * reported through logger and the remaining steps (and the flip) still run.
 *
 * The synchronous part completes before this returns, so a sync caller
 * (resetProject) may set the new identity immediately; an async caller
 * (switchProject) awaits the returned promise for the outgoing save.
 */
export function transitionProject({ kind, from }: ProjectFlip): Promise<void> {
  const pending: Promise<unknown>[] = [];
  for (const step of TEARDOWN_STEPS) {
    try {
      const result = step.run(from);
      if (result) pending.push(result.catch((err: unknown) => reportStepFailure(step.id, from.projectPath, err)));
    } catch (err) {
      reportStepFailure(step.id, from.projectPath, err);
    }
  }
  logger.debug(`projectTransition: ${kind} left "${from.projectPath || '(none)'}"`);
  return Promise.all(pending).then(() => undefined);
}
