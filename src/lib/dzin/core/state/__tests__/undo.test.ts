import { describe, it, expect, vi } from 'vitest';
import { createUndoStack } from '../undo';
import { createStateEngine } from '../engine';
import type { PatchGroup, WorkspaceState } from '../types';

/** Helper to create a dummy PatchGroup. */
function makePatchGroup(
  id: string,
  origin: 'llm' | 'user' = 'llm'
): PatchGroup {
  return {
    id,
    patches: [{ op: 'replace', path: '/layout/template', value: 'split-2', origin }],
    inversePatches: [{ op: 'replace', path: '/layout/template', value: 'single' }],
    origin,
    description: `Group ${id}`,
    timestamp: Date.now(),
  };
}

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

// ---------------------------------------------------------------------------
// UndoStack unit tests
// ---------------------------------------------------------------------------

describe('createUndoStack', () => {
  it('initializes empty stacks', () => {
    const stack = createUndoStack();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
    expect(stack.getHistory()).toEqual([]);
  });
});

describe('push', () => {
  it('adds a PatchGroup to undo stack', () => {
    const stack = createUndoStack();
    stack.push(makePatchGroup('g1'));
    expect(stack.canUndo()).toBe(true);
    expect(stack.getHistory()).toHaveLength(1);
  });

  it('clears the redo stack', () => {
    const stack = createUndoStack();
    stack.push(makePatchGroup('g1'));
    stack.undo(); // Move g1 to redo
    expect(stack.canRedo()).toBe(true);
    stack.push(makePatchGroup('g2')); // New push should clear redo
    expect(stack.canRedo()).toBe(false);
  });
});

describe('undo', () => {
  it('pops from undo stack, pushes to redo stack, returns group', () => {
    const stack = createUndoStack();
    const g1 = makePatchGroup('g1');
    stack.push(g1);
    const result = stack.undo();
    expect(result).toEqual(g1);
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(true);
  });

  it('returns null when stack is empty', () => {
    const stack = createUndoStack();
    expect(stack.undo()).toBeNull();
  });
});

describe('redo', () => {
  it('pops from redo stack, pushes to undo stack, returns group', () => {
    const stack = createUndoStack();
    const g1 = makePatchGroup('g1');
    stack.push(g1);
    stack.undo();
    const result = stack.redo();
    expect(result).toEqual(g1);
    expect(stack.canRedo()).toBe(false);
    expect(stack.canUndo()).toBe(true);
  });

  it('returns null when stack is empty', () => {
    const stack = createUndoStack();
    expect(stack.redo()).toBeNull();
  });
});

describe('canUndo / canRedo', () => {
  it('returns correct booleans', () => {
    const stack = createUndoStack();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);

    stack.push(makePatchGroup('g1'));
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);

    stack.undo();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(true);

    stack.redo();
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);
  });
});

describe('bounded history', () => {
  it('pushing 21st entry evicts the oldest (entry 0)', () => {
    const stack = createUndoStack(20);
    for (let i = 0; i < 21; i++) {
      stack.push(makePatchGroup(`g${i}`));
    }
    const history = stack.getHistory();
    expect(history).toHaveLength(20);
    // The oldest (g0) should have been evicted; first entry is g1
    expect(history[0].id).toBe('g1');
    expect(history[19].id).toBe('g20');
  });

  it('MAX_DEPTH=20, stack never exceeds 20', () => {
    const stack = createUndoStack(20);
    for (let i = 0; i < 50; i++) {
      stack.push(makePatchGroup(`g${i}`));
    }
    expect(stack.getHistory()).toHaveLength(20);
  });
});

