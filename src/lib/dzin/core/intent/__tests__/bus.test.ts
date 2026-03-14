import { describe, it, expect, vi } from 'vitest';
import { createIntentBus } from '../bus';
import { createDirector, NEEDS_LLM } from '../director';
import type { Intent, IntentEvent, IntentResult } from '../types';
import type { StateEngine, WorkspaceState } from '../../state/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIntent(
  type: Intent['type'] = 'compose',
  payload: Intent['payload'] = { action: 'open', panelType: 'test' } as never,
): Intent {
  return {
    id: `test-${Date.now()}`,
    type,
    payload,
    source: 'click',
    timestamp: Date.now(),
  };
}

function mockStateEngine(): StateEngine<WorkspaceState> {
  return {
    getState: vi.fn(() => ({
      layout: { template: 'single' as const, gridTemplateRows: '1fr', gridTemplateColumns: '1fr' },
      panels: [],
      streaming: null,
    })),
    getSnapshot: vi.fn(() => '{}'),
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
// Bus Tests
// ---------------------------------------------------------------------------

describe('createIntentBus', () => {
  it('dispatches intent through director and applies resolved patches to stateEngine', () => {
    const resolvedResult: IntentResult = {
      status: 'resolved',
      patches: [{ op: 'replace', path: '/layout/template', value: 'split-2' }],
      origin: 'user',
      description: 'Switch to split-2',
    };
    const director = createDirector({
      compose: () => resolvedResult,
    });
    const engine = mockStateEngine();
    const bus = createIntentBus(director, engine);

    const result = bus.dispatch(makeIntent('compose', { action: 'set-layout', template: 'split-2' }));

    expect(result.status).toBe('resolved');
    expect(engine.dispatch).toHaveBeenCalledWith(
      resolvedResult.patches,
      'user',
      'Switch to split-2',
    );
  });

  it('tracks needs-llm intents in pendingLLM list', () => {
    const director = createDirector(); // no handlers = all NEEDS_LLM
    const engine = mockStateEngine();
    const bus = createIntentBus(director, engine);

    bus.dispatch(makeIntent('query', { action: 'search', query: 'test' }));

    const snapshot = JSON.parse(bus.getSnapshot());
    expect(snapshot.pending).toBe(1);
  });

  it('notifies subscribers with IntentEvent on each dispatch', () => {
    const director = createDirector({
      system: () => ({
        status: 'resolved' as const,
        patches: [],
        origin: 'user' as const,
        description: 'undo',
      }),
    });
    const engine = mockStateEngine();
    const bus = createIntentBus(director, engine);

    const events: IntentEvent[] = [];
    bus.subscribe((event) => events.push(event));

    const intent = makeIntent('system', { action: 'undo' });
    bus.dispatch(intent);

    expect(events).toHaveLength(1);
    expect(events[0].intent).toBe(intent);
    expect(events[0].result.status).toBe('resolved');
    expect(typeof events[0].timestamp).toBe('number');
  });

  it('getSnapshot returns JSON string with pending count and lastEvent', () => {
    const director = createDirector(); // no handlers
    const engine = mockStateEngine();
    const bus = createIntentBus(director, engine);

    // Before any dispatch
    const initial = JSON.parse(bus.getSnapshot());
    expect(initial.pending).toBe(0);
    expect(initial.lastEvent).toBeNull();

    // After dispatch
    bus.dispatch(makeIntent('navigate', { action: 'focus', panelId: 'p1' }));
    const after = JSON.parse(bus.getSnapshot());
    expect(after.pending).toBe(1);
    expect(after.lastEvent).toBeTruthy();
    expect(after.lastEvent.intent.type).toBe('navigate');
  });

  it('subscribe returns unsubscribe function that stops notifications', () => {
    const director = createDirector();
    const engine = mockStateEngine();
    const bus = createIntentBus(director, engine);

    const events: IntentEvent[] = [];
    const unsubscribe = bus.subscribe((event) => events.push(event));

    bus.dispatch(makeIntent());
    expect(events).toHaveLength(1);

    unsubscribe();
    bus.dispatch(makeIntent());
    expect(events).toHaveLength(1); // no new event
  });

  it('does not call stateEngine.dispatch for needs-llm results', () => {
    const director = createDirector(); // no handlers
    const engine = mockStateEngine();
    const bus = createIntentBus(director, engine);

    bus.dispatch(makeIntent('query', { action: 'search', query: 'hello' }));
    expect(engine.dispatch).not.toHaveBeenCalled();
  });

  it('does not call stateEngine.dispatch for error results', () => {
    const director = createDirector({
      compose: () => ({ status: 'error', error: 'bad' }),
    });
    const engine = mockStateEngine();
    const bus = createIntentBus(director, engine);

    bus.dispatch(makeIntent('compose', { action: 'open', panelType: 'nope' }));
    expect(engine.dispatch).not.toHaveBeenCalled();
  });

  it('calls stateEngine.undo() for undo description', () => {
    const director = createDirector({
      system: () => ({
        status: 'resolved' as const,
        patches: [],
        origin: 'user' as const,
        description: 'undo',
      }),
    });
    const engine = mockStateEngine();
    const bus = createIntentBus(director, engine);

    bus.dispatch(makeIntent('system', { action: 'undo' }));
    expect(engine.undo).toHaveBeenCalled();
    expect(engine.dispatch).not.toHaveBeenCalled();
  });

  it('calls stateEngine.redo() for redo description', () => {
    const director = createDirector({
      system: () => ({
        status: 'resolved' as const,
        patches: [],
        origin: 'user' as const,
        description: 'redo',
      }),
    });
    const engine = mockStateEngine();
    const bus = createIntentBus(director, engine);

    bus.dispatch(makeIntent('system', { action: 'redo' }));
    expect(engine.redo).toHaveBeenCalled();
    expect(engine.dispatch).not.toHaveBeenCalled();
  });
});
