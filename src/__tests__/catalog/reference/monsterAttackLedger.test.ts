import { describe, expect, it } from 'vitest';
import {
  MONSTER_ATTACK_LEDGER_FINDINGS,
  attackLedgerCoverage,
  attackLedgerFor,
  monsterAttackLedgerSpec,
  withMonsterAttackLedgers,
} from '@/lib/catalog/reference/monsterAttackLedger';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const syntheticRow = (overrides: Record<string, string> = {}): Record<string, string> => ({
  _monster_id: 'MT_SYNTHETIC',
  name: 'Synthetic Monster',
  ai: 'Fat',
  'frames[6]': '4,5,6,7,8,9',
  'rate[6]': '2,3,2,1,1,3',
  level: '7',
  armorClass: '11',
  toHit: '23',
  animFrameNum: '3',
  minDamage: '2',
  maxDamage: '4',
  toHitSpecial: '5',
  animFrameNumSpecial: '0',
  minDamageSpecial: '0',
  maxDamageSpecial: '0',
  ...overrides,
});

function wrapper(raw = syntheticRow()): ReferenceWrapper {
  return {
    wrapperId: 'synthetic:monster',
    sourceId: 'synthetic', file: 'monsters/monstdat.tsv', technique: 'synthetic',
    key: raw._monster_id, keyKind: 'column', raw, rawHash: 'synthetic',
    catalogId: 'bestiary', mappingVersion: 'synthetic',
    entity: {
      id: `d1-${raw._monster_id}`, catalogId: 'bestiary', name: raw.name,
      categoryPath: [], tags: [raw.ai], lifecycle: 'planned', data: { synthetic: true },
      provenance: {
        kind: 'ingest', sourceGame: 'Synthetic', sourceProject: 'Synthetic',
        sourceFile: 'monsters/monstdat.tsv', sourceRow: raw._monster_id,
        licenceNote: 'test fixture', ingestedAt: 'test-time',
      },
    },
  };
}

