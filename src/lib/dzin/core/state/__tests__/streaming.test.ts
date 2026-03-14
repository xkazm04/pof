import { describe, it, expect, vi } from 'vitest';
import type { Operation } from 'fast-json-patch';
import type {
  StateEngine,
  TaggedOperation,
  PatchGroup,
  PatchOrigin,
  WorkspaceState,
} from '../types';
import { createStreamController } from '../streaming';

// ---------------------------------------------------------------------------
// Mock StateEngine
// ---------------------------------------------------------------------------

interface RecordedUndoGroup {
  patches: TaggedOperation[];
  inversePatches: Operation[];
  origin: PatchOrigin;
  description: string;
}

function createMockEngine(
  initialState: WorkspaceState
): StateEngine<WorkspaceState> & {
  recordedUndoGroups: RecordedUndoGroup[];
} {
  let state = structuredClone(initialState);
  const recordedUndoGroups: RecordedUndoGroup[] = [];

  return {
    recordedUndoGroups,
    getState: () => structuredClone(state),
    getSnapshot: () => JSON.stringify(state),
    dispatch: vi.fn(),
    undo: vi.fn(() => null),
    redo: vi.fn(() => null),
    canUndo: () => false,
    canRedo: () => false,
    getHistory: () => [],
    subscribe: vi.fn(() => () => {}),
    _applyWithoutUndo(newDoc: WorkspaceState) {
      state = structuredClone(newDoc);
    },
    _recordUndoGroup(
      patches: TaggedOperation[],
      inversePatches: Operation[],
      origin: PatchOrigin,
      description: string
    ) {
      recordedUndoGroups.push({ patches, inversePatches, origin, description });
    },
  };
}

