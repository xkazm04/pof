import { describe, it, expect } from 'vitest';
import { computeDiff } from '@/components/modules/content/animations/StateMachineEditor/helpers';
import type { EditorState, EditorTransition } from '@/components/modules/content/animations/StateMachineEditor/types';

/**
 * A removed transition's endpoint name must resolve even when that state was
 * ALSO removed in the same edit (removeState cascades to its transitions) —
 * looking the id up only in the CURRENT states map falls back to the raw id.
 */
describe('computeDiff resolves transition endpoint names from both snapshots', () => {
  const idle: EditorState = { id: 's-idle', name: 'Idle', stateType: 'other', priority: 0, flag: 'bIsIdle', x: 10, y: 10 };
  const walk: EditorState = { id: 's-walk', name: 'Walking', stateType: 'other', priority: 1, flag: 'bIsWalking', x: 20, y: 20 };
  const trans: EditorTransition = { id: 't-1', from: 's-idle', to: 's-walk', rule: 'bIsWalking == true' };

  it('names a removed transition even when its FROM state was also removed', () => {
    const diff = computeDiff([idle, walk], [trans], [walk], []);
    expect(diff.removedTransitions).toEqual(['Idle -> Walking']);
    expect(diff.removedStates).toEqual(['Idle']);
  });

  it('names a removed transition even when its TO state was also removed', () => {
    const diff = computeDiff([idle, walk], [trans], [idle], []);
    expect(diff.removedTransitions).toEqual(['Idle -> Walking']);
  });

  it('names a new transition using current-state names', () => {
    const diff = computeDiff([idle, walk], [], [idle, walk], [trans]);
    expect(diff.newTransitions).toEqual(['Idle -> Walking']);
  });
});
