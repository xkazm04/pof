import { describe, it, expect } from 'vitest';
import { createIntentQueue } from '../queue';
import type { Intent } from '../types';
import type { WorkspaceState } from '../../state/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIntent(
  panelId: string,
  overrides?: Partial<Intent>,
): Intent {
  return {
    id: `intent-${Date.now()}-${Math.random()}`,
    type: 'manipulate',
    payload: { action: 'set-density', panelId, density: 'compact' },
    source: 'llm',
    timestamp: Date.now(),
    ...overrides,
  } as Intent;
}

function makeWorkspaceState(panels: Array<{ id: string; density: string }>): WorkspaceState {
  return {
    layout: {
      template: 'split-2' as const,
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr',
    },
    panels: panels.map((p, i) => ({
      id: p.id,
      type: 'test-panel',
      slotIndex: i,
      density: p.density as 'full' | 'compact' | 'micro',
      role: 'primary' as const,
      uiState: {},
    })),
    streaming: null,
  };
}

// ---------------------------------------------------------------------------
// Queue Tests
// ---------------------------------------------------------------------------

describe('createIntentQueue', () => {
  it('isBuffering returns false initially', () => {
    const queue = createIntentQueue();
    expect(queue.isBuffering()).toBe(false);
  });

  it('startBuffering causes isBuffering to return true', () => {
    const queue = createIntentQueue();
    queue.startBuffering('/panels/p1');
    expect(queue.isBuffering()).toBe(true);
  });

  it('enqueue returns true for intent targeting buffered path', () => {
    const queue = createIntentQueue();
    queue.startBuffering('/panels/p1');

    const intent = makeIntent('p1');
    expect(queue.enqueue(intent)).toBe(true);
  });

  it('enqueue returns false for intent targeting non-buffered path', () => {
    const queue = createIntentQueue();
    queue.startBuffering('/panels/p1');

    const intent = makeIntent('p2'); // different panel
    expect(queue.enqueue(intent)).toBe(false);
  });

  it('drain returns buffered intents when no conflict with current state', () => {
    const queue = createIntentQueue();
    queue.startBuffering('/panels/p1');

    const intent = makeIntent('p1');
    queue.enqueue(intent);

    // Current state matches what was there when buffering started
    const state = makeWorkspaceState([
      { id: 'p1', density: 'full' },
      { id: 'p2', density: 'full' },
    ]);

    const drained = queue.drain(state);
    expect(drained).toHaveLength(1);
    expect(drained[0].id).toBe(intent.id);
  });

  it('drain drops intents whose target panel has changed density since buffering started', () => {
    const queue = createIntentQueue();

    // Capture initial state when buffering starts
    const initialState = makeWorkspaceState([
      { id: 'p1', density: 'full' },
      { id: 'p2', density: 'full' },
    ]);
    queue.startBuffering('/panels/p1', initialState);

    const intent = makeIntent('p1');
    queue.enqueue(intent);

    // User changed density during manipulation
    const changedState = makeWorkspaceState([
      { id: 'p1', density: 'compact' }, // changed!
      { id: 'p2', density: 'full' },
    ]);

    const drained = queue.drain(changedState);
    expect(drained).toHaveLength(0); // dropped due to conflict
  });

  it('stopBuffering clears the buffer for that path', () => {
    const queue = createIntentQueue();
    queue.startBuffering('/panels/p1');

    const intent = makeIntent('p1');
    queue.enqueue(intent);

    queue.stopBuffering('/panels/p1');
    expect(queue.isBuffering()).toBe(false);

    // drain should return nothing since buffer was cleared
    const state = makeWorkspaceState([{ id: 'p1', density: 'full' }]);
    const drained = queue.drain(state);
    expect(drained).toHaveLength(0);
  });
});
