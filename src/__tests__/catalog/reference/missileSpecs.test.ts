import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { MISSILE_COLUMNS } from '@/lib/catalog/ingest/diablo1Missiles';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import {
  DIABLO1_MISSILE_LAWS,
  MISSILE_BEHAVIOUR_SPECS,
  MISSILE_REACHABILITY,
  MISSILE_SPAWNS,
  MONSTER_AI_TO_MISSILES,
  SPELL_TO_MISSILES,
  UNUSED_MISSILE_REASONS,
  UNUSED_MISSILES,
  blockability,
  classifyMissileFlags,
  computeMissileReachability,
  seedMissileSteps,
  withMissileSpecs,
} from '@/lib/catalog/reference/missileSpecs';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

const table = DIABLO1.tables.find((candidate) => candidate.file === 'missiles/misdat.tsv')!;
const synthetic = (values: Record<string, string>) => wrapTable(
  DIABLO1,
  table,
  [
    MISSILE_COLUMNS.join('\t'),
    MISSILE_COLUMNS.map((column) => values[column] ?? '').join('\t'),
  ].join('\n'),
  't0',
).wrappers[0];

describe('engine-derived missile specifications', () => {
  it('covers every vanilla missile enum exactly once across every unique behaviour pair', () => {
    expect(MISSILE_BEHAVIOUR_SPECS).toHaveLength(52);
    const pairs = MISSILE_BEHAVIOUR_SPECS.map((specification) =>
      `${specification.addFn ?? ''}/${specification.processFn ?? ''}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    const missiles = MISSILE_BEHAVIOUR_SPECS.flatMap((specification) => specification.missileIds);
    expect(missiles).toHaveLength(68);
    expect(new Set(missiles).size).toBe(missiles.length);
    for (const specification of MISSILE_BEHAVIOUR_SPECS) {
      expect(specification.movement.length).toBeGreaterThan(5);
      expect(specification.speed.length).toBeGreaterThan(0);
      expect(specification.lifetime.length).toBeGreaterThan(4);
      expect(specification.collision.length).toBeGreaterThan(4);
      expect(specification.damageSource.length).toBeGreaterThan(4);
      expect(specification.refs.length).toBeGreaterThan(0);
      expect(specification.refs.every((ref) => /^\.reference\/devilutionX\/Source\/.+\.h?:?c?p?p?:\d+$/.test(ref))).toBe(true);
    }
  });

  it('classifies every flag enum and decodes movement distribution by engine meaning', () => {
    expect(classifyMissileFlags('Fire,Arrow,Invisible')).toEqual({
      flags: ['Fire', 'Arrow', 'Invisible'], damageType: 'Fire', arrow: true, invisible: true,
    });
    expect(() => classifyMissileFlags('Synthetic')).toThrow(/Unknown missile flag/);
    expect(blockability('Blockable')).toBe(true);
    expect(blockability('Unblockable')).toBe(false);
    expect(blockability('')).toBe(null);
  });

  it('normalizes invented row values into behaviour, sounds, graphic, flags, and blockability', () => {
    const wrapper = synthetic({
      id: 'SyntheticBolt', addFn: 'AddFirebolt', processFn: 'ProcessGenericProjectile',
      castSound: 'SyntheticCast', hitSound: 'SyntheticHit', graphic: 'SyntheticSprite',
      flags: 'Fire,Arrow,Invisible', movementDistribution: 'Unblockable',
    });
    const [normalized] = withMissileSpecs([wrapper]);
    expect(normalized.entity.data).toMatchObject({
      behaviour: { addFn: 'AddFirebolt', processFn: 'ProcessGenericProjectile' },
      sounds: { cast: 'SyntheticCast', hit: 'SyntheticHit' },
      graphic: 'SyntheticSprite', damageType: 'Fire', arrow: true, invisible: true,
      blockable: false,
    });
    expect(normalized.entity.data.flags).toEqual(['Fire', 'Arrow', 'Invisible']);
  });

  it('links spell specs and monster AI attacks, flagging out-of-table Hellfire links', () => {
    const covered = new Set(MISSILE_BEHAVIOUR_SPECS.flatMap((specification) => specification.missileIds));
    expect(SPELL_TO_MISSILES.length).toBeGreaterThan(20);
    expect(MONSTER_AI_TO_MISSILES.length).toBeGreaterThan(5);
    for (const link of [...SPELL_TO_MISSILES, ...MONSTER_AI_TO_MISSILES]) {
      expect(link.missiles.length).toBeGreaterThan(0);
      for (const missile of link.missiles) expect(covered.has(missile) || link.hellfire).toBe(true);
    }
    expect(UNUSED_MISSILES.length).toBeGreaterThan(0);
    expect(UNUSED_MISSILES.every((missile) => covered.has(missile))).toBe(true);
  });

  it('tracks pinned missile spawns and transitive reachability', () => {
    expect(MISSILE_SPAWNS.length).toBeGreaterThan(30);
    for (const edge of MISSILE_SPAWNS) {
      expect(edge.refs.length).toBeGreaterThan(0);
      expect(edge.refs.every((ref) => /^\.reference\/devilutionX\/Source\/missiles\.cpp:\d+$/.test(ref))).toBe(true);
    }
    expect(MISSILE_SPAWNS).toContainEqual(expect.objectContaining({
      parent: 'Acid', child: 'AcidSplat', when: 'on expiry',
    }));
    expect(MISSILE_SPAWNS).toContainEqual(expect.objectContaining({
      parent: 'AcidSplat', child: 'AcidPuddle', when: 'on expiry',
    }));
    expect(MISSILE_REACHABILITY.AcidPuddle).toMatchObject({
      directOwners: [], spawnedBy: ['Acid', 'AcidSplat'], reachable: true,
    });
    expect(MISSILE_REACHABILITY.DiabloApocalypseBoom).toMatchObject({
      directOwners: [], spawnedBy: ['DiabloApocalypse'], reachable: true,
    });
    expect(UNUSED_MISSILES).not.toContain('AcidPuddle');
    expect(UNUSED_MISSILES).not.toContain('DiabloApocalypseBoom');
    expect(UNUSED_MISSILES).toHaveLength(16);
    expect(UNUSED_MISSILE_REASONS.map(({ missile }) => missile)).toEqual(UNUSED_MISSILES);
    for (const missile of UNUSED_MISSILES) {
      expect(MISSILE_REACHABILITY[missile].unreachableReason, missile).toEqual(expect.any(String));
    }
    for (const entry of UNUSED_MISSILE_REASONS) {
      expect(entry.refs.length, entry.missile).toBeGreaterThan(0);
      expect(entry.refs.every((ref) => ref.includes('.reference/devilutionX/Source/'))).toBe(true);
    }
  });

  it('computes synthetic spawn chains transitively and terminates cycles', () => {
    const links = [{ owner: 'SyntheticOwner', missiles: ['Root'], hellfire: false }];
    const edge = (parent: string, child: string) => ({
      parent, child, when: 'per tick' as const, refs: ['synthetic:1'],
    });
    const reachability = computeMissileReachability(
      ['Root', 'Middle', 'Leaf', 'Orphan'],
      links,
      [],
      [edge('Root', 'Middle'), edge('Middle', 'Leaf'), edge('Leaf', 'Root')],
      { Orphan: 'Synthetic unreachable missile.' },
    );
    expect(reachability.Root).toMatchObject({
      directOwners: ['spell:SyntheticOwner'], spawnedBy: [], reachable: true,
    });
    expect(reachability.Leaf).toMatchObject({
      directOwners: [], spawnedBy: ['Root', 'Middle'], reachable: true,
    });
    expect(reachability.Orphan).toMatchObject({
      directOwners: [], spawnedBy: [], reachable: false,
      unreachableReason: 'Synthetic unreachable missile.',
    });
  });

  it('exports only short cross-missile laws from the type-only data module', () => {
    expect(DIABLO1_MISSILE_LAWS).toHaveLength(1);
    for (const law of DIABLO1_MISSILE_LAWS) {
      expect(law.scope).toBe('vfx');
      expect(law.body.length).toBeLessThanOrEqual(450);
    }
  });

  it('seeds SOURCED Behavior and Sound Hook artifacts and names target-art gaps', () => {
    const wrapper = synthetic({
      id: 'SyntheticBolt', addFn: 'AddFirebolt', processFn: 'ProcessGenericProjectile',
      castSound: 'SyntheticCast', graphic: 'SyntheticSprite', flags: 'Fire',
      movementDistribution: 'Blockable',
    });
    const seeds = seedMissileSteps(wrapper);
    expect(seeds.map((seed) => seed.step)).toEqual(['Behavior', 'Sound Hook']);
    expect(seeds.every((seed) => seed.data.sourced != null)).toBe(true);
    expect(seeds[0].data.behavior).toMatchObject({
      emitters: 'SyntheticSprite', lifetime: expect.any(String), spawnRate: REFERENCE_GAP,
    });
    expect(seeds[0].gaps.join(' ')).toMatch(/Mesh \/ Sprite.*Material.*GPU \/ LOD Budget.*Variants/);
    expect(seeds[1].data.soundHook).toMatchObject({
      cues: ['SyntheticCast'], animNotifyBinding: REFERENCE_GAP,
    });
    const pipeline = getCatalogPipeline('vfx')!;
    for (const seed of seeds) {
      const step = pipeline.steps.find((candidate) => candidate.label === seed.step)!;
      expect(step.accept?.(seed.data).status).toBe('pending');
    }
  });
});
