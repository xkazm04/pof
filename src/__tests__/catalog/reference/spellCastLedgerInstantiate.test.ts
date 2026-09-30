import { describe, expect, it } from 'vitest';
import {
  auditInstantiatedSpellCastLedger,
  castLedgerFor,
} from '@/lib/catalog/reference/spellCastLedger';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

function wrapper(
  file: string,
  catalogId: string,
  key: string,
  raw: Record<string, string>,
): ReferenceWrapper {
  return {
    wrapperId: `synthetic:${file}:${key}`,
    sourceId: 'synthetic', file, technique: 'synthetic', key, keyKind: 'column',
    raw, rawHash: 'synthetic', catalogId, mappingVersion: 'synthetic',
    entity: {
      id: catalogId === 'spellbook' ? `d1-${key}` : `synthetic-${key}`,
      catalogId, name: key, categoryPath: [], tags: [], lifecycle: 'planned', data: {},
      provenance: {
        kind: 'ingest', sourceGame: 'Synthetic', sourceProject: 'Synthetic',
        sourceFile: file, sourceRow: key, licenceNote: 'test fixture', ingestedAt: 'test-time',
      },
    },
  };
}

const spellRow = (spell: string, missiles: string, values: Partial<Record<string, string>> = {}) =>
  wrapper('spells/spelldat.tsv', 'spellbook', spell, {
    id: spell,
    manaCost: '20',
    minMana: '4',
    manaMultiplier: '2',
    bookLevel: '2',
    staffLevel: '3',
    scrollLevel: '4',
    soundId: 'SyntheticCast',
    missiles,
    ...values,
  });

const missileRow = (
  missile: string,
  addFn: string,
  processFn: string,
  flags: string,
  movementDistribution: string,
  values: Partial<Record<string, string>> = {},
) => wrapper('missiles/misdat.tsv', 'vfx', missile, {
  id: missile, addFn, processFn, flags, movementDistribution, ...values,
});

function classRows(): ReferenceWrapper[] {
  return [
    wrapper('classes/sorcerer/attributes.tsv', 'characters', 'class-sorcerer', {
      baseMag: '16', baseMagicToHit: '50', adjMana: '10', lvlMana: '2', chrMana: '2',
    }),
    wrapper('classes/sorcerer/animations.tsv', 'characters', 'class-sorcerer', {
      castingFrames: '8', castingActionFrame: '3',
    }),
  ];
}

describe('castLedgerFor', () => {
  it('instantiates mana, damage, timing, row metadata, and the child missile chain', () => {
    const firebolt = spellRow('Firebolt', 'Firebolt');
    const related = [
      firebolt,
      ...classRows(),
      missileRow('Firebolt', 'AddFirebolt', 'ProcessGenericProjectile', 'Fire', 'Blockable', {
        speed: '13', damageMinimum: '2', damageMaximum: '7',
      }),
      missileRow('MagmaBallExplosion', 'AddMissileExplosion', 'ProcessMissileExplosion', 'Fire', ''),
    ];
    const ledger = castLedgerFor(firebolt, related);

    expect(ledger).toMatchObject({
      instantiated: true,
      spell: 'Firebolt',
      spellId: 'd1-Firebolt',
      row: {
        manaCost: 20, minimumMana: 4, manaPerLevel: 2,
        bookLevel: 2, staffLevel: 3, scrollLevel: 4, soundId: 'SyntheticCast',
      },
      castTimingByClass: { Sorcerer: { frames: 8, releaseTick: 3, endTick: 7 } },
    });
    expect(ledger.levels[0]).toMatchObject({
      spellLevel: 1,
      manaByClass: { Sorcerer: { diablo: 20, hellfire: 10 } },
      damage: { min: 4, max: 13 },
      duration: { ticks: 256, kind: 'maximum' },
      hits: { maximumCollisionChecks: 1, maximumChecksPerTick: 1 },
    });
    expect(ledger.missileChain).toEqual(expect.arrayContaining([
      expect.objectContaining({
        missile: 'Firebolt', parent: null, speed: 13, blockable: true,
        damageColumns: { damageMinimum: '2', damageMaximum: '7' },
        damageUnits: 'whole-hit-points',
        kineticsByLevel: expect.arrayContaining([
          expect.objectContaining({
            spellLevel: 1,
            speed: { formula: '(16+min(2*S,47))/16 for player casts', tilesPerTick: 1.125 },
            lifetime: expect.objectContaining({ ticks: 256 }),
          }),
        ]),
      }),
      expect.objectContaining({ missile: 'MagmaBallExplosion', parent: 'Firebolt', depth: 1 }),
    ]));
  });

  it('uses playerSpellHits for the level-scaled Fire Wall duration and repeated-hit topology', () => {
    const fireWall = spellRow('FireWall', 'FireWallControl');
    const related = [
      fireWall,
      ...classRows(),
      missileRow('FireWallControl', 'AddWallControl', 'ProcessWallControl', 'Fire', ''),
      missileRow('FireWall', 'AddFireWall', 'ProcessFireWall', 'Fire', 'Unblockable'),
    ];
    const ledger = castLedgerFor(fireWall, related);

    expect(ledger.levels[0]).toMatchObject({
      damage: { min: 0.375, max: 2.625 },
      duration: { ticks: 320, kind: 'exact' },
      hits: {
        maximumCollisionChecks: 320,
        maximumChecksPerTick: 1,
        collisionDamage: 'already-shifted-fixed-point',
      },
    });
    expect(ledger.levels[14].duration.ticks).toBe(2560);
    expect(ledger.missileChain).toEqual(expect.arrayContaining([
      expect.objectContaining({
        missile: 'FireWall', parent: 'FireWallControl', damageUnits: 'already-shifted-fixed-point',
        kineticsByLevel: expect.arrayContaining([
          expect.objectContaining({ spellLevel: 15, lifetime: expect.objectContaining({ ticks: 2560 }) }),
        ]),
      }),
    ]));
  });

  it('includes a later target-action child and computes kinetics for every chain node', () => {
    const resurrect = spellRow('Resurrect', 'Resurrect');
    const related = [
      resurrect,
      ...classRows(),
      missileRow('Resurrect', 'AddResurrect', '', 'Magic', ''),
      missileRow('ResurrectBeam', 'AddResurrectBeam', 'ProcessResurrectBeam', 'Magic', ''),
    ];
    const ledger = castLedgerFor(resurrect, related);
    expect(ledger.missileChain.map((missile) => ({
      missile: missile.missile,
      parent: missile.parent,
      spawn: missile.spawn,
      levels: missile.kineticsByLevel.length,
    }))).toEqual([
      { missile: 'Resurrect', parent: null, spawn: 'initial', levels: 15 },
      { missile: 'ResurrectBeam', parent: 'Resurrect', spawn: 'on target action', levels: 15 },
    ]);
  });

  it('has no spellMath/playerSpellHits disagreements for the five required synthetic spell rows', () => {
    const spells = [
      spellRow('Firebolt', 'Firebolt'),
      spellRow('Fireball', 'Fireball'),
      spellRow('ChainLightning', 'ChainLightning'),
      spellRow('FireWall', 'FireWallControl'),
      spellRow('Healing', 'Healing'),
    ];
    const related = [...spells, ...classRows()];
    const findings = spells.flatMap((spell) => auditInstantiatedSpellCastLedger(castLedgerFor(spell, related)));
    expect(findings).toEqual([]);
  });
});
