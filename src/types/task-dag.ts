import type { CLITaskType } from '@/lib/cli-task';

// ── DAG Node (a single step in a workflow) ───────────────────────────────────

export type DAGNodeStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying';

export interface RetryPolicy {
  maxRetries: number;
  /** Delay before first retry in ms */
  delayMs: number;
  /** Multiply delay by this factor each retry */
  backoffMultiplier: number;
}

export interface ConditionalBranch {
  /** Advance to these node IDs on success */
  onSuccess?: string[];
  /** Advance to these node IDs on failure */
  onFailure?: string[];
}

export interface DAGNode {
  id: string;
  /** Human-readable label */
  label: string;
  /** Which module this task targets */
  moduleId: string;
  /** Task type to run */
  taskType: CLITaskType;
  /** Prompt or description (used to build the CLITask) */
  prompt: string;
  /** Node IDs that must complete (successfully) before this node can run */
  dependsOn: string[];
  /** If set, nodes in the same group can run in parallel */
  parallelGroup?: string;
  /** Retry policy on failure */
  retryPolicy?: RetryPolicy;
  /** Conditional routing after completion */
  conditionalNext?: ConditionalBranch;

  // ── Feature-fix specific fields (optional) ──
  featureName?: string;
  featureStatus?: string;
  nextSteps?: string;
  filePaths?: string[];
  qualityScore?: number | null;

  // ── Feature-review specific fields (optional) ──
  moduleLabel?: string;
}

// ── DAG Node Runtime State ───────────────────────────────────────────────────

export interface DAGNodeState {
  nodeId: string;
  status: DAGNodeStatus;
  /** CLI session tab ID assigned during execution */
  sessionTabId?: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  /** Whether the task succeeded (only set when status=completed or status=failed after retries) */
  success?: boolean;
  /** Error message if failed */
  error?: string;
}

// ── Workflow Definition (the DAG itself) ─────────────────────────────────────

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  nodes: DAGNode[];
  /** Module IDs involved in this workflow */
  moduleIds: string[];
  /** Estimated duration in minutes */
  estimatedMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Workflow Execution (a running instance of a workflow) ─────────────────────

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  /** Node state keyed by node ID */
  nodeStates: Record<string, DAGNodeState>;
  /** Total number of nodes */
  totalNodes: number;
  /** Nodes completed (including skipped) */
  completedNodes: number;
  /** Nodes that failed after all retries */
  failedNodes: number;
  /** Currently running node IDs */
  runningNodeIds: string[];
  /** Current step description for UI display */
  currentStepLabel: string;
  startedAt: string;
  completedAt?: string;
}

// ── Workflow Template (reusable, parametric) ─────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Template parameter: which modules to apply this workflow to */
  moduleScope: 'single' | 'selected' | 'all';
  /** The node definitions (moduleId may be a placeholder like '$MODULE') */
  nodes: DAGNode[];
  /** Defaults for this template */
  defaults?: {
    retryPolicy?: RetryPolicy;
    parallelExecution?: boolean;
  };
  estimatedMinutesPerModule?: number;
  createdAt: string;
}
