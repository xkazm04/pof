import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowTemplate,
  WorkflowStatus,
  DAGNodeState,
} from '@/types/task-dag';
import { TaskDAGOrchestrator, validateWorkflow } from '@/lib/task-dag-orchestrator';
import { WORKFLOW_TEMPLATES, hydrateTemplate } from '@/lib/workflow-templates';

// ── Interrupted-execution vocabulary ─────────────────────────────────────────

/**
 * Why an execution ended without running to completion. `WorkflowExecution` has no
 * status for "the process that owned this run is gone", and renaming a shared type
 * would ripple through every consumer — so the persisted row carries the reason.
 */
export type ExecutionFailureReason = 'reload-interrupted';

/** A persisted execution, plus why it ended if it did not end by itself. */
export interface StoredExecution extends WorkflowExecution {
  failureReason?: ExecutionFailureReason;
}

/** Statuses that mean "an orchestrator is driving this right now". */
const LIVE_STATUSES: ReadonlyArray<WorkflowStatus> = ['running', 'paused'];

/** Cap on the persisted execution list — it used to grow without bound. */
export const MAX_KEPT_EXECUTIONS = 20;

/**
 * The orchestrator is deliberately transient, so a `running`/`paused` row read back
 * from localStorage is a run nobody owns: it is not active (no `activeExecution`),
 * not in history (history shows terminal statuses), not pausable/resumable/cancellable
 * (every action early-returns on the null orchestrator) and not even clearable
 * (`clearCompletedExecutions` kept exactly those two statuses). Demote it to a
 * terminal state that carries WHY — the shape `oneShotJobStore` already uses.
 *
 * `completedAt` is deliberately left unset: we do not know when the run died, and
 * stamping the reload time would render a duration that includes the hours the app
 * was closed. Node states are kept as-is — they are what the run actually reached.
 */
function demoteInterrupted(e: StoredExecution): StoredExecution {
  if (!LIVE_STATUSES.includes(e.status)) return e;
  return {
    ...e,
    status: 'failed',
    failureReason: 'reload-interrupted',
    runningNodeIds: [],
    currentStepLabel: 'Interrupted — the app reloaded while this workflow was running',
  };
}

// ── Stable empty constants ───────────────────────────────────────────────────

const EMPTY_EXECUTIONS: StoredExecution[] = [];
const EMPTY_CUSTOM_TEMPLATES: WorkflowTemplate[] = [];

// ── Store interface ──────────────────────────────────────────────────────────

interface TaskDAGStoreState {
  // Persisted
  executions: StoredExecution[];
  customTemplates: WorkflowTemplate[];

  // Transient (not persisted)
  activeOrchestrator: TaskDAGOrchestrator | null;
  activeExecution: WorkflowExecution | null;

