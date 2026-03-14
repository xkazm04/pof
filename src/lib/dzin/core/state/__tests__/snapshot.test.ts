import { describe, it, expect } from 'vitest';
import { serializeSnapshot } from '../snapshot';
import { createStateEngine } from '../engine';
import type { WorkspaceState } from '../types';

function makeInitialState(): WorkspaceState {
  return {
    layout: {
      template: 'single',
      gridTemplateRows: '1fr',
      gridTemplateColumns: '1fr',
    },
    panels: [
      {
        id: 'p1',
        type: 'data-list',
        slotIndex: 0,
        density: 'full',
        role: 'primary',
        uiState: { scrollY: 100 },
      },
    ],
    streaming: null,
  };
}

describe('serializeSnapshot', () => {
  it('produces JSON string of current state', () => {
    const engine = createStateEngine(makeInitialState());
    const json = serializeSnapshot(engine);
    expect(typeof json).toBe('string');
  });

  it('output is parseable back to WorkspaceState', () => {
    const initial = makeInitialState();
    const engine = createStateEngine(initial);
    const json = serializeSnapshot(engine);
    const parsed = JSON.parse(json) as WorkspaceState;
    expect(parsed).toEqual(initial);
    expect(parsed.panels).toHaveLength(1);
    expect(parsed.panels[0].id).toBe('p1');
    expect(parsed.layout.template).toBe('single');
  });
});
