/**
 * Workflow dispatch rules (pure).
 *
 * The orchestrator decides what MAY run; these rules decide what the dispatcher
 * launches next, how a DAG node becomes a CLITask, and how a session's outcome
 * reads back. `WorkflowDispatcher` is the React half.
 */
import { TaskFactory, type CallbackStatus, type CLITask } from '@/lib/cli-task';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { getModuleLabel } from '@/lib/module-registry';
import type { DAGNode, WorkflowExecution } from '@/types/task-dag';
import type { SubModuleId } from '@/types/modules';

/**
 * How many workflow nodes hold a CLI session at once. Every node is a paid, file-editing
 * agent run in one shared project tree, so the default is strictly serial; the
 * orchestrator's parallel groups queue behind this.
 */
export const MAX_CONCURRENT_WORKFLOW_NODES = 1;

const WORKFLOW_SESSION_KEY_PREFIX = 'workflow:';

/** One CLI tab per node per run (a retry reuses its node's tab). */
export function workflowSessionKey(executionId: string, nodeId: string): string {
  return `${WORKFLOW_SESSION_KEY_PREFIX}${executionId}:${nodeId}`;
}

/**
 * The node ids that should hold a runner right now: everything already running (even
 * while paused, so its completion is still heard), then queued nodes up to the cap.
 * Derived from state on every render, so there is no queue that can drift from the DAG.
 */
export function selectNodesToRun(execution: WorkflowExecution | null, cap: number): string[] {
  if (!execution || (execution.status !== 'running' && execution.status !== 'paused')) return [];
  const states = Object.values(execution.nodeStates);
  const running = states.filter((s) => s.status === 'running').map((s) => s.nodeId);
  if (execution.status === 'paused') return running;
  const queued = states.filter((s) => s.status === 'queued').map((s) => s.nodeId);
  return [...running, ...queued.slice(0, Math.max(0, cap - running.length))];
}

/** A node passes on a clean exit, unless the result callback it owed did not land. */
export function nodeRunSucceeded(success: boolean, callbackStatus?: CallbackStatus): boolean {
  return success && (callbackStatus === undefined || callbackStatus === 'confirmed');
}

/**
 * Build the node's CLITask through TaskFactory, or null when the node cannot honestly
 * run. A template's `feature-fix` / `checklist` step names no single feature or checklist
 * item, and those task types post results against one; it runs as its own prompt.
 * Types needing configuration a node does not carry (procgen, imports, scans) are null.
 */
export function buildNodeTask(node: DAGNode, appOrigin: string): CLITask | null {
  const moduleId = node.moduleId as SubModuleId;
  if (node.taskType === 'feature-review') {
    const features = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];
    if (features.length === 0) return null;
    return TaskFactory.featureReview(moduleId, node.moduleLabel ?? getModuleLabel(moduleId), features, appOrigin, node.label);
  }
  if (node.taskType === 'feature-fix' && node.featureName) {
    return TaskFactory.featureFix(moduleId, {
      featureName: node.featureName,
      status: node.featureStatus ?? 'partial',
      nextSteps: node.nextSteps ?? node.prompt,
      filePaths: node.filePaths ?? [],
      qualityScore: node.qualityScore ?? null,
    }, node.label, appOrigin);
  }
  if (!node.prompt.trim()) return null;
  switch (node.taskType) {
    case 'ask-claude':
      return TaskFactory.askClaude(moduleId, node.prompt, node.label);
    case 'quick-action':
    case 'feature-fix':
    case 'checklist':
      return TaskFactory.quickAction(moduleId, node.prompt, node.label);
    default:
      return null;
  }
}

interface SessionLike { id: string; sessionKey?: string; isRunning: boolean }

/**
 * Tabs whose terminal must stay mounted regardless of what the user is looking at: a
 * running node's tab (the terminal is what receives the prompt) and any workflow session
 * still running after its run was cancelled, so its end is still observed.
 */
export function workflowPinnedSessionIds(
  sessions: Record<string, SessionLike>,
  execution: WorkflowExecution | null,
): string[] {
  const pinned = new Set<string>();
  for (const state of Object.values(execution?.nodeStates ?? {})) {
    if (state.status === 'running' && state.sessionTabId) pinned.add(state.sessionTabId);
  }
  for (const session of Object.values(sessions)) {
    if (session.isRunning && session.sessionKey?.startsWith(WORKFLOW_SESSION_KEY_PREFIX)) pinned.add(session.id);
  }
  return [...pinned];
}
