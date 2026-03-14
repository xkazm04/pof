import { describe, it, expect, vi } from 'vitest';
import { createStateEngine } from '../engine';
import type { WorkspaceState, PatchGroup, StateEngine } from '../types';

/** Minimal initial state for testing. */
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

describe('createStateEngine', () => {
  it('initializes with provided initial state', () => {
    const initial = makeInitialState();
    const engine = createStateEngine(initial);
    expect(engine.getState()).toEqual(initial);
  });

  it('initial state is a deep clone (not same reference)', () => {
    const initial = makeInitialState();
    const engine = createStateEngine(initial);
    expect(engine.getState()).not.toBe(initial);
  });

  it('getState() returns current state (readonly -- different ref each call)', () => {
    const engine = createStateEngine(makeInitialState());
    const s1 = engine.getState();
    const s2 = engine.getState();
    expect(s1).toEqual(s2);
  });
});

describe('dispatch', () => {
  it('applies JSON Patch add operation (add panel)', () => {
    const engine = createStateEngine(makeInitialState());
    engine.dispatch(
      [
        {
          op: 'add',
          path: '/panels/-',
          value: {
            id: 'p1',
            type: 'data-list',
            slotIndex: 0,
            density: 'full',
            role: 'primary',
            uiState: {},
          },
        },
      ],
      'llm',
      'Add panel'
    );
    expect(engine.getState().panels).toHaveLength(1);
    expect(engine.getState().panels[0].id).toBe('p1');
  });

  it('applies JSON Patch replace operation (change layout template)', () => {
    const engine = createStateEngine(makeInitialState());
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'split-2' }],
      'llm',
      'Change layout'
    );
    expect(engine.getState().layout.template).toBe('split-2');
  });

  it('applies JSON Patch remove operation (remove panel)', () => {
    const initial = makeInitialState();
    initial.panels = [
      {
        id: 'p1',
        type: 'data-list',
        slotIndex: 0,
        density: 'full',
        role: 'primary',
        uiState: {},
      },
    ];
    const engine = createStateEngine(initial);
    engine.dispatch(
      [{ op: 'remove', path: '/panels/0' }],
      'llm',
      'Remove panel'
    );
    expect(engine.getState().panels).toHaveLength(0);
  });

  it('tags patches with origin=llm', () => {
    const engine = createStateEngine(makeInitialState());
    const groups: PatchGroup[] = [];
    engine.subscribe((_state, group) => {
      groups.push(group);
    });
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'split-2' }],
      'llm',
      'LLM change'
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].origin).toBe('llm');
    expect(groups[0].patches[0].origin).toBe('llm');
  });

  it('tags patches with origin=user', () => {
    const engine = createStateEngine(makeInitialState());
    const groups: PatchGroup[] = [];
    engine.subscribe((_state, group) => {
      groups.push(group);
    });
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'grid-4' }],
      'user',
      'User change'
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].origin).toBe('user');
    expect(groups[0].patches[0].origin).toBe('user');
  });

  it('notifies subscribers with new state and patch group', () => {
    const engine = createStateEngine(makeInitialState());
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'split-3' }],
      'llm',
      'Notify test'
    );
    expect(listener).toHaveBeenCalledTimes(1);
    const [state, group] = listener.mock.calls[0];
    expect(state.layout.template).toBe('split-3');
    expect(group.description).toBe('Notify test');
  });

  it('generates inverse patches for undo', () => {
    const engine = createStateEngine(makeInitialState());
    const groups: PatchGroup[] = [];
    engine.subscribe((_state, group) => {
      groups.push(group);
    });
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'triptych' }],
      'llm',
      'Track inverse'
    );
    expect(groups[0].inversePatches.length).toBeGreaterThan(0);
  });
});

describe('subscribe', () => {
  it('returns unsubscribe function that stops notifications', () => {
    const engine = createStateEngine(makeInitialState());
    const listener = vi.fn();
    const unsub = engine.subscribe(listener);
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'split-2' }],
      'llm',
      'Before unsub'
    );
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'split-3' }],
      'llm',
      'After unsub'
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('internal methods for StreamController', () => {
  it('_applyWithoutUndo exists and updates state without touching undo stack', () => {
    const engine = createStateEngine(makeInitialState());
    expect(typeof engine._applyWithoutUndo).toBe('function');
    const newState = { ...makeInitialState(), layout: { ...makeInitialState().layout, template: 'grid-4' as const } };
    engine._applyWithoutUndo(newState);
    expect(engine.getState().layout.template).toBe('grid-4');
  });

  it('_recordUndoGroup exists and can be called', () => {
    const engine = createStateEngine(makeInitialState());
    expect(typeof engine._recordUndoGroup).toBe('function');
  });
});