describe('monsterAttackLedger', () => {
  it('covers every AI routine that has a combat attack', () => {
    const coverage = attackLedgerCoverage();
    expect(coverage.attacking.length).toBeGreaterThan(0);
    expect(coverage.missing).toEqual([]);
    for (const routine of coverage.attacking) {
      const ledger = monsterAttackLedgerSpec(routine)!;
      expect(ledger.sequences.length, routine).toBeGreaterThan(0);
      expect(ledger.steps.length, routine).toBeGreaterThan(0);
      for (const sequence of ledger.sequences) {
        expect(sequence.steps[0].phase, `${routine}/${sequence.id}`).toBe('decide');
        expect(sequence.steps.at(-1)?.phase, `${routine}/${sequence.id}`).toBe('recover');
        expect(sequence.steps.every((entry) => entry.refs.length > 0), `${routine}/${sequence.id}`).toBe(true);
      }
    }
  });

  it('derives tick-boundary timing from the synthetic row instead of storing row values', () => {
    const ledger = attackLedgerFor(syntheticRow(), 'Fat');
    expect(ledger.timing.attack).toMatchObject({
      frameCount: 6,
      frameDelay: 2,
      marker: 3,
      hitTick: 4,
      hitProcessingTick: 5,
      hitWindowTicks: [4, 5],
      recoverTick: 10,
    });
    expect(ledger.timing.special).toMatchObject({ frameCount: 9, frameDelay: 3, marker: 0, hitTick: null });
  });

  it('maps a one-based first-frame marker to tick zero and the last frame to (frames - 1) * rate', () => {
    const ledger = attackLedgerFor(syntheticRow({ animFrameNum: '1' }), 'Fat');
    expect(ledger.timing.attack).toMatchObject({
      frameCount: 6,
      frameDelay: 2,
      marker: 1,
      hitTick: 0,
      recoverTick: 10,
    });
  });

  it('removes special melee when the marker is zero and restores it when positive', () => {
    const absent = attackLedgerFor(syntheticRow(), 'Fat');
    expect(absent.specialMarkerPresent).toBe(false);
    expect(absent.sequences.find((sequence) => sequence.kind === 'special-melee')?.present).toBe(false);

    const present = attackLedgerFor(syntheticRow({ animFrameNumSpecial: '2' }), 'Fat');
    expect(present.specialMarkerPresent).toBe(true);
    expect(present.sequences.find((sequence) => sequence.kind === 'special-melee')).toMatchObject({
      present: true,
      timing: { hitTick: 3, hitWindowTicks: [3, 4, 5] },
    });

    const noSpecialAnimation = attackLedgerFor(syntheticRow({ 'frames[6]': '4,5,6,7,8,0' }), 'Fat');
    expect(noSpecialAnimation.timing.special).toMatchObject({ frameCount: 0, hitTick: null, recoverTick: 0 });
  });

  it('instantiates normal and special combat channels for every difficulty through combatMath damage laws', () => {
    const ledger = attackLedgerFor(syntheticRow(), 'Fat');
    expect(ledger.channelsByDifficulty.normal.normal).toMatchObject({
      toHit: 23,
      damage: { min: 2, max: 4 },
      fixedPointDamage: { min: 128, max: 256, floor: 64 },
    });
    expect(ledger.channelsByDifficulty.nightmare.normal).toMatchObject({
      toHit: 108,
      damage: { min: 8, max: 12 },
    });
    expect(ledger.channelsByDifficulty.hell.special).toMatchObject({
      toHit: 125,
      damage: { min: 6, max: 6 },
      fixedPointDamage: { min: 384, max: 384, floor: 64 },
    });
  });

  it('instantiates Magma extra-swing timing and channel modifiers independently of animFrameNum', () => {
    const ledger = attackLedgerFor(syntheticRow({ ai: 'Magma', 'frames[6]': '4,5,10,7,8,9' }), 'Magma');
    const extra = ledger.sequences.find((sequence) => sequence.id === 'magma-engine-extra-swing')!;
    expect(extra.timing).toMatchObject({ markerColumn: 'engine currentFrame', hitTick: 16, hitWindowTicks: [16, 17] });
    expect(extra.byDifficulty?.normal).toMatchObject({ toHit: 33, damage: { min: 0, max: 2 } });
  });

  it('records Flash as an immediate two-half persistent attack with distinct damage formulas', () => {
    const ledger = attackLedgerFor(syntheticRow({ ai: 'Counselor' }), 'Counselor');
    const flash = ledger.sequences.find((sequence) => sequence.missile === 'FlashBottom+FlashTop')!;
    expect(flash.animation).toBe('immediate');
    expect(flash.timing).toBeUndefined();
    expect(flash.steps.find((entry) => entry.phase === 'damage')?.formula).toContain('Bottom _midam=2*monsterLevel');
    expect(flash.steps.find((entry) => entry.phase === 'missile')?.what).toContain('other three offsets');
  });

  it('records the Counselor-family Fireball terminal blast pass', () => {
    const ledger = monsterAttackLedgerSpec('Counselor')!;
    const projectile = ledger.sequences.find((sequence) => sequence.missile?.includes('Fireball'))!;
    expect(projectile.steps.find((entry) => entry.phase === 'missile')?.what).toContain('3x3 blast');
  });

  it('attaches data.attackLedger without changing the stored raw row', () => {
    const source = wrapper();
    const [promoted] = withMonsterAttackLedgers([source]);
    expect(promoted.entity.data.attackLedger).toMatchObject({ monsterId: 'd1-MT_SYNTHETIC', routine: 'Fat' });
    expect(source.entity.data.attackLedger).toBeUndefined();
    expect(promoted.raw).toBe(source.raw);
  });

  it('instantiates named monsters from inherited animation columns and unique combat overrides', () => {
    const base = wrapper();
    const unique: ReferenceWrapper = {
      ...wrapper(),
      wrapperId: 'synthetic:unique',
      file: 'monsters/unique_monstdat.tsv',
      raw: {
        type: 'MT_SYNTHETIC', name: 'Synthetic Unique', ai: 'Fat', intelligence: '2',
        level: '9', minDamage: '7', maxDamage: '13', customToHit: '31', customArmorClass: '17',
      },
      entity: { ...wrapper().entity, id: 'd1-uniq-synthetic', name: 'Synthetic Unique', tags: ['Fat'] },
    };
    const [promoted] = withMonsterAttackLedgers([unique], [base, unique]);
    expect(promoted.entity.data.attackLedger).toMatchObject({
      monsterId: 'd1-uniq-synthetic',
      timing: { attack: { frameCount: 6, marker: 3 } },
      channelsByDifficulty: { normal: { normal: { toHit: 31, damage: { min: 7, max: 13 } } } },
    });
    expect(promoted.raw).toBe(unique.raw);
  });

  it('reports timing parity after the cadence correction', () => {
    expect(MONSTER_ATTACK_LEDGER_FINDINGS).toEqual(expect.arrayContaining([
      expect.objectContaining({ dataset: 'monsterRuntimeLawsData', field: 'animationTiming', status: 'agree' }),
      expect.objectContaining({ dataset: 'behaviourScale', field: 'hitDelaySeconds', status: 'agree' }),
      expect.objectContaining({ dataset: 'behaviourScale', field: 'attackAnimationTicks', status: 'agree' }),
      expect.objectContaining({ dataset: 'combatDuel', field: 'monsterCadence', status: 'caller-input' }),
    ]));
  });
});
