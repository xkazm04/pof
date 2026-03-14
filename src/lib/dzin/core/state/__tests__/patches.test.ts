import { describe, it, expect, vi } from 'vitest';
import { createTaggedPatch, captureUserChange } from '../patches';
import { createStateEngine } from '../engine';
import type { WorkspaceState, TaggedOperation } from '../types';

function makeInitialState(): WorkspaceState {
  return {
    layout: {
      template: 'single',
      gridTemplateRows: '1fr',
      gridTemplateColumns: '1fr',
    },
    panels: [],
    streaming: null,
  };
}

describe('createTaggedPatch', () => {
  it('tags a single Operation with origin', () => {
    const op = { op: 'replace' as const, path: '/layout/template', value: 'split-2' };
    const tagged = createTaggedPatch(op, 'llm');
    expect(tagged.op).toBe('replace');
    expect(tagged.path).toBe('/layout/template');
    expect((tagged as TaggedOperation & { value: unknown }).value).toBe('split-2');
    expect(tagged.origin).toBe('llm');
  });

  it('tags with user origin', () => {
    const op = { op: 'add' as const, path: '/panels/-', value: { id: 'x' } };
    const tagged = createTaggedPatch(op, 'user');
    expect(tagged.origin).toBe('user');
  });
});

describe('captureUserChange', () => {
  it('diffs prev/next state and dispatches patches', () => {
    const engine = createStateEngine(makeInitialState());
    const listener = vi.fn();
    engine.subscribe(listener);

    captureUserChange(engine, (state) => {
      state.layout.template = 'split-2' as WorkspaceState['layout']['template'];
    }, 'User layout change');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(engine.getState().layout.template).toBe('split-2');
    const [, group] = listener.mock.calls[0];
    expect(group.origin).toBe('user');
  });

  it('with no diff produces no dispatch', () => {
    const engine = createStateEngine(makeInitialState());
    const listener = vi.fn();
    engine.subscribe(listener);

    captureUserChange(engine, (_state) => {
      // No mutations
    }, 'No-op');

    expect(listener).not.toHaveBeenCalled();
  });
});
