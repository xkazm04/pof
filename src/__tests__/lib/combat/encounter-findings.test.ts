import { describe, it, expect } from 'vitest';
import { simulateEncounter, type PlacedEnemy, type WaveDef } from '@/lib/combat/choreography-sim';
import { computeTensionCurve } from '@/lib/combat/tension-curve';
import { DEFAULT_TUNING } from '@/lib/combat/definitions';
import {
  deriveEncounterFindings, ENCOUNTER_ENVELOPE, PACING_FINDING_KINDS,
} from '@/lib/combat/encounter-findings';
import { computeScrubData } from '@/components/modules/core-engine/sub_combat/choreography/types';

// One pacing authority: every encounter finding (balance + pacing) comes out of
// encounter-findings.ts; pacing findings are a 1:1 promotion of the tension
// curve's tone:'issue' beats; tension intensity sits on a fixed, declared basis.

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
const GAP_WAVES: WaveDef[] = [
  { spawnTimeSec: 0, label: 'Initial' },
  { spawnTimeSec: 40, label: 'Reinforcement' },
];

const seed = (enemyDamageMul = 1) =>
  simulateEncounter(SEED_ENEMIES, SEED_WAVES, { ...DEFAULT_TUNING, enemyDamageMul }, 5, COLORS);
const gap = () => simulateEncounter(GAP_ENEMIES, GAP_WAVES, { ...DEFAULT_TUNING }, 5, COLORS);

describe('encounter findings — one pacing authority', () => {
  it('a 36s stall between waves is a dead-zone finding with the curve beat span', () => {
    const r = gap();
    const dead = r.alerts.filter((a) => a.kind === 'dead-zone');
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({ kind: 'dead-zone', timeSec: 2.5, endTimeSec: 38.5 });
    const beat = r.tensionCurve.beats.find((b) => b.type === 'dead-zone');
    expect(beat).toMatchObject({ timeSec: dead[0].timeSec, endTimeSec: dead[0].endTimeSec });
  });

  it('the seed encounter reports its 12.5-17s dead zone as a finding', () => {
    const dead = seed().alerts.filter((a) => a.kind === 'dead-zone');
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({ timeSec: 12.5, endTimeSec: 17 });
  });

  it('pacing-finding kinds are exactly the multiset of issue-beat types', () => {
    for (const r of [seed(), gap(), seed(0.5)]) {
      const pacing = r.alerts
        .filter((a) => (PACING_FINDING_KINDS as readonly string[]).includes(a.kind))
        .map((a) => a.kind)
        .sort();
      const issues = r.tensionCurve.beats.filter((b) => b.tone === 'issue').map((b) => b.type).sort();
      expect(pacing).toEqual(issues);
    }
  });

  it('intensity is on a fixed basis: a 1-damage poke is not a 45% climax', () => {
    const mk = (damage: number) => computeTensionCurve({
      damageEvents: [{ timeSec: 2, source: 'Player', target: 'Grunt', damage, isCrit: false }],
      totalDurationSec: 4, playerMaxHp: 150, playerDied: false,
    });
    const poke = mk(1);
    expect(Math.max(...poke.samples.map((s) => s.intensity))).toBeLessThan(0.05);
    expect(poke.summary).not.toMatch(/Builds to a 45% climax/);
    const burst = mk(1000);
    expect(Math.max(...burst.samples.map((s) => s.intensity))).toBe(1);
    expect(burst.peakTension).toBeGreaterThan(poke.peakTension);
  });

  it('the curve declares its basis, and its window is the envelope bucket', () => {
    const c = computeTensionCurve({
      damageEvents: [{ timeSec: 1, source: 'Grunt', target: 'Player', damage: 30, isCrit: false }],
      totalDurationSec: 3, playerMaxHp: 150, playerDied: false,
    });
    expect(c.basis).toEqual({ windowSec: 2, sampleStepSec: 0.5, intensityReference: 150, observedPeakFlux: 30 });
    expect(c.basis.windowSec).toBe(ENCOUNTER_ENVELOPE.bucketSec);
  });

  it('[guard] seed balance findings keep today\'s severities and times, now with kinds', () => {
    const balance = seed().alerts.filter((a) => !(PACING_FINDING_KINDS as readonly string[]).includes(a.kind));
    expect(balance.map(({ kind, severity, timeSec }) => ({ kind, severity, timeSec })).sort((a, b) => a.kind.localeCompare(b.kind)))
      .toEqual([
        { kind: 'burst-spike', severity: 'critical', timeSec: 8 },
        { kind: 'player-death', severity: 'warning', timeSec: expect.closeTo(18.8, 5) },
        { kind: 'tedious-hp', severity: 'warning', timeSec: 0 },
      ]);
  });

  it('[guard] an empty fight has no beats and derives no pacing findings', () => {
    const c = computeTensionCurve({ damageEvents: [], totalDurationSec: 10, playerMaxHp: 150, playerDied: false });
    expect(c.beats).toEqual([]);
    expect(c.summary).toBe('No combat activity to pace.');
    const findings = deriveEncounterFindings({
      damageEvents: [], durationSec: 10, playerDied: false, effectivePlayerHp: 150,
      totalEnemyHp: 0, enemyCount: 0, skippedEnemies: 0,
    }, c);
    expect(findings.filter((f) => (PACING_FINDING_KINDS as readonly string[]).includes(f.kind))).toEqual([]);
  });

  it('the scrub tooltip matches a ranged finding by containment, not distance to its start', () => {
    const r = gap();
    const mid = computeScrubData(20, [], [], r.alerts, r.tensionCurve);
    expect(mid.alert?.kind).toBe('dead-zone');
  });
});
