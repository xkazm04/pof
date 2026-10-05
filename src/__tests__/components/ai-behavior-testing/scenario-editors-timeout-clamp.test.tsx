/**
 * ExpectedActionsEditor's timeout input shows min={1} max={60} but an HTML
 * number input's `max`/`min` are not enforced on typed input — only the
 * spinner buttons honor them. The onChange handler must clamp itself, or a
 * typed value like -10 or 9999 reaches `timeoutSeconds` unclamped and flows
 * into the generated test prompt ("must occur within -10s").
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExpectedActionsEditor } from '@/components/modules/game-systems/AITestingSandbox/ScenarioEditors';
import type { TestScenario } from '@/types/ai-testing';

afterEach(cleanup);

function makeScenario(): TestScenario {
  return {
    id: 1,
    suiteId: 1,
    name: 'Scenario',
    description: '',
    status: 'draft',
    stimuli: [],
    expectedActions: [{ id: 'exp-1', action: 'Chase', btNode: '', timeoutSeconds: 5 }],
    lastRunOutput: null,
    lastRunAt: null,
    updatedAt: null,
  } as unknown as TestScenario;
}

describe('ExpectedActionsEditor timeout clamp', () => {
  it('clamps a typed value below the stated minimum (1s)', () => {
    const onUpdate = vi.fn();
    render(<ExpectedActionsEditor scenario={makeScenario()} onAdd={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />);
    const input = screen.getByDisplayValue('5');
    fireEvent.change(input, { target: { value: '-10' } });
    expect(onUpdate).toHaveBeenCalledWith(0, { timeoutSeconds: 1 });
  });

  it('clamps a typed value above the stated maximum (60s)', () => {
    const onUpdate = vi.fn();
    render(<ExpectedActionsEditor scenario={makeScenario()} onAdd={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />);
    const input = screen.getByDisplayValue('5');
    fireEvent.change(input, { target: { value: '9999' } });
    expect(onUpdate).toHaveBeenCalledWith(0, { timeoutSeconds: 60 });
  });

  it('keeps an in-range value unchanged', () => {
    const onUpdate = vi.fn();
    render(<ExpectedActionsEditor scenario={makeScenario()} onAdd={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />);
    const input = screen.getByDisplayValue('5');
    fireEvent.change(input, { target: { value: '30' } });
    expect(onUpdate).toHaveBeenCalledWith(0, { timeoutSeconds: 30 });
  });
});
