import { describe, it, expect } from 'vitest';
import { MOVEMENT_STATES } from '@/components/modules/core-engine/sub_character/_shared/data';
import {
  STATE_POSITIONS, STATE_TRANSITIONS,
} from '@/components/modules/core-engine/sub_character/movement/state-machine-data';

const LABELS = MOVEMENT_STATES.map((s) => s.label);
const positions = STATE_POSITIONS as unknown as Record<string, { x: number; y: number } | undefined>;
const transitions = STATE_TRANSITIONS as unknown as { from: string; to: string }[];

/* The graph addressed MOVEMENT_STATES by array index: inserting or reordering a state silently
 * mis-wired it. It is keyed by state label now, and this guard pins it to the state list. */
describe('movement state-machine data stays in step with MOVEMENT_STATES', () => {
  it('every state has a drawn position, keyed by label', () => {
    for (const label of LABELS) {
      expect(positions[label], `position for ${label}`).toBeTruthy();
    }
    expect(Object.keys(positions).sort()).toEqual([...LABELS].sort());
  });

  it('every transition joins two known state labels', () => {
    for (const t of transitions) {
      expect(LABELS, `from ${String(t.from)}`).toContain(t.from);
      expect(LABELS, `to ${String(t.to)}`).toContain(t.to);
    }
  });

  it('Sprint can dodge (UE TryDodge cancels sprint), like Idle, Walk and Run', () => {
    for (const from of ['Idle', 'Walk', 'Run', 'Sprint']) {
      expect(transitions.some((t) => t.from === from && t.to === 'Dodge'), `${from} -> Dodge`).toBe(true);
    }
  });
});
