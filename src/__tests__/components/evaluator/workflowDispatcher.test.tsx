/**
 * The Workflow Orchestrator actually runs: a ready node becomes one CLI session and
 * its outcome drives the DAG. `useModuleCLI` is stubbed, so no CLI ever spawns.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import type { CLITask, CallbackStatus } from '@/lib/cli-task';
import type { DAGNode, WorkflowDefinition } from '@/types/task-dag';

interface Control { shouldDispatch?: () => boolean; onDeclined?: () => void }
type OnComplete = (success: boolean, cb?: CallbackStatus) => void;

const cli = vi.hoisted(() => ({
  executes: [] as Array<{ sessionKey: string; task: unknown; control?: unknown }>,
  complete: new Map<string, (success: boolean, cb?: unknown) => void>(),
  impl: null as null | ((task: unknown, control?: unknown) => Promise<void>),
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string; onComplete?: OnComplete }) => {
    cli.complete.set(opts.sessionKey, opts.onComplete as (s: boolean, c?: unknown) => void);
    return {
      isRunning: false,
      sendPrompt: vi.fn(),
      execute: async (task: CLITask, control?: Control) => {
        cli.executes.push({ sessionKey: opts.sessionKey, task, control });
        await cli.impl?.(task, control);
      },
    };
  },
}));

import { WorkflowDispatcher } from '@/components/modules/evaluator/WorkflowOrchestratorView/WorkflowDispatcher';
import { useTaskDAGStore } from '@/stores/taskDAGStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { workflowSessionKey } from '@/lib/workflow-dispatch';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function node(id: string, dependsOn: string[] = [], extra: Partial<DAGNode> = {}): DAGNode {
  return {
    id, label: `Step ${id}`, moduleId: 'arpg-combat', taskType: 'quick-action',
    prompt: `do ${id}`, dependsOn, ...extra,
  };
}

function workflow(nodes: DAGNode[]): WorkflowDefinition {
  return {
    id: 'wf', name: 'Test', description: '', nodes, moduleIds: ['arpg-combat'],
    createdAt: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-08T00:00:00.000Z',
  };
}

const store = () => useTaskDAGStore.getState();
const status = (id: string) => store().activeExecution?.nodeStates[id]?.status;
const dispatched = () => cli.executes.map((e) => (e.task as CLITask).label);

async function start(nodes: DAGNode[]): Promise<string> {
  let id = '';
  await act(async () => { id = store().startCustomWorkflow(workflow(nodes))!.id; });
  return id;
}

async function finish(execId: string, nodeId: string, success: boolean, cb?: CallbackStatus) {
  await act(async () => { cli.complete.get(workflowSessionKey(execId, nodeId))?.(success, cb); });
}

beforeEach(() => {
  cli.executes.length = 0;
  cli.complete.clear();
  cli.impl = null;
  useTaskDAGStore.setState({ executions: [], activeExecution: null, activeOrchestrator: null });
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
});

describe('WorkflowDispatcher', () => {
  it('turns a ready node into exactly one dispatch and marks it running with its session', async () => {
    render(<WorkflowDispatcher />);
    const exec = await start([node('a')]);

    expect(dispatched()).toEqual(['Step a']);
    expect(status('a')).toBe('running');
    const tab = store().activeExecution?.nodeStates.a.sessionTabId;
    expect(tab).toBeTruthy();
    expect(useCLIPanelStore.getState().sessions[tab!].sessionKey).toBe(workflowSessionKey(exec, 'a'));
  });

  it('dispatches the successor when a node completes, and finishes the run', async () => {
    render(<WorkflowDispatcher />);
    const exec = await start([node('a'), node('b', ['a'])]);

    expect(dispatched()).toEqual(['Step a']);
    await finish(exec, 'a', true);
    expect(status('a')).toBe('completed');
    expect(dispatched()).toEqual(['Step a', 'Step b']);

    await finish(exec, 'b', true);
    expect(store().activeExecution?.status).toBe('completed');
    expect(dispatched()).toHaveLength(2);
  });

  it('never runs more than the cap at once and drains the queue in order', async () => {
    render(<WorkflowDispatcher />);
    const exec = await start([node('a'), node('b'), node('c')]);

    expect(dispatched()).toEqual(['Step a']);
    expect(status('b')).toBe('queued');
    expect(status('c')).toBe('queued');

    await finish(exec, 'a', true);
    expect(dispatched()).toEqual(['Step a', 'Step b']);
    expect(status('c')).toBe('queued');
  });

  it('retries a failed node through its policy, then fails and skips the successor', async () => {
    vi.useFakeTimers();
    render(<WorkflowDispatcher />);
    const exec = await start([
      node('a', [], { retryPolicy: { maxRetries: 1, delayMs: 1000, backoffMultiplier: 1 } }),
      node('b', ['a']),
    ]);

    await finish(exec, 'a', false);
    expect(status('a')).toBe('retrying');
    expect(dispatched()).toEqual(['Step a']);

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(dispatched()).toEqual(['Step a', 'Step a']);
    expect(status('a')).toBe('running');

    await finish(exec, 'a', false);
    expect(status('a')).toBe('failed');
    expect(status('b')).toBe('skipped');
    expect(store().activeExecution?.status).toBe('failed');
    expect(dispatched()).toHaveLength(2);
  });

  it('treats a clean exit whose result callback did not land as a failure', async () => {
    render(<WorkflowDispatcher />);
    const exec = await start([node('a'), node('b', ['a'])]);
    await finish(exec, 'a', true, 'missing');
    expect(status('a')).toBe('failed');
    expect(dispatched()).toHaveLength(1);
  });

  it('stops dispatching on cancel, and a late completion does nothing', async () => {
    render(<WorkflowDispatcher />);
    const exec = await start([node('a'), node('b')]);
    const report = cli.complete.get(workflowSessionKey(exec, 'a'))!;

    await act(async () => { store().cancelWorkflow(); });
    expect(dispatched()).toEqual(['Step a']);

    const spy = vi.spyOn(store(), 'markNodeCompleted');
    await act(async () => { report(true); });
    expect(spy).not.toHaveBeenCalled();
    expect(dispatched()).toEqual(['Step a']);
  });

  it('does not let a cancelled run complete a same-named node of the next run', async () => {
    render(<WorkflowDispatcher />);
    const first = await start([node('a')]);
    const lateReport = cli.complete.get(workflowSessionKey(first, 'a'))!;
    await act(async () => { store().cancelWorkflow(); });

    useTaskDAGStore.setState({ activeExecution: null });
    await new Promise((r) => setTimeout(r, 2)); // exec ids are millisecond-stamped
    await start([node('a')]);
    await act(async () => { lateReport(true); });
    expect(status('a')).toBe('running');
  });

  it('asks the launch to stand down if the run was cancelled while it was preparing', async () => {
    render(<WorkflowDispatcher />);
    await start([node('a')]);
    const control = cli.executes[0].control as Control;
    expect(control.shouldDispatch?.()).toBe(true);
    await act(async () => { store().cancelWorkflow(); });
    expect(control.shouldDispatch?.()).toBe(false);
  });

  it('holds queued nodes while paused and resumes them, keeping the running node attached', async () => {
    render(<WorkflowDispatcher />);
    const exec = await start([node('a'), node('b')]);

    await act(async () => { store().pauseWorkflow(); });
    await finish(exec, 'a', true);
    expect(status('a')).toBe('completed');
    expect(dispatched()).toEqual(['Step a']);

    await act(async () => { store().resumeWorkflow(); });
    expect(dispatched()).toEqual(['Step a', 'Step b']);
  });

  it('fails the node when the spend guard is declined, instead of leaving it running', async () => {
    cli.impl = async (_t, control) => { (control as Control).onDeclined?.(); };
    render(<WorkflowDispatcher />);
    await start([node('a')]);
    expect(status('a')).toBe('failed');
  });

  it('fails the node when the launch throws', async () => {
    cli.impl = async () => { throw new Error('scan failed'); };
    render(<WorkflowDispatcher />);
    await start([node('a')]);
    expect(status('a')).toBe('failed');
  });

  it('fails a task type it cannot build, without dispatching a guess', async () => {
    render(<WorkflowDispatcher />);
    await start([node('a', [], { taskType: 'procgen-dungeon' })]);
    expect(dispatched()).toEqual([]);
    expect(status('a')).toBe('failed');
  });

  it('dispatches nothing for a run read back as interrupted after a reload', async () => {
    const running = {
      id: 'exec-old', workflowId: 'wf', workflowName: 'Old', status: 'running',
      nodeStates: { a: { nodeId: 'a', status: 'queued', retryCount: 0 } },
      totalNodes: 1, completedNodes: 0, failedNodes: 0, runningNodeIds: [],
      currentStepLabel: '', startedAt: '2026-11-08T00:00:00.000Z',
    };
    localStorage.setItem('pof-task-dag', JSON.stringify({ state: { executions: [running], customTemplates: [] }, version: 0 }));
    await act(async () => { await useTaskDAGStore.persist.rehydrate(); });
    render(<WorkflowDispatcher />);

    expect(cli.executes).toEqual([]);
    expect(store().executions[0].status).toBe('failed');
    expect(store().executions[0].failureReason).toBe('reload-interrupted');
    localStorage.removeItem('pof-task-dag');
  });

  it('cancels the run when the host goes away (a shell switch), so nothing is left orphaned', async () => {
    const { unmount } = render(<WorkflowDispatcher />);
    await start([node('a'), node('b')]);
    await act(async () => { unmount(); });
    expect(store().activeOrchestrator).toBeNull();
    expect(store().executions[0].status).toBe('cancelled');
  });
});
