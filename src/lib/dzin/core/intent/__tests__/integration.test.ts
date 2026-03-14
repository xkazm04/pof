import { describe, it, expect, vi } from 'vitest';
import { computeResize, initResizeState } from '../resize';
import { createIntentQueue } from '../queue';
import { createIntentBus } from '../bus';
import { createDirector } from '../director';
import { createManipulateHandler } from '../handlers/manipulate';
import { acquireUserLock, releaseUserLock } from '../../state/conflict';
import type { Intent, IntentEvent } from '../types';
import type { StateEngine, WorkspaceState } from '../../state/types';
import type { PanelDefinition } from '../../registry/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePanelDef(): PanelDefinition {
  return {
    type: 'test-panel',
    label: 'Test',
    defaultRole: 'primary',
    sizeClass: 'standard',
    complexity: 'low',
    domains: ['test'],
    description: 'Test panel',
    capabilities: [],
    useCases: [],
    inputs: [],
    outputs: [],
    densityModes: {
      full: { minWidth: 400, minHeight: 300, description: 'full' },
      compact: { minWidth: 180, minHeight: 120, description: 'compact' },
      micro: { minWidth: 60, minHeight: 40, description: 'micro' },
    },
    component: () => null,
  } as PanelDefinition;
}

function makeWorkspaceState(): WorkspaceState {
  return {
    layout: {
      template: 'split-2' as const,
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr',
    },
    panels: [
      { id: 'p1', type: 'test-panel', slotIndex: 0, density: 'full', role: 'primary', uiState: {} },
      { id: 'p2', type: 'test-panel', slotIndex: 1, density: 'full', role: 'secondary', uiState: {} },
    ],
    streaming: null,
  };
}

function mockStateEngine(state: WorkspaceState): StateEngine<WorkspaceState> {
  return {
    getState: vi.fn(() => structuredClone(state)),
    getSnapshot: vi.fn(() => JSON.stringify(state)),
    dispatch: vi.fn(),
    undo: vi.fn(() => null),
    redo: vi.fn(() => null),
    canUndo: vi.fn(() => false),
    canRedo: vi.fn(() => false),
    getHistory: vi.fn(() => []),
    subscribe: vi.fn(() => () => {}),
    _applyWithoutUndo: vi.fn(),
    _recordUndoGroup: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('Intent integration', () => {
  it('full resize flow: initResizeState, multiple computeResize calls, final dispatch through bus', () => {
    const state = makeWorkspaceState();
    const engine = mockStateEngine(state);
    const director = createDirector({
      manipulate: createManipulateHandler(() => engine.getState()),
    });
    const bus = createIntentBus(director, engine);
    const panelDef = makePanelDef();

    // 1. Init resize state
    const resizeState = initResizeState('p1', 'right', 500, 400, [0.5, 0.5], 0, panelDef, 'full');

    // 2. Simulate multiple pointer moves
    const move1 = computeResize(resizeState, 50, 0, 1000, 800);
    expect(move1.fractions[0]).toBeCloseTo(0.55, 5);

    const move2 = computeResize(resizeState, 100, 0, 1000, 800);
    expect(move2.fractions[0]).toBeCloseTo(0.6, 5);

    // 3. Final dispatch through bus on pointerup
    const result = bus.dispatch({
      id: 'resize-final',
      type: 'manipulate',
      payload: {
        action: 'resize',
        panelId: 'p1',
        width: move2.widthPx,
        height: move2.heightPx,
      },
      source: 'drag',
      timestamp: Date.now(),
    });

    expect(result.status).toBe('resolved');
    expect(engine.dispatch).toHaveBeenCalled();
  });

  it('LLM intent queued during manipulation, applied after release', () => {
    const state = makeWorkspaceState();
    const engine = mockStateEngine(state);
    const queue = createIntentQueue();
    const events: IntentEvent[] = [];
    const director = createDirector({
      manipulate: createManipulateHandler(() => engine.getState()),
    });
    const bus = createIntentBus(director, engine);
    bus.subscribe((e) => events.push(e));

    // 1. User starts resize -- lock panel and start buffering
    acquireUserLock('/panels/p1');
    queue.startBuffering('/panels/p1', state);

    // 2. LLM intent arrives targeting the same panel
    const llmIntent: Intent = {
      id: 'llm-density-change',
      type: 'manipulate',
      payload: { action: 'set-density', panelId: 'p1', density: 'compact' },
      source: 'llm',
      timestamp: Date.now(),
    };

    // Intent is buffered (not dispatched)
    const buffered = queue.enqueue(llmIntent);
    expect(buffered).toBe(true);

    // 3. User finishes resize -- release lock, drain queue
    releaseUserLock('/panels/p1');

    // State hasn't changed (user just resized within same density)
    const drained = queue.drain(state);
    expect(drained).toHaveLength(1);

    // 4. Apply drained intents
    for (const intent of drained) {
      bus.dispatch(intent);
    }

    expect(engine.dispatch).toHaveBeenCalled();
  });

  it('LLM intent dropped when conflicting with user final resize state', () => {
    const state = makeWorkspaceState();
    const queue = createIntentQueue();

    // 1. Start buffering with initial state
    queue.startBuffering('/panels/p1', state);

    // 2. LLM intent arrives
    const llmIntent: Intent = {
      id: 'llm-change',
      type: 'manipulate',
      payload: { action: 'set-density', panelId: 'p1', density: 'compact' },
      source: 'llm',
      timestamp: Date.now(),
    };
    queue.enqueue(llmIntent);

    // 3. User's resize changed the panel's density
    const changedState: WorkspaceState = {
      ...state,
      panels: [
        { ...state.panels[0], density: 'compact' }, // user changed density
        state.panels[1],
      ],
    };

    // 4. Drain -- LLM intent conflicts because panel density changed
    const drained = queue.drain(changedState);
    expect(drained).toHaveLength(0); // dropped!
  });
});
