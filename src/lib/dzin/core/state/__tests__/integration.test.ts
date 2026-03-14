import { describe, it, expect, afterEach } from 'vitest';
import { createStateEngine } from '../engine';
import { createUndoStack } from '../undo';
import { createStreamController } from '../streaming';
import {
  acquireUserLock,
  releaseUserLock,
  applyLLMPatchWithConflictCheck,
  getUserLockedPaths,
} from '../conflict';
import type { WorkspaceState } from '../types';

const INITIAL_STATE: WorkspaceState = {
  layout: { template: 'single', gridTemplateRows: '1fr', gridTemplateColumns: '1fr' },
  panels: [],
  streaming: null,
};

function makePanel(id: string, slot: number) {
  return { id, type: 'test', slotIndex: slot, density: 'full' as const, role: 'primary' as const, uiState: {} };
}

describe('integration: engine -> streaming -> undo', () => {
  afterEach(() => {
    for (const p of getUserLockedPaths()) {
      releaseUserLock(p);
    }
  });

  it('full flow: dispatch LLM patches, undo, redo, state correct at each step', () => {
    const engine = createStateEngine<WorkspaceState>(structuredClone(INITIAL_STATE), createUndoStack());

    // Dispatch 3 panels as a single LLM group
    engine.dispatch(
      [
        { op: 'add', path: '/panels/-', value: makePanel('a', 0) },
        { op: 'add', path: '/panels/-', value: makePanel('b', 1) },
        { op: 'add', path: '/panels/-', value: makePanel('c', 2) },
      ],
      'llm',
      'add 3 panels'
    );

    expect(engine.getState().panels).toHaveLength(3);

    // Undo -> 0 panels
    engine.undo();
    expect(engine.getState().panels).toHaveLength(0);

    // Redo -> 3 panels again
    engine.redo();
    expect(engine.getState().panels).toHaveLength(3);
  });

  it('streaming flow: start, apply patches progressively, commit, undo reverts entire stream', () => {
    const engine = createStateEngine<WorkspaceState>(structuredClone(INITIAL_STATE), createUndoStack());
    const stream = createStreamController(engine);

    stream.start('stream panels');
    stream.applyPatch({ op: 'add', path: '/panels/-', value: makePanel('s1', 0) });
    expect(engine.getState().panels).toHaveLength(1);

    stream.applyPatch({ op: 'add', path: '/panels/-', value: makePanel('s2', 1) });
    expect(engine.getState().panels).toHaveLength(2);

    stream.commit();

    // Undo should revert the entire stream batch
    engine.undo();
    expect(engine.getState().panels).toHaveLength(0);
  });

  it('conflict during stream: user locks path, LLM patch to that path is dropped', () => {
    const engine = createStateEngine<WorkspaceState>(structuredClone(INITIAL_STATE), createUndoStack());
    const stream = createStreamController(engine);

    // Add a panel first
    engine.dispatch(
      [{ op: 'add', path: '/panels/-', value: makePanel('x', 0) }],
      'user',
      'add panel x'
    );

    // User locks that panel
    acquireUserLock('/panels/0');

    // Start streaming
    stream.start('llm changes');

    // LLM tries to modify the locked panel -> dropped
    const result1 = applyLLMPatchWithConflictCheck(stream, {
      op: 'replace',
      path: '/panels/0/density',
      value: 'compact',
    });
    expect(result1).toBe(false);
    expect(engine.getState().panels[0].density).toBe('full'); // unchanged

    // User releases lock
    releaseUserLock('/panels/0');

    // Subsequent LLM patch should apply
    const result2 = applyLLMPatchWithConflictCheck(stream, {
      op: 'replace',
      path: '/panels/0/density',
      value: 'compact',
    });
    expect(result2).toBe(true);
    expect(engine.getState().panels[0].density).toBe('compact');

    stream.commit();
  });
});
