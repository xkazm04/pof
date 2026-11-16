import { describe, it, expect } from 'vitest';
import {
  encounterReducer, initialEncounterState, type EncounterAction,
} from '@/components/modules/core-engine/sub_combat/choreography/encounterDraftStore';

// setTuning (same value) and removeEnemy (unknown id) already return the same
// state; every other draft edit must agree, or a no-op pushes an undo snapshot
// that "undoes" nothing.
describe('encounterReducer no-op edits', () => {
  const s = initialEncounterState();
  const e1 = s.enemies[0];
  const cases: [string, EncounterAction][] = [
    ['setTuning to the same value', { type: 'setTuning', key: 'enemyHealthMul', value: s.tuning.enemyHealthMul }],
    ['removeEnemy of an unknown id', { type: 'removeEnemy', id: 'nope' }],
    ['moveEnemy of an unknown id', { type: 'moveEnemy', id: 'nope', x: 0, y: 0 }],
    ['moveEnemy onto its own cell', { type: 'moveEnemy', id: e1.id, x: e1.gridX, y: e1.gridY }],
    ['moveEnemy onto its own cell and wave', { type: 'moveEnemy', id: e1.id, x: e1.gridX, y: e1.gridY, wave: e1.waveIndex }],
    ['setWaveTime to the same time', { type: 'setWaveTime', index: 1, time: s.waves[1].spawnTimeSec }],
    ['setWaveTime on an out-of-range wave', { type: 'setWaveTime', index: 99, time: 5 }],
    ['setPlayerLevel to the same level', { type: 'setPlayerLevel', level: s.playerLevel }],
    ['resetTuning when already at defaults', { type: 'resetTuning' }],
  ];

  it.each(cases)('%s returns the same state (no undo snapshot)', (_label, action) => {
    const next = encounterReducer(s, action);
    expect(next).toBe(s);
    expect(next.history).toHaveLength(0);
  });

  it('a real move still pushes one snapshot', () => {
    const next = encounterReducer(s, { type: 'moveEnemy', id: e1.id, x: 5, y: 3 });
    expect(next.history).toHaveLength(1);
    expect(next.enemies[0]).toMatchObject({ gridX: 5, gridY: 3 });
  });
});
