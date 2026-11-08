/**
 * completedNodes is documented (src/types/task-dag.ts) as including skipped nodes. A node skipped
 * inside advanceDAG must be counted before the terminal event snapshots the execution.
 */
import { describe, it, expect } from 'vitest';
import { TaskDAGOrchestrator, type OrchestratorEvent } from '@/lib/task-dag-orchestrator';
import type { DAGNode, WorkflowDefinition } from '@/types/task-dag';

function node(id: string, dependsOn: string[] = []): DAGNode {
  return { id, label: id, moduleId: 'm', taskType: 'checklist', prompt: id, dependsOn } as DAGNode;
}

function workflow(nodes: DAGNode[]): WorkflowDefinition {
  return { id: 'w', name: 'w', description: '', nodes, moduleIds: ['m'], createdAt: '', updatedAt: '' };
}

describe('TaskDAGOrchestrator counters', () => {
  it('counts a node skipped by a failed dependency (A -> B, A fails)', () => {
    const orch = new TaskDAGOrchestrator(workflow([node('A'), node('B', ['A'])]), 'e1');
    const events: OrchestratorEvent[] = [];
    orch.on((e) => events.push(e));
    orch.start();
    orch.markNodeRunning('A', 't');
    orch.markNodeCompleted('A', false);

    const exec = orch.getExecution();
    expect(exec.nodeStates.B.status).toBe('skipped');
    expect(exec.status).toBe('failed');
    expect(exec.failedNodes).toBe(1);
    expect(exec.completedNodes).toBe(1);
    const terminal = events.find((e) => e.type === 'workflow:failed');
    expect(terminal && 'execution' in terminal ? terminal.execution.completedNodes : -1).toBe(1);
  });

  it('counts a whole skipped chain (A -> B -> C)', () => {
    const orch = new TaskDAGOrchestrator(workflow([node('A'), node('B', ['A']), node('C', ['B'])]), 'e2');
    orch.start();
    orch.markNodeRunning('A', 't');
    orch.markNodeCompleted('A', false);
    expect(orch.getExecution().completedNodes).toBe(2);
  });
});
