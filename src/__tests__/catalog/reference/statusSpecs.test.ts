import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import {
  DIABLO1_STATUS_LAWS,
  seedStatusSteps,
  statusEntities,
  statusLawId,
  STATUS_SPECS,
} from '@/lib/catalog/reference/statusSpecs';
import { seedSpellSteps } from '@/lib/catalog/reference/stepSeeds';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

describe('Diablo I engine-derived status specifications', () => {
  it('keeps the complete census but promotes only the 29 reachable vanilla rows', () => {
    expect(STATUS_SPECS).toHaveLength(37);
    expect(STATUS_SPECS.filter((spec) => spec.hellfire)).toHaveLength(6);
    expect(statusEntities()).toHaveLength(29);
    expect(statusEntities().some((wrapper) => wrapper.entity.id === 'd1-status-reflect-charges')).toBe(false);
    expect(statusEntities().some((wrapper) => wrapper.entity.id === 'd1-status-etherealize-dead-hook')).toBe(false);
    expect(statusEntities().some((wrapper) => wrapper.entity.id === 'd1-status-rage-two-phase-hook')).toBe(false);
  });

  it('generates one short canon law per row plus the overview and rewrites every pinned ref', () => {
    expect(DIABLO1_STATUS_LAWS).toHaveLength(STATUS_SPECS.length + 1);
    for (const spec of STATUS_SPECS) {
      const law = DIABLO1_STATUS_LAWS.find((candidate) => candidate.id === statusLawId(spec.id));
      expect(law?.body).toBe(spec.lawBody);
      expect(law?.body.length, spec.id).toBeLessThanOrEqual(450);
      expect(law?.refs).toEqual(spec.refs);
      for (const ref of spec.refs) {
        expect(ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/')).toBe(true);
      }
    }
    const overview = DIABLO1_STATUS_LAWS.find((law) => law.id === 'd1-status-overview-law')!;
    expect(overview.body.length).toBeLessThanOrEqual(450);
    expect(DIABLO1_CANON.some((law) => law.id === overview.id)).toBe(true);
  });

  it('projects honest engine provenance, exact data fields, tags, and named spell links', () => {
    const stone = statusEntities().find((wrapper) => wrapper.entity.id === 'd1-status-stone-curse-petrification')!.entity;
    expect(stone.tags).toEqual(['diablo-state', 'monster']);
    expect(Object.keys(stone.data).sort()).toEqual(['appliesTo', 'duration', 'effect', 'removal', 'source', 'stacking']);
    expect(stone.links).toEqual([{ catalogId: 'spellbook', entityId: 'd1-StoneCurse', role: 'source' }]);
    expect(stone.provenance).toMatchObject({
      kind: 'ingest',
      sourceFile: expect.stringContaining('engine: Source/missiles.cpp'),
      sourceRow: 'SpellID::StoneCurse / MissileID::StoneCurse',
      canonProfile: 'diablo1',
    });
  });
});

describe('seedStatusSteps', () => {
  const byId = (id: string) => statusEntities().find((wrapper) => wrapper.entity.id === id)!.entity;

  it('declares contact damage as damage-over-time but leaves unstated fixed numbers as gaps', () => {
    const seeds = seedStatusSteps(byId('d1-status-fire-wall-contact-damage'));
    const effectSeed = seeds.find((seed) => seed.step === 'Effect Logic')!;
    const effect = effectSeed.data.effect as Record<string, unknown>;
    expect(effect).toMatchObject({
      kind: 'damage-over-time',
      magnitude: REFERENCE_GAP,
      period: REFERENCE_GAP,
      duration: REFERENCE_GAP,
      sourceDamageType: 'Fire',
    });
    expect(effectSeed.data.sourced).toBeDefined();
    const balance = seeds.find((seed) => seed.step === 'Balance')!.data.balance as Record<string, unknown>;
    expect(balance).toEqual({ kind: 'damage-over-time', dps: REFERENCE_GAP, tierTarget: REFERENCE_GAP });
  });

  it('declares petrification as control ending by duration without inventing its PoF budget', () => {
    const seeds = seedStatusSteps(byId('d1-status-stone-curse-petrification'));
    const effect = seeds.find((seed) => seed.step === 'Effect Logic')!.data.effect as Record<string, unknown>;
    expect(effect.kind).toBe('control');
    expect(effect.removal).toMatchObject({ mode: 'duration' });
    const balance = seeds.find((seed) => seed.step === 'Balance')!.data.balance as {
      kind: string;
      controlBudget: Record<string, unknown>;
    };
    expect(balance.kind).toBe('control');
    expect(balance.controlBudget).toMatchObject({
      controlKind: 'petrify',
      terminationMode: 'duration',
      durationSec: REFERENCE_GAP,
      immunityWindowSec: REFERENCE_GAP,
    });
  });

  it('does not force a permanent drain into either supported Balance discriminator', () => {
    const seeds = seedStatusSteps(byId('d1-status-monster-attribute-drain'));
    expect((seeds[0].data.effect as Record<string, unknown>).kind).toBe('persistent-mutation');
    expect(seeds.some((seed) => seed.step === 'Balance')).toBe(false);
    expect(seeds[0].gaps.join(' ')).toContain('neither damage-over-time nor control');
  });

  it('uses the real checker shapes and keeps the sourced Effect Logic pending rather than passing', () => {
    const pipeline = getCatalogPipeline('status-effects')!;
    for (const id of ['d1-status-fire-wall-contact-damage', 'd1-status-stone-curse-petrification']) {
      const data = seedStatusSteps(byId(id)).find((seed) => seed.step === 'Effect Logic')!.data;
      const result = pipeline.steps.find((step) => step.label === 'Effect Logic')!.accept(data);
      expect(result.status).toBe('pending');
    }
  });
});

describe('spell Applies Status seeds from synthetic table rows', () => {
  const table = DIABLO1.tables.find((candidate) => candidate.catalogId === 'spellbook')!;
  const columns = Object.keys(table.map);
  const row = (values: Record<string, string>) => {
    const text = `${columns.join('\t')}\n${columns.map((column) => values[column] ?? '').join('\t')}`;
    return wrapTable(DIABLO1, table, text, 't0').wrappers[0];
  };

  it('links a spell with a censused state and writes explicit none for a spell without one', () => {
    const wall = seedSpellSteps(row({ id: 'FireWall', name: 'Fire Wall', manaCost: '6', flags: 'Fire,Targeted' }))
      .find((seed) => seed.step === 'Applies Status')!;
    expect(wall.data.appliedStatus).toMatchObject({
      statusId: 'status-effects::d1-status-fire-wall-contact-damage',
      role: 'applies',
      reason: 'd1-status-fire-wall-contact-damage-law',
    });
    expect(wall.data.links).toEqual([
      { catalogId: 'status-effects', entityId: 'd1-status-fire-wall-contact-damage', role: 'applies' },
    ]);
    expect(wall.data.sourced).toBeDefined();

    const bolt = seedSpellSteps(row({ id: 'Firebolt', name: 'Firebolt', manaCost: '6', flags: 'Fire,Targeted' }))
      .find((seed) => seed.step === 'Applies Status')!;
    expect(bolt.data.appliedStatus).toMatchObject({
      statusId: 'none',
      role: 'does-not-apply',
      reason: 'd1-status-overview-law',
    });
    expect(bolt.data.appliedStatus).not.toBe(REFERENCE_GAP);
    expect(bolt.data.links).toEqual([]);
  });
});
