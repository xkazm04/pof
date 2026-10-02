import { describe, it, expect } from 'vitest';
import { simulateEncounter, type PlacedEnemy, type WaveDef } from '@/lib/combat/choreography-sim';
import { DEFAULT_TUNING } from '@/lib/combat/definitions';
import { diffEncounterRuns } from '@/lib/combat/encounter-compare';

// A tuning pass reports what it changed against a pinned baseline: outcome,
// duration, beats added / removed / moved, findings resolved / new / persisting.
// Findings are matched by their stable `kind` (encounter-findings.ts), never by
// the numbers inside a message. Literals measured on the post-A sim (ccea89a1).

const COLORS = { hitstop: 'a', shake: 'b', vfx: 'c', sfx: 'd' };

/** The editor's seed encounter (choreography/index.tsx). */
const SEED_ENEMIES: PlacedEnemy[] = [
  { id: 'e1', archetypeId: 'melee-grunt', gridX: 1, gridY: 1, waveIndex: 0, level: 5 },
  { id: 'e2', archetypeId: 'melee-grunt', gridX: 4, gridY: 1, waveIndex: 0, level: 5 },
  { id: 'e3', archetypeId: 'ranged-caster', gridX: 3, gridY: 3, waveIndex: 0, level: 5 },
  { id: 'e4', archetypeId: 'brute', gridX: 2, gridY: 0, waveIndex: 1, level: 6 },
  { id: 'e5', archetypeId: 'elite-knight', gridX: 3, gridY: 1, waveIndex: 2, level: 7 },
];
const SEED_WAVES: WaveDef[] = [
  { spawnTimeSec: 0, label: 'Initial' },
  { spawnTimeSec: 8, label: 'Reinforcement' },
  { spawnTimeSec: 18, label: 'Boss Wave' },
];
const GAP_ENEMIES: PlacedEnemy[] = [
  { id: 'g1', archetypeId: 'melee-grunt', gridX: 1, gridY: 1, waveIndex: 0, level: 5 },
  { id: 'g2', archetypeId: 'brute', gridX: 2, gridY: 0, waveIndex: 1, level: 6 },
];

const seed = (enemyDamageMul = 1) =>
  simulateEncounter(SEED_ENEMIES, SEED_WAVES, { ...DEFAULT_TUNING, enemyDamageMul }, 5, COLORS);
const gapAt = (wave1Sec: number) => simulateEncounter(
  GAP_ENEMIES, [{ spawnTimeSec: 0, label: 'Initial' }, { spawnTimeSec: wave1Sec, label: 'Reinforcement' }],
  { ...DEFAULT_TUNING }, 5, COLORS,
);

describe('diffEncounterRuns — what a tuning pass changed', () => {
  it('case 1: a run diffed against itself reports no change', () => {
    const r = seed();
    const d = diffEncounterRuns(r, r);
    expect(d).toMatchObject({
      durationDeltaSec: 0, beatsAdded: [], beatsRemoved: [], beatsMoved: [], alertsResolved: [], alertsNew: [],
    });
    expect(d.outcome.base).toEqual(d.outcome.next);
    expect(d.alertsPersisting).toHaveLength(r.alerts.length);
  });

  it('case 2: halving enemy damage flips death to survival and resolves player-death + burst-spike', () => {
    const d = diffEncounterRuns(seed(1.0), seed(0.5));
    expect(d.outcome.base.playerDied).toBe(true);
    expect(d.outcome.base.diedAtSec).toBeCloseTo(18.8, 5);
    expect(d.outcome.next.playerDied).toBe(false);
    expect(d.outcome.next.diedAtSec).toBeNull();
    expect(d.outcome.next.playerHpEnd).toBeGreaterThan(0);
    expect(d.durationDeltaSec).toBeCloseTo(3.0, 5);
    expect(d.alertsResolved.map((a) => [a.kind, a.severity])).toEqual([['player-death', 'warning'], ['burst-spike', 'critical']]);
    expect(d.alertsNew).toEqual([]);
    // The seed's 12.5-17s dead zone is on both sides: it persists, it is not resolved.
    expect(d.alertsPersisting.map((p) => p.next.kind).sort()).toEqual(['dead-zone', 'tedious-hp']);
  });

  it('case 3: same pair - near-death removed, climax moved later, breather + dead zone paired', () => {
    const d = diffEncounterRuns(seed(1.0), seed(0.5));
    expect(d.beatsRemoved.map((b) => [b.type, b.timeSec])).toEqual([['near-death', 10]]);
    expect(d.beatsMoved).toEqual([{ type: 'climax', fromSec: 18.5, toSec: 21.5 }]);
    expect(d.beatsAdded).toEqual([]);
    const listed = [...d.beatsAdded, ...d.beatsRemoved].map((b) => b.type);
    expect(listed).not.toContain('breather');
    expect(listed).not.toContain('dead-zone');
  });

  it('case 4: closing a 36s wave gap removes the 2.5-38.5s dead zone and shortens the fight by 36s', () => {
    const d = diffEncounterRuns(gapAt(40), gapAt(4));
    expect(d.beatsRemoved).toContainEqual(expect.objectContaining({ type: 'dead-zone', timeSec: 2.5, endTimeSec: 38.5 }));
    expect(d.durationDeltaSec).toBeCloseTo(-36.0, 5);
    expect(d.alertsResolved.map((a) => a.kind)).toEqual(['dead-zone']);
  });

  it('case 5: findings match by kind, not by the numbers in the message', () => {
    const base = seed(1.0);
    const next = seed(0.7);
    expect(base.alerts.find((a) => a.kind === 'player-death')?.message).toMatch(/Player dies at 18\.8s/);
    expect(next.alerts.find((a) => a.kind === 'player-death')?.message).toMatch(/Player dies at 21\.2s/);
    const d = diffEncounterRuns(base, next);
    expect(d.alertsPersisting.map((p) => p.base.kind)).toContain('player-death');
    expect(d.alertsResolved.map((a) => a.kind)).not.toContain('player-death');
    expect(d.alertsNew.map((a) => a.kind)).not.toContain('player-death');
  });
});
