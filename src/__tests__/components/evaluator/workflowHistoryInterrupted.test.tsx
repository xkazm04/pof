/**
 * The History section renders the interrupted run — labelled as interrupted.
 *
 * Before this change a `running` execution read back from localStorage was rendered
 * NOWHERE: the active panel needs `activeExecution` (transient, so null after a
 * reload) and History filters to completed/failed/cancelled. RED against the
 * pre-change code: the History section did not exist at all for a `running` row.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WorkflowOrchestratorView } from '@/components/modules/evaluator/WorkflowOrchestratorView';
import { useTaskDAGStore } from '@/stores/taskDAGStore';
import type { WorkflowExecution, WorkflowStatus } from '@/types/task-dag';

function execution(id: string, status: WorkflowStatus): WorkflowExecution {
  return {
    id,
    workflowId: 'wf',
    workflowName: `Workflow ${id}`,
    status,
    nodeStates: {},
    totalNodes: 3,
    completedNodes: 1,
    failedNodes: 0,
    runningNodeIds: [],
    currentStepLabel: '',
    startedAt: '2026-08-19T10:00:00.000Z',
  };
}

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => { cleanup(); });

beforeEach(() => {
  localStorage.clear();
  useTaskDAGStore.setState({
    executions: [],
    customTemplates: [],
    activeOrchestrator: null,
    activeExecution: null,
  });
});

async function rehydrateWith(executions: WorkflowExecution[]): Promise<void> {
  localStorage.setItem(
    'pof-task-dag',
    JSON.stringify({ state: { executions, customTemplates: [] }, version: 0 }),
  );
  await useTaskDAGStore.persist.rehydrate();
}

describe('WorkflowOrchestratorView — an interrupted run is visible', () => {
  it('shows the interrupted execution in History, labelled Interrupted', async () => {
    await rehydrateWith([execution('exec-1', 'running')]);

    render(<WorkflowOrchestratorView />);
    fireEvent.click(screen.getByTestId('pof-dag-history-toggle'));

    const row = screen.getByTestId('pof-dag-history-exec-1');
    expect(row.getAttribute('data-interrupted')).toBe('true');
    expect(row.textContent).toContain('Interrupted');
    // Not blamed as a plain failure…
    expect(row.textContent).not.toContain('Failed');
    // …and honest about what it can no longer do.
    expect(row.textContent).toContain('not resumable');
    // The node states it reached are still reported.
    expect(row.textContent).toContain('1/3');
  });

  it('still labels a genuine failure as Failed', async () => {
    await rehydrateWith([execution('exec-2', 'failed')]);

    render(<WorkflowOrchestratorView />);
    fireEvent.click(screen.getByTestId('pof-dag-history-toggle'));

    const row = screen.getByTestId('pof-dag-history-exec-2');
    expect(row.textContent).toContain('Failed');
    expect(row.getAttribute('data-interrupted')).toBeNull();
  });
});
