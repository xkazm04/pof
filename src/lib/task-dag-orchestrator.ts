/**
 * Task DAG Orchestrator
 *
 * Manages the execution of a directed acyclic graph of CLI tasks.
 * Supports: dependency resolution, parallel execution, retry logic,
 * conditional branching, and progress tracking.
 *
 * The orchestrator does NOT directly call the CLI — it emits events that
 * the store/hooks layer translates into CLI session dispatches. This keeps
 * the engine pure and testable.
 */

import type {
  DAGNode,
  DAGNodeState,
  DAGNodeStatus,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStatus,
} from '@/types/task-dag';

// ── Events emitted by the orchestrator ───────────────────────────────────────

export type OrchestratorEvent =
  | { type: 'node:ready'; nodeId: string; node: DAGNode }
  | { type: 'node:retry'; nodeId: string; retryCount: number; delayMs: number }
  | { type: 'node:skipped'; nodeId: string; reason: string }
  | { type: 'workflow:progress'; execution: WorkflowExecution }
  | { type: 'workflow:completed'; execution: WorkflowExecution }
  | { type: 'workflow:failed'; execution: WorkflowExecution };

export type OrchestratorListener = (event: OrchestratorEvent) => void;

// ── Default retry policy ─────────────────────────────────────────────────────

const DEFAULT_RETRY = { maxRetries: 0, delayMs: 3000, backoffMultiplier: 2 };

// ── Orchestrator ─────────────────────────────────────────────────────────────

