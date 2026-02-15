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

// ── Stable empty constants ───────────────────────────────────────────────────

const EMPTY_EXECUTIONS: WorkflowExecution[] = [];
const EMPTY_CUSTOM_TEMPLATES: WorkflowTemplate[] = [];

// ── Store interface ──────────────────────────────────────────────────────────

interface TaskDAGStoreState {
  // Persisted
  executions: WorkflowExecution[];
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
          executions: [...state.executions, initialExecution],
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
        set((state) => ({
          executions: state.executions.filter(
            (e) => e.status === 'running' || e.status === 'paused'
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
    }
  )
);
