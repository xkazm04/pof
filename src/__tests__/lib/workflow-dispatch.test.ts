import { describe, it, expect } from 'vitest';
import {
  MAX_CONCURRENT_WORKFLOW_NODES,
  buildNodeTask,
  nodeRunSucceeded,
  selectNodesToRun,
  workflowPinnedSessionIds,
  workflowSessionKey,
} from '@/lib/workflow-dispatch';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { DAGNode, DAGNodeStatus, WorkflowExecution, WorkflowStatus } from '@/types/task-dag';

function execution(status: WorkflowStatus, nodes: Record<string, DAGNodeStatus>, sessionTabId?: string): WorkflowExecution {
  return {
    id: 'e', workflowId: 'w', workflowName: 'W', status,
    nodeStates: Object.fromEntries(Object.entries(nodes).map(([nodeId, s]) => [
      nodeId, { nodeId, status: s, retryCount: 0, sessionTabId },
    ])),
    totalNodes: Object.keys(nodes).length, completedNodes: 0, failedNodes: 0, runningNodeIds: [],
    currentStepLabel: '', startedAt: '2026-11-08T00:00:00.000Z',
  };
}

const node = (extra: Partial<DAGNode>): DAGNode => ({
  id: 'n', label: 'L', moduleId: 'arpg-combat', taskType: 'quick-action', prompt: 'p', dependsOn: [], ...extra,
});

describe('selectNodesToRun', () => {
  it('has a conservative default of one node at a time', () => {
    expect(MAX_CONCURRENT_WORKFLOW_NODES).toBe(1);
  });

  it('fills the cap from the queue in order', () => {
    expect(selectNodesToRun(execution('running', { a: 'queued', b: 'queued' }), 1)).toEqual(['a']);
    expect(selectNodesToRun(execution('running', { a: 'queued', b: 'queued' }), 2)).toEqual(['a', 'b']);
  });

  it('counts running nodes against the cap and keeps them selected', () => {
    expect(selectNodesToRun(execution('running', { a: 'running', b: 'queued' }), 1)).toEqual(['a']);
  });

  it('starts nothing new while paused but keeps running nodes attached', () => {
    expect(selectNodesToRun(execution('paused', { a: 'running', b: 'queued' }), 1)).toEqual(['a']);
    expect(selectNodesToRun(execution('paused', { b: 'queued' }), 1)).toEqual([]);
  });

  it('selects nothing without a live run', () => {
    expect(selectNodesToRun(null, 1)).toEqual([]);
    expect(selectNodesToRun(execution('cancelled', { a: 'queued' }), 1)).toEqual([]);
    expect(selectNodesToRun(execution('running', { a: 'retrying', b: 'pending' }), 1)).toEqual([]);
  });
});

describe('nodeRunSucceeded', () => {
  it('requires a clean exit and no unconfirmed result callback', () => {
    expect(nodeRunSucceeded(true, undefined)).toBe(true);
    expect(nodeRunSucceeded(true, 'confirmed')).toBe(true);
    expect(nodeRunSucceeded(true, 'failed')).toBe(false);
    expect(nodeRunSucceeded(true, 'missing')).toBe(false);
    expect(nodeRunSucceeded(false, 'confirmed')).toBe(false);
  });
});

describe('buildNodeTask', () => {
  const origin = 'http://localhost:3001';

  it('builds a feature review from the module definitions, through the factory', () => {
    const task = buildNodeTask(node({ taskType: 'feature-review', prompt: '' }), origin);
    expect(task?.type).toBe('feature-review');
    expect((task as unknown as { features: unknown[] }).features).toEqual(MODULE_FEATURE_DEFINITIONS['arpg-combat']);
  });

  it('refuses a review of a module with no features', () => {
    expect(buildNodeTask(node({ taskType: 'feature-review', moduleId: 'no-such-module' }), origin)).toBeNull();
  });

  it('uses the targeted fix when the node names a feature', () => {
    const task = buildNodeTask(node({
      taskType: 'feature-fix', featureName: 'Dodge', featureStatus: 'partial', nextSteps: 'finish', filePaths: ['a.cpp'], qualityScore: 2,
    }), origin);
    expect(task?.type).toBe('feature-fix');
  });

  it('runs a template step with no single feature or checklist item as its prompt', () => {
    expect(buildNodeTask(node({ taskType: 'feature-fix', prompt: 'fix all' }), origin)?.type).toBe('quick-action');
    expect(buildNodeTask(node({ taskType: 'checklist', prompt: 'validate' }), origin)?.type).toBe('quick-action');
  });

  it('refuses types that need configuration a node cannot carry, and empty prompts', () => {
    expect(buildNodeTask(node({ taskType: 'procgen-dungeon' }), origin)).toBeNull();
    expect(buildNodeTask(node({ taskType: 'quick-action', prompt: '  ' }), origin)).toBeNull();
  });
});

describe('workflowPinnedSessionIds', () => {
  it('pins a running node\'s tab even before its CLI has started', () => {
    expect(workflowPinnedSessionIds({}, execution('running', { a: 'running' }, 'tab-1'))).toEqual(['tab-1']);
  });

  it('keeps pinning a workflow session still running after its run was cancelled', () => {
    const key = workflowSessionKey('old', 'a');
    expect(workflowPinnedSessionIds({
      'tab-2': { id: 'tab-2', sessionKey: key, isRunning: true },
      'tab-3': { id: 'tab-3', sessionKey: key, isRunning: false },
      'tab-4': { id: 'tab-4', sessionKey: 'other', isRunning: true },
    }, null)).toEqual(['tab-2']);
  });

  it('lists a tab once', () => {
    const key = workflowSessionKey('e', 'a');
    expect(workflowPinnedSessionIds(
      { 'tab-1': { id: 'tab-1', sessionKey: key, isRunning: true } },
      execution('running', { a: 'running' }, 'tab-1'),
    )).toEqual(['tab-1']);
  });
});