function makeEmptyState(): WorkspaceState {
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
// Tests
// ---------------------------------------------------------------------------

describe('StreamController', () => {
  it('createStreamController accepts a StateEngine', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    expect(controller).toBeDefined();
    expect(controller.start).toBeTypeOf('function');
    expect(controller.applyPatch).toBeTypeOf('function');
    expect(controller.commit).toBeTypeOf('function');
    expect(controller.abort).toBeTypeOf('function');
    expect(controller.isActive).toBeTypeOf('function');
  });

  it('isActive() returns false before start()', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    expect(controller.isActive()).toBe(false);
  });

  it('start(description) sets isActive() to true', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('test session');
    expect(controller.isActive()).toBe(true);
  });

  it('applyPatch() applies a single patch to state immediately via _applyWithoutUndo', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('add panel');

    const patch: Operation = {
      op: 'add',
      path: '/panels/-',
      value: {
        id: 'p1',
        type: 'scene-editor',
        slotIndex: 0,
        density: 'full',
        role: 'primary',
        uiState: {},
      },
    };
    controller.applyPatch(patch);

    const state = engine.getState();
    expect(state.panels).toHaveLength(1);
    expect(state.panels[0].id).toBe('p1');
  });

  it('applyPatch() when not active is a no-op', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);

    const patch: Operation = {
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1', type: 'x', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
    };
    controller.applyPatch(patch);

    const state = engine.getState();
    expect(state.panels).toHaveLength(0);
  });

  it('multiple applyPatch() calls accumulate patches', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('multi-panel');

    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1', type: 'a', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
    });
    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p2', type: 'b', slotIndex: 1, density: 'compact', role: 'secondary', uiState: {} },
    });

    const state = engine.getState();
    expect(state.panels).toHaveLength(2);
    expect(state.panels[0].id).toBe('p1');
    expect(state.panels[1].id).toBe('p2');
  });

  it('commit() creates a single undo group from all accumulated patches via _recordUndoGroup', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('compose workspace');

    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1', type: 'a', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
    });
    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p2', type: 'b', slotIndex: 1, density: 'compact', role: 'secondary', uiState: {} },
    });

    controller.commit();

    expect(engine.recordedUndoGroups).toHaveLength(1);
    const group = engine.recordedUndoGroups[0];
    expect(group.origin).toBe('llm');
    expect(group.description).toBe('compose workspace');
    // Should have forward patches
    expect(group.patches.length).toBeGreaterThan(0);
    // Should have inverse patches
    expect(group.inversePatches.length).toBeGreaterThan(0);
  });

  it('commit() sets isActive() to false', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('session');
    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1', type: 'a', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
    });
    controller.commit();
    expect(controller.isActive()).toBe(false);
  });

  it('commit() with no patches is a no-op (no empty undo group)', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('empty session');
    controller.commit();

    expect(engine.recordedUndoGroups).toHaveLength(0);
    expect(controller.isActive()).toBe(false);
  });

  it('abort() keeps whatever has been rendered (does NOT revert)', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('partial stream');

    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1', type: 'a', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
    });
    controller.abort();

    // State should still have the panel
    const state = engine.getState();
    expect(state.panels).toHaveLength(1);
    expect(state.panels[0].id).toBe('p1');
  });

  it('abort() creates an undo group from patches applied so far (user can undo if they want)', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('aborted stream');

    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1', type: 'a', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
    });
    controller.abort();

    expect(engine.recordedUndoGroups).toHaveLength(1);
    expect(engine.recordedUndoGroups[0].description).toBe('aborted stream');
  });

  it('abort() sets isActive() to false', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('session');
    controller.abort();
    expect(controller.isActive()).toBe(false);
  });

  it('start() while already active auto-commits previous session', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('session 1');

    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1', type: 'a', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
    });

    // Start a new session without committing
    controller.start('session 2');

    // Previous session should have been committed
    expect(engine.recordedUndoGroups).toHaveLength(1);
    expect(engine.recordedUndoGroups[0].description).toBe('session 1');
    // Should be active for the new session
    expect(controller.isActive()).toBe(true);
  });

  it('progressive panel reveal -- panels appear one-by-one', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('progressive reveal');

    // Panel 1 arrives
    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1', type: 'scene-editor', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
    });
    expect(engine.getState().panels).toHaveLength(1);

    // Panel 2 arrives
    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p2', type: 'character-detail', slotIndex: 1, density: 'compact', role: 'secondary', uiState: {} },
    });
    expect(engine.getState().panels).toHaveLength(2);

    // Panel 3 arrives
    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p3', type: 'beats-manager', slotIndex: 2, density: 'micro', role: 'auxiliary', uiState: {} },
    });
    expect(engine.getState().panels).toHaveLength(3);
  });

  it('text streaming -- replacing streamingText field via successive patches accumulates text', () => {
    const stateWithStreaming = makeEmptyState();
    stateWithStreaming.streaming = {
      active: true,
      revealedPanelIds: ['p1'],
      streamingText: { p1: '' },
    };
    const engine = createMockEngine(stateWithStreaming);
    const controller = createStreamController(engine);
    controller.start('text streaming');

    // Chunk 1
    controller.applyPatch({
      op: 'replace',
      path: '/streaming/streamingText/p1',
      value: 'Once upon',
    });
    expect(engine.getState().streaming!.streamingText.p1).toBe('Once upon');

    // Chunk 2
    controller.applyPatch({
      op: 'replace',
      path: '/streaming/streamingText/p1',
      value: 'Once upon a time',
    });
    expect(engine.getState().streaming!.streamingText.p1).toBe('Once upon a time');

    // Chunk 3
    controller.applyPatch({
      op: 'replace',
      path: '/streaming/streamingText/p1',
      value: 'Once upon a time, in a land far away',
    });
    expect(engine.getState().streaming!.streamingText.p1).toBe(
      'Once upon a time, in a land far away'
    );
  });

  it('inverse patches on commit correctly capture the diff from pre-stream to post-stream state', () => {
    const engine = createMockEngine(makeEmptyState());
    const controller = createStreamController(engine);
    controller.start('inverse test');

    controller.applyPatch({
      op: 'add',
      path: '/panels/-',
      value: { id: 'p1', type: 'a', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
    });
    controller.applyPatch({
      op: 'replace',
      path: '/layout/template',
      value: 'split-2',
    });

    controller.commit();

    const group = engine.recordedUndoGroups[0];
    // Inverse patches should revert to the pre-stream state
    // Applying inverse patches to post-stream state should yield pre-stream state
    expect(group.inversePatches.length).toBeGreaterThan(0);

    // The inverse should contain operations that remove the panel and restore template
    const hasTemplateRevert = group.inversePatches.some(
      (p) => p.path === '/layout/template'
    );
    const hasPanelRevert = group.inversePatches.some(
      (p) => p.path.startsWith('/panels')
    );
    expect(hasTemplateRevert).toBe(true);
    expect(hasPanelRevert).toBe(true);
  });
});