describe('getHistory', () => {
  it('returns copy of undo stack (not reference)', () => {
    const stack = createUndoStack();
    stack.push(makePatchGroup('g1'));
    const h1 = stack.getHistory();
    const h2 = stack.getHistory();
    expect(h1).toEqual(h2);
    expect(h1).not.toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// Integration with engine
// ---------------------------------------------------------------------------

describe('integration with engine', () => {
  it('dispatch creates undo group, undo() reverts state, redo() re-applies', () => {
    const undoStack = createUndoStack();
    const engine = createStateEngine(makeInitialState(), undoStack);

    // Dispatch a change
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'split-2' }],
      'llm',
      'Change layout'
    );
    expect(engine.getState().layout.template).toBe('split-2');
    expect(engine.canUndo()).toBe(true);

    // Undo
    const undone = engine.undo();
    expect(undone).not.toBeNull();
    expect(engine.getState().layout.template).toBe('single');
    expect(engine.canRedo()).toBe(true);

    // Redo
    const redone = engine.redo();
    expect(redone).not.toBeNull();
    expect(engine.getState().layout.template).toBe('split-2');
  });

  it('LLM batch undo -- 4 patches dispatched as one group, single undo reverts all 4', () => {
    const undoStack = createUndoStack();
    const engine = createStateEngine(makeInitialState(), undoStack);

    // Dispatch 4 patches as a single batch (one dispatch call = one undo group)
    engine.dispatch(
      [
        { op: 'replace', path: '/layout/template', value: 'grid-4' },
        { op: 'replace', path: '/layout/gridTemplateRows', value: '1fr 1fr' },
        { op: 'replace', path: '/layout/gridTemplateColumns', value: '1fr 1fr' },
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
      'LLM batch operation'
    );

    expect(engine.getState().layout.template).toBe('grid-4');
    expect(engine.getState().panels).toHaveLength(1);

    // Single undo reverts all 4 changes
    engine.undo();
    expect(engine.getState().layout.template).toBe('single');
    expect(engine.getState().layout.gridTemplateRows).toBe('1fr');
    expect(engine.getState().layout.gridTemplateColumns).toBe('1fr');
    expect(engine.getState().panels).toHaveLength(0);
  });

  it('interleaved user + LLM groups -- undo walks back through both in order', () => {
    const undoStack = createUndoStack();
    const engine = createStateEngine(makeInitialState(), undoStack);

    // LLM change
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'split-2' }],
      'llm',
      'LLM change 1'
    );

    // User change
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'triptych' }],
      'user',
      'User change 1'
    );

    // LLM change
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'studio' }],
      'llm',
      'LLM change 2'
    );

    expect(engine.getState().layout.template).toBe('studio');

    // Undo walks back: studio -> triptych -> split-2 -> single
    engine.undo();
    expect(engine.getState().layout.template).toBe('triptych');
    engine.undo();
    expect(engine.getState().layout.template).toBe('split-2');
    engine.undo();
    expect(engine.getState().layout.template).toBe('single');
  });

  it('undo after 20+ dispatches only has 20 entries (oldest evicted)', () => {
    const undoStack = createUndoStack(20);
    const engine = createStateEngine(makeInitialState(), undoStack);

    for (let i = 0; i < 25; i++) {
      engine.dispatch(
        [
          {
            op: 'add',
            path: '/panels/-',
            value: {
              id: `p${i}`,
              type: 'data-list',
              slotIndex: 0,
              density: 'full',
              role: 'primary',
              uiState: {},
            },
          },
        ],
        'llm',
        `Dispatch ${i}`
      );
    }

    expect(engine.getHistory()).toHaveLength(20);
  });

  it('new dispatch clears the redo stack', () => {
    const undoStack = createUndoStack();
    const engine = createStateEngine(makeInitialState(), undoStack);

    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'split-2' }],
      'llm',
      'First'
    );
    engine.undo();
    expect(engine.canRedo()).toBe(true);

    // New dispatch should clear redo
    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'grid-4' }],
      'user',
      'New dispatch'
    );
    expect(engine.canRedo()).toBe(false);
  });

  it('undo and redo notify subscribers', () => {
    const undoStack = createUndoStack();
    const engine = createStateEngine(makeInitialState(), undoStack);
    const listener = vi.fn();

    engine.dispatch(
      [{ op: 'replace', path: '/layout/template', value: 'split-2' }],
      'llm',
      'Change'
    );
    engine.subscribe(listener);

    engine.undo();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].layout.template).toBe('single');

    engine.redo();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].layout.template).toBe('split-2');
  });
});
