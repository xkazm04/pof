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
