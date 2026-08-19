/**
 * An interrupted workflow says it was interrupted.
 *
 * `taskDAGStore` persists `executions` — including rows whose `status` is `'running'`
 * — while the orchestrator that owns them (`activeOrchestrator` / `activeExecution`)
 * is deliberately transient. After a reload such a row is a ghost: not active, not in
 * history (history renders terminal statuses only), not pausable/resumable/cancellable
 * (every action early-returns on the null orchestrator), and NOT clearable —
 * `clearCompletedExecutions` kept exactly `running`/`paused`, so the zombie was
 * precisely what survived the clear. It accumulated in localStorage forever, invisible.
 *
 * RED against the pre-change code: after rehydrating a `running` blob the execution
 * stayed `running`, carried no reason, and `clearCompletedExecutions()` kept it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskDAGStore, MAX_KEPT_EXECUTIONS, type StoredExecution } from '@/stores/taskDAGStore';
import type { WorkflowExecution, WorkflowStatus } from '@/types/task-dag';

const STORAGE_KEY = 'pof-task-dag';

function execution(id: string, status: WorkflowStatus): WorkflowExecution {
  return {
    id,
    workflowId: 'wf',
    workflowName: `Workflow ${id}`,
    status,
    nodeStates: {
      'node-a': { nodeId: 'node-a', status: 'completed', retryCount: 0, success: true },
      'node-b': { nodeId: 'node-b', status: 'running', retryCount: 0 },
    },
    totalNodes: 2,
    completedNodes: 1,
    failedNodes: 0,
    runningNodeIds: ['node-b'],
    currentStepLabel: 'node-b',
    startedAt: '2026-08-19T10:00:00.000Z',
  };
}

async function rehydrateWith(executions: WorkflowExecution[]): Promise<void> {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: { executions, customTemplates: [] }, version: 0 }),
  );
  await useTaskDAGStore.persist.rehydrate();
}

beforeEach(() => {
  localStorage.clear();
  useTaskDAGStore.setState({
    executions: [],
    customTemplates: [],
    activeOrchestrator: null,
    activeExecution: null,
  });
});

describe('taskDAGStore — a run nobody owns is demoted on rehydrate', () => {
  it('leaves no execution `running` after a reload', async () => {
    await rehydrateWith([execution('exec-1', 'running')]);

    const executions = useTaskDAGStore.getState().executions;
    expect(executions).toHaveLength(1);
    expect(executions.every((e) => e.status !== 'running' && e.status !== 'paused')).toBe(true);
  });

  it('records WHY it ended, so it does not read as a plain failure', async () => {
    await rehydrateWith([execution('exec-1', 'running')]);

    const [e] = useTaskDAGStore.getState().executions;
    expect(e.failureReason).toBe('reload-interrupted');
    expect(e.currentStepLabel).toContain('Interrupted');
    expect(e.runningNodeIds).toEqual([]);
  });

  it('demotes a paused run too — it is just as unresumable', async () => {
    await rehydrateWith([execution('exec-1', 'paused')]);

    const [e] = useTaskDAGStore.getState().executions;
    expect(e.status).toBe('failed');
    expect(e.failureReason).toBe('reload-interrupted');
  });

  it('keeps the node states the run actually reached', async () => {
    await rehydrateWith([execution('exec-1', 'running')]);

    const [e] = useTaskDAGStore.getState().executions;
    expect(e.nodeStates['node-a'].status).toBe('completed');
    expect(e.completedNodes).toBe(1);
    expect(e.totalNodes).toBe(2);
  });

  it('does not invent a completion time it cannot know', async () => {
    await rehydrateWith([execution('exec-1', 'running')]);

    // Stamping the reload time would render a duration spanning the hours the app
    // was closed. No `completedAt` ⇒ the history row shows no duration.
    expect(useTaskDAGStore.getState().executions[0].completedAt).toBeUndefined();
  });

  it('leaves genuinely terminal rows exactly as they were', async () => {
    await rehydrateWith([
      { ...execution('done', 'completed'), completedAt: '2026-08-19T10:05:00.000Z' },
      execution('bad', 'failed'),
      execution('gone', 'cancelled'),
    ]);

    const byId = Object.fromEntries(useTaskDAGStore.getState().executions.map((e) => [e.id, e]));
    expect(byId.done.status).toBe('completed');
    expect(byId.done.completedAt).toBe('2026-08-19T10:05:00.000Z');
    expect(byId.bad.status).toBe('failed');
    expect(byId.bad.failureReason).toBeUndefined();
    expect(byId.gone.status).toBe('cancelled');
  });

  it('never rehydrates an orchestrator (a plain object would throw on pause/cancel)', async () => {
    await rehydrateWith([execution('exec-1', 'running')]);

    expect(useTaskDAGStore.getState().activeOrchestrator).toBeNull();
    expect(useTaskDAGStore.getState().activeExecution).toBeNull();
  });
});

describe('taskDAGStore — the interrupted run can finally be cleared', () => {
  it('clearCompletedExecutions removes it', async () => {
    await rehydrateWith([execution('exec-1', 'running')]);
    expect(useTaskDAGStore.getState().executions).toHaveLength(1);

    useTaskDAGStore.getState().clearCompletedExecutions();
    expect(useTaskDAGStore.getState().executions).toHaveLength(0);
  });

  it('clears an in-session orphan too — a live row nobody is driving', () => {
    // Only a run this session is actually driving (the active execution) is kept.
    useTaskDAGStore.setState({
      executions: [execution('orphan', 'running') as StoredExecution],
      activeExecution: null,
      activeOrchestrator: null,
    });

    useTaskDAGStore.getState().clearCompletedExecutions();
    expect(useTaskDAGStore.getState().executions).toHaveLength(0);
  });

  it('still keeps the run this session IS driving', () => {
    const live = execution('live', 'running') as StoredExecution;
    useTaskDAGStore.setState({ executions: [live], activeExecution: live });

    useTaskDAGStore.getState().clearCompletedExecutions();
    expect(useTaskDAGStore.getState().executions.map((e) => e.id)).toEqual(['live']);
  });
});

describe('taskDAGStore — the execution list is bounded', () => {
  it('keeps only the newest MAX_KEPT_EXECUTIONS on rehydrate', async () => {
    const many = Array.from({ length: MAX_KEPT_EXECUTIONS + 7 }, (_, i) =>
      execution(`exec-${i}`, 'completed'),
    );
    await rehydrateWith(many);

    const kept = useTaskDAGStore.getState().executions;
    expect(kept).toHaveLength(MAX_KEPT_EXECUTIONS);
    expect(kept[kept.length - 1].id).toBe(`exec-${MAX_KEPT_EXECUTIONS + 6}`);
    expect(kept[0].id).toBe('exec-7');
  });
});