  // Actions
  getTemplates: () => WorkflowTemplate[];
  startWorkflow: (templateId: string, moduleIds: string[]) => WorkflowExecution | null;
  startCustomWorkflow: (workflow: WorkflowDefinition) => WorkflowExecution | null;
  pauseWorkflow: () => void;
  resumeWorkflow: () => void;
  cancelWorkflow: () => void;
  markNodeRunning: (nodeId: string, sessionTabId: string) => void;
  markNodeCompleted: (nodeId: string, success: boolean) => void;
  getActiveExecution: () => WorkflowExecution | null;
  getNodeState: (nodeId: string) => DAGNodeState | undefined;
  clearCompletedExecutions: () => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useTaskDAGStore = create<TaskDAGStoreState>()(
  persist(
    (set, get) => ({
      executions: EMPTY_EXECUTIONS,
      customTemplates: EMPTY_CUSTOM_TEMPLATES,
      activeOrchestrator: null,
      activeExecution: null,

      getTemplates: () => {
        return [...WORKFLOW_TEMPLATES, ...get().customTemplates];
      },

      startWorkflow: (templateId, moduleIds) => {
        const templates = get().getTemplates();
        const template = templates.find((t) => t.id === templateId);
        if (!template || moduleIds.length === 0) return null;

        const hydrated = hydrateTemplate(template, moduleIds);
        const workflow: WorkflowDefinition = {
          ...hydrated,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return get().startCustomWorkflow(workflow);
      },

      startCustomWorkflow: (workflow) => {
        const errors = validateWorkflow(workflow);
        if (errors.length > 0) {
          console.error('[DAG] Workflow validation errors:', errors);
          return null;
        }

        const executionId = `exec-${Date.now()}`;
        const orchestrator = new TaskDAGOrchestrator(workflow, executionId);

        // Subscribe to orchestrator events and sync to store
        orchestrator.on((event) => {
          switch (event.type) {
            case 'workflow:progress':
            case 'workflow:completed':
            case 'workflow:failed': {
              const execution = event.execution;
              set((state) => ({
                activeExecution: execution,
                executions: state.executions.map((e) =>
                  e.id === execution.id ? execution : e
                ),
              }));
              break;
            }
            case 'node:ready': {
              // Dispatch a custom event so the UI/hook layer can pick it up
              // and create a CLI session for this node
              window.dispatchEvent(
                new CustomEvent('pof-dag-node-ready', {
                  detail: {
                    nodeId: event.nodeId,
                    node: event.node,
                    executionId,
                  },
                })
              );
              break;
            }
            case 'node:retry': {
              window.dispatchEvent(
                new CustomEvent('pof-dag-node-retry', {
                  detail: {
                    nodeId: event.nodeId,
                    retryCount: event.retryCount,
                    delayMs: event.delayMs,
                  },
                })
              );
              break;
            }
            default:
              break;
          }
        });

        const initialExecution = orchestrator.getExecution();

        set((state) => ({
          activeOrchestrator: orchestrator,
          activeExecution: initialExecution,
          // Bounded: the newest MAX_KEPT_EXECUTIONS survive (the one just started is last).
          executions: [...state.executions, initialExecution].slice(-MAX_KEPT_EXECUTIONS),
        }));

        // Start the workflow
        orchestrator.start();

        return orchestrator.getExecution();
      },

      pauseWorkflow: () => {
        const { activeOrchestrator } = get();
        if (!activeOrchestrator) return;
        activeOrchestrator.pause();
        set({ activeExecution: activeOrchestrator.getExecution() });
      },

      resumeWorkflow: () => {
        const { activeOrchestrator } = get();
        if (!activeOrchestrator) return;
        activeOrchestrator.resume();
        set({ activeExecution: activeOrchestrator.getExecution() });
      },

      cancelWorkflow: () => {
        const { activeOrchestrator } = get();
        if (!activeOrchestrator) return;
        activeOrchestrator.cancel();
        const final = activeOrchestrator.getExecution();
        set((state) => ({
          activeExecution: null,
          activeOrchestrator: null,
          executions: state.executions.map((e) =>
            e.id === final.id ? final : e
          ),
        }));
      },

      markNodeRunning: (nodeId, sessionTabId) => {
        const { activeOrchestrator } = get();
        if (!activeOrchestrator) return;
        activeOrchestrator.markNodeRunning(nodeId, sessionTabId);
      },

      markNodeCompleted: (nodeId, success) => {
        const { activeOrchestrator } = get();
        if (!activeOrchestrator) return;
        activeOrchestrator.markNodeCompleted(nodeId, success);
      },

      getActiveExecution: () => {
        return get().activeExecution;
      },

      getNodeState: (nodeId) => {
        return get().activeExecution?.nodeStates[nodeId];
      },

      clearCompletedExecutions: () => {
        // Keep only a run this session is actually driving. The old filter kept every
        // `running`/`paused` row, which made an orphaned run — the one nobody owns —
        // precisely the thing that survived the clear.
        const activeId = get().activeExecution?.id;
        set((state) => ({
          executions: state.executions.filter(
            (e) => e.id === activeId && LIVE_STATUSES.includes(e.status)
          ),
        }));
      },
    }),
    {
      name: 'pof-task-dag',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        executions: state.executions,
        customTemplates: state.customTemplates,
      }),
      merge: (persisted, current) => {
        const p = (persisted as Partial<TaskDAGStoreState> | null | undefined) ?? {};
        const executions = (p.executions ?? []).map(demoteInterrupted).slice(-MAX_KEPT_EXECUTIONS);
        return {
          ...current,
          ...p,
          executions,
          // Never rehydrated: a persisted orchestrator would be a plain object, and
          // calling pause()/cancel() on it would throw.
          activeOrchestrator: null,
          activeExecution: null,
        };
      },
    }
  )
);
