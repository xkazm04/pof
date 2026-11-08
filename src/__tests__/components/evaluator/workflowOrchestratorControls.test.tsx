/**
 * The Workflow Orchestrator's own controls, rendered directly.
 * Each case was watched red against the code it replaced.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModuleSelector } from '@/components/modules/evaluator/WorkflowOrchestratorView/ModuleSelector';
import { ActiveWorkflowPanel } from '@/components/modules/evaluator/WorkflowOrchestratorView/ActiveWorkflowPanel';
import { TemplateCard } from '@/components/modules/evaluator/WorkflowOrchestratorView/TemplateCard';
import { AVAILABLE_MODULES } from '@/components/modules/evaluator/WorkflowOrchestratorView/constants';
import type { WorkflowExecution, WorkflowTemplate, DAGNodeState } from '@/types/task-dag';

afterEach(() => { cleanup(); });

describe('ModuleSelector select-all', () => {
  it('follows the selection it is given', () => {
    const onToggle = vi.fn();
    render(<ModuleSelector selected={[...AVAILABLE_MODULES]} onToggle={onToggle} onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(onToggle).toHaveBeenCalledTimes(AVAILABLE_MODULES.length);
  });

  it('selects only what is missing when one module is off', () => {
    const onToggle = vi.fn();
    render(<ModuleSelector selected={AVAILABLE_MODULES.slice(1)} onToggle={onToggle} onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(onToggle.mock.calls).toEqual([[AVAILABLE_MODULES[0]]]);
  });
});

describe('ActiveWorkflowPanel module groups', () => {
  it('recount when the orchestrator mutates nodeStates in place', () => {
    const node = (nodeId: string): DAGNodeState => ({ nodeId, status: 'running', retryCount: 0 });
    // getExecution() is a shallow copy, so this object keeps its identity for the whole run.
    const nodeStates = { 'a::x-0': node('a::x-0'), 'b::y-0': node('b::y-0') };
    const execution: WorkflowExecution = {
      id: 'e', workflowId: 'w', workflowName: 'Run', status: 'running', nodeStates,
      totalNodes: 2, completedNodes: 0, failedNodes: 0, runningNodeIds: [],
      currentStepLabel: '', startedAt: '2026-11-08T00:00:00.000Z',
    };
    const handlers = { onPause: vi.fn(), onResume: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<ActiveWorkflowPanel execution={execution} {...handlers} />);
    expect(screen.getByRole('button', { name: /^b/ }).textContent).toContain('0/1');

    nodeStates['b::y-0'].status = 'completed';
    rerender(<ActiveWorkflowPanel execution={{ ...execution, completedNodes: 1 }} {...handlers} />);
    expect(screen.getByRole('button', { name: /^b/ }).textContent).toContain('1/1');
  });
});