export class TaskDAGOrchestrator {
  private workflow: WorkflowDefinition;
  private execution: WorkflowExecution;
  private nodeMap: Map<string, DAGNode>;
  private listeners: OrchestratorListener[] = [];
  private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(workflow: WorkflowDefinition, executionId: string) {
    this.workflow = workflow;
    this.nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));

    const nodeStates: Record<string, DAGNodeState> = {};
    for (const node of workflow.nodes) {
      nodeStates[node.id] = {
        nodeId: node.id,
        status: 'pending',
        retryCount: 0,
      };
    }

    this.execution = {
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'idle',
      nodeStates,
      totalNodes: workflow.nodes.length,
      completedNodes: 0,
      failedNodes: 0,
      runningNodeIds: [],
      currentStepLabel: '',
      startedAt: new Date().toISOString(),
    };
  }

  // ── Public API ───────────────────────────────────────────────────────

  on(listener: OrchestratorListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getExecution(): WorkflowExecution {
    return { ...this.execution };
  }

  getNode(nodeId: string): DAGNode | undefined {
    return this.nodeMap.get(nodeId);
  }

  /** Start the workflow — finds all root nodes and queues them */
  start(): void {
    this.execution.status = 'running';
    this.execution.startedAt = new Date().toISOString();
    this.advanceDAG();
  }

  /** Pause the workflow — stops scheduling new nodes */
  pause(): void {
    this.execution.status = 'paused';
    this.emitProgress();
  }

  /** Resume a paused workflow */
  resume(): void {
    if (this.execution.status !== 'paused') return;
    this.execution.status = 'running';
    this.advanceDAG();
  }

  /** Cancel the workflow — mark all pending/queued as skipped */
  cancel(): void {
    for (const [nodeId, state] of Object.entries(this.execution.nodeStates)) {
      if (state.status === 'pending' || state.status === 'queued') {
        state.status = 'skipped';
        this.emit({ type: 'node:skipped', nodeId, reason: 'Workflow cancelled' });
      }
    }
    // Clear retry timers
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();

    this.execution.status = 'cancelled';
    this.execution.completedAt = new Date().toISOString();
    this.recomputeCounters();
    this.emitProgress();
  }

  /** Called by external code when a node starts executing (got assigned a CLI session) */
  markNodeRunning(nodeId: string, sessionTabId: string): void {
    const state = this.execution.nodeStates[nodeId];
    if (!state) return;
    state.status = 'running';
    state.sessionTabId = sessionTabId;
    state.startedAt = new Date().toISOString();
    this.execution.runningNodeIds = this.getRunningNodeIds();
    this.updateStepLabel();
    this.emitProgress();
  }

  /** Called by external code when a node completes */
  markNodeCompleted(nodeId: string, success: boolean): void {
    const state = this.execution.nodeStates[nodeId];
    const node = this.nodeMap.get(nodeId);
    if (!state || !node) return;

    if (success) {
      state.status = 'completed';
      state.success = true;
      state.completedAt = new Date().toISOString();
    } else {
      // Check retry policy
      const retry = node.retryPolicy ?? DEFAULT_RETRY;
      if (state.retryCount < retry.maxRetries) {
        state.retryCount++;
        state.status = 'retrying';
        const delay = retry.delayMs * Math.pow(retry.backoffMultiplier, state.retryCount - 1);
        this.emit({ type: 'node:retry', nodeId, retryCount: state.retryCount, delayMs: delay });

        const timer = setTimeout(() => {
          this.retryTimers.delete(nodeId);
          state.status = 'queued';
          this.emit({ type: 'node:ready', nodeId, node });
          this.emitProgress();
        }, delay);
        this.retryTimers.set(nodeId, timer);
      } else {
        state.status = 'failed';
        state.success = false;
        state.completedAt = new Date().toISOString();
        state.error = `Failed after ${state.retryCount} retries`;
      }
    }

    this.execution.runningNodeIds = this.getRunningNodeIds();
    this.recomputeCounters();
    this.updateStepLabel();

    if (this.execution.status === 'running') {
      this.advanceDAG();
    }

    this.emitProgress();
  }

  // ── Internal: DAG scheduling ─────────────────────────────────────────

  private advanceDAG(): void {
    if (this.execution.status !== 'running') return;

    const readyNodes = this.findReadyNodes();

    if (readyNodes.length === 0) {
      // Check if we're done (no running, no retrying, no queued)
      const hasActive = Object.values(this.execution.nodeStates).some(
        (s) => s.status === 'running' || s.status === 'retrying' || s.status === 'queued'
      );

      if (!hasActive) {
        const hasFailed = this.execution.failedNodes > 0;
        this.execution.status = hasFailed ? 'failed' : 'completed';
        this.execution.completedAt = new Date().toISOString();
        this.updateStepLabel();

        this.emit(
          hasFailed
            ? { type: 'workflow:failed', execution: this.getExecution() }
            : { type: 'workflow:completed', execution: this.getExecution() }
        );
      }
      return;
    }

    // Group by parallel group for concurrent execution
    for (const node of readyNodes) {
      const state = this.execution.nodeStates[node.id];
      state.status = 'queued';
      this.emit({ type: 'node:ready', nodeId: node.id, node });
    }

    this.updateStepLabel();
    this.emitProgress();
  }

  private findReadyNodes(): DAGNode[] {
    const ready: DAGNode[] = [];

    for (const node of this.workflow.nodes) {
      const state = this.execution.nodeStates[node.id];
      if (state.status !== 'pending') continue;

      // Check all dependencies completed
      const depsOk = node.dependsOn.every((depId) => {
        const depState = this.execution.nodeStates[depId];
        return depState?.status === 'completed';
      });

      if (!depsOk) {
        // Check if any dep has failed (permanently) — skip this node
        const depFailed = node.dependsOn.some((depId) => {
          const depState = this.execution.nodeStates[depId];
          return depState?.status === 'failed' || depState?.status === 'skipped';
        });

        if (depFailed) {
          state.status = 'skipped';
          state.completedAt = new Date().toISOString();
          this.emit({ type: 'node:skipped', nodeId: node.id, reason: 'Dependency failed' });
          continue;
        }

        // Check conditional branches from completed parents
        const shouldSkip = this.shouldSkipFromConditionals(node);
        if (shouldSkip) {
          state.status = 'skipped';
          state.completedAt = new Date().toISOString();
          this.emit({ type: 'node:skipped', nodeId: node.id, reason: 'Conditional branch not taken' });
        }

        continue;
      }

      ready.push(node);
    }

    return ready;
  }

  /** Check if a node should be skipped because a parent's conditional branch excludes it */
  private shouldSkipFromConditionals(node: DAGNode): boolean {
    for (const depId of node.dependsOn) {
      const depNode = this.nodeMap.get(depId);
      const depState = this.execution.nodeStates[depId];
      if (!depNode?.conditionalNext || depState?.status !== 'completed') continue;

      const success = depState.success;
      const nextIds = success
        ? depNode.conditionalNext.onSuccess
        : depNode.conditionalNext.onFailure;

      // If the parent has conditional routing and this node isn't in the list, skip it
      if (nextIds && !nextIds.includes(node.id)) {
        return true;
      }
    }
    return false;
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private getRunningNodeIds(): string[] {
    return Object.entries(this.execution.nodeStates)
      .filter(([, s]) => s.status === 'running')
      .map(([id]) => id);
  }

  private recomputeCounters(): void {
    let completed = 0;
    let failed = 0;
    for (const state of Object.values(this.execution.nodeStates)) {
      if (state.status === 'completed' || state.status === 'skipped') completed++;
      if (state.status === 'failed') failed++;
    }
    this.execution.completedNodes = completed;
    this.execution.failedNodes = failed;
  }

  private updateStepLabel(): void {
    const running = this.execution.runningNodeIds;
    const total = this.execution.totalNodes;
    const done = this.execution.completedNodes + this.execution.failedNodes;

    if (this.execution.status === 'completed') {
      this.execution.currentStepLabel = `All ${total} steps completed`;
    } else if (this.execution.status === 'failed') {
      this.execution.currentStepLabel = `${this.execution.failedNodes} failed, ${this.execution.completedNodes} completed`;
    } else if (this.execution.status === 'cancelled') {
      this.execution.currentStepLabel = 'Workflow cancelled';
    } else if (this.execution.status === 'paused') {
      this.execution.currentStepLabel = 'Workflow paused';
    } else if (running.length > 0) {
      const labels = running.map((id) => this.nodeMap.get(id)?.label ?? id);
      const runningLabel = labels.length === 1 ? labels[0] : `${labels.length} tasks in parallel`;
      this.execution.currentStepLabel = `Step ${done + 1}/${total}: ${runningLabel}`;
    } else {
      this.execution.currentStepLabel = `${done}/${total} completed`;
    }
  }

  private emit(event: OrchestratorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors should not break the orchestrator
      }
    }
  }

  private emitProgress(): void {
    this.emit({ type: 'workflow:progress', execution: this.getExecution() });
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Validate a workflow DAG (no cycles, all deps exist) */
export function validateWorkflow(workflow: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(workflow.nodes.map((n) => n.id));

  // Check all dependencies exist
  for (const node of workflow.nodes) {
    for (const depId of node.dependsOn) {
      if (!nodeIds.has(depId)) {
        errors.push(`Node "${node.label}" depends on "${depId}" which does not exist`);
      }
    }
  }

  // Check for cycles via topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const node of workflow.nodes) {
    inDegree.set(node.id, node.dependsOn.length);
    for (const depId of node.dependsOn) {
      const edges = adj.get(depId) ?? [];
      edges.push(node.id);
      adj.set(depId, edges);
    }
  }

  const queue = [...nodeIds].filter((id) => (inDegree.get(id) ?? 0) === 0);
  let processed = 0;

  while (queue.length > 0) {
    const id = queue.shift()!;
    processed++;
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  if (processed < workflow.nodes.length) {
    errors.push('Workflow contains a cycle — tasks cannot be ordered');
  }

  return errors;
}

/** Topologically sort nodes (returns node IDs in execution order) */
export function topologicalSort(nodes: DAGNode[]): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, node.dependsOn.length);
    for (const depId of node.dependsOn) {
      const edges = adj.get(depId) ?? [];
      edges.push(node.id);
      adj.set(depId, edges);
    }
  }

  const queue = nodes.filter((n) => n.dependsOn.length === 0).map((n) => n.id);
  const result: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  return result;
}
