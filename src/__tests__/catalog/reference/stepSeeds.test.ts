// /diablo W02b — seeds from a reference row, graded by the REAL registered bestiary steps. The law's
// numbers are parsed from the canon rule (d1-resistance-law, derived from devilutionX's damage code);
// a seed never invents a value to complete a step, and a seeded step can never grade pass.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { resistanceLaw, resistanceByElement, seedBestiarySteps } from '@/lib/catalog/reference/stepSeeds';
import { wrapTable } from '@/lib/catalog/reference/wrapper';
import { DIABLO1 } from '@/lib/catalog/reference/sources';

const monSpec = DIABLO1.tables.find((t) => t.catalogId === 'bestiary')!;
const COLS = Object.keys(monSpec.map);
const tsv = (rows: Record<string, string>[]) => [COLS.join('\t'), ...rows.map((r) => COLS.map((c) => r[c] ?? '').join('\t'))].join('\n');
const zombie = () => wrapTable(DIABLO1, monSpec, tsv([{ _monster_id: 'MT_NZOMBIE', name: 'Zombie', resistance: 'IMMUNE_MAGIC', resistanceHell: 'IMMUNE_MAGIC' }]), 't0').wrappers[0];
const grade = (step: string, data: Record<string, unknown>) =>
  getCatalogPipeline('bestiary')!.steps.find((s) => s.label === step)!.accept(data, { catalog: 'bestiary', siblings: {}, has: () => true, canonProfile: 'diablo1' });

describe('the resistance law, read from its canon rule', () => {
  it('is 0 / 75 / 100 — as devilutionX computes it (dam >>= 2; immune skips the hit)', () => {
    expect(resistanceLaw()).toEqual({ normal: 0, resist: 75, immune: 100 });
  });

  it('maps real flag lists per element; flags for other elements are ignored', () => {
    expect(resistanceByElement('IMMUNE_MAGIC')).toEqual({ MAGIC: 100, FIRE: 0, LIGHTNING: 0 });
    expect(resistanceByElement('IMMUNE_MAGIC,RESIST_FIRE')).toEqual({ MAGIC: 100, FIRE: 75, LIGHTNING: 0 });
    expect(resistanceByElement('')).toEqual({ MAGIC: 0, FIRE: 0, LIGHTNING: 0 });
  });
});

describe('seedBestiarySteps on a real zombie row', () => {
  const seeds = seedBestiarySteps(zombie());

  it('seeds Resistances and Monster Rarity, each stamped with its source row', () => {
    expect(seeds.map((s) => s.step)).toEqual(['Resistances', 'Monster Rarity']);
    for (const s of seeds) expect((s.data.sourced as { sourceRow: string }).sourceRow).toBe('_monster_id=MT_NZOMBIE');
  });

  it('writes the diablo1 element set — magic, fire, lightning — and nothing PoF-only (D14)', () => {
    const r = seeds[0].data;
    expect(r.resists).toEqual({ magicRes: 100, fireRes: 0, lightningRes: 0 });
    expect(seeds[0].gaps.join(' ')).not.toMatch(/iceRes|chaosRes|magicRes/);
  });

  it('the real Resistances step is satisfied by Diablo’s own element set — and still held at SOURCED, never pass', () => {
    const v = grade('Resistances', seeds[0].data);
    expect(v.status).toBe('pending');
    expect(v.reason).toMatch(/^SOURCED:/);
    const unsourced = { ...seeds[0].data };
    delete unsourced.sourced;
    expect(grade('Resistances', unsourced).status).toBe('pass');
  });

  it('the real Monster Rarity step never passes it either', () => {
    expect(grade('Monster Rarity', seeds[1].data).status).not.toBe('pass');
  });

  it('only ordinary-monster rows (monstdat) are seeded', () => {
    expect(seedBestiarySteps({ ...zombie(), file: 'monsters/unique_monstdat.tsv' })).toEqual([]);
  });
});
