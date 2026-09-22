// /diablo W03 (decision D14): the damage-element vocabulary is scoped by canon profile. A Diablo
// monster's Resistances used to be graded against PoF's fire/ice/lightning/chaos — permanently
// pending on two elements the game does not have, while its real third element (magic) had no column.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { CANON_PROFILES, DEFAULT_CANON_PROFILE } from '@/lib/catalog/canon/profiles';
import { ELEMENTS_BY_PROFILE, ELEMENTS_DEFAULT_PROFILE, elementsOf } from '@/lib/catalog/canon/elements';
import { requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';
import { stepContractBlock } from '@/lib/catalog/contractPrompt';
import { resistanceByElement } from '@/lib/catalog/reference/stepSeeds';

const resistances = getCatalogPipeline('bestiary')!.steps.find((s) => s.label === 'Resistances')!;
const ctx = (canonProfile?: string) => ({ catalog: 'bestiary', siblings: {}, has: () => true, canonProfile });

describe('element vocabulary per canon profile', () => {
  it('every canon profile declares an element set, and the default mirrors DEFAULT_CANON_PROFILE', () => {
    expect(ELEMENTS_DEFAULT_PROFILE).toBe(DEFAULT_CANON_PROFILE);
    for (const id of Object.keys(CANON_PROFILES)) expect(ELEMENTS_BY_PROFILE[id]?.length).toBeGreaterThan(0);
    expect(() => elementsOf('no-such-profile')).toThrow(/declares no element set/);
  });

  it('the diablo1 set matches the elements the monstdat seed reads', () => {
    expect(Object.keys(resistanceByElement('')).map((e) => e.toLowerCase()).sort()).toEqual([...elementsOf('diablo1')].sort());
  });
});

describe('Resistances grades the entity’s own element set', () => {
  const d1 = { resists: { magicRes: 0, fireRes: 75, lightningRes: 0 } };

  it('a Diablo monster with magic/fire/lightning passes; PoF’s ice/chaos are not asked of it', () => {
    expect(resistances.accept(d1, ctx('diablo1')).status).toBe('pass');
  });

  it('a PoF entity still needs all four PoF elements', () => {
    const r = resistances.accept(d1, ctx());
    expect(r.status).toBe('pending');
    expect(r.reason).toMatch(/missing: iceRes, chaosRes/);
    expect(resistances.accept({ resists: { fireRes: 1, iceRes: 1, lightningRes: 1, chaosRes: 1 } }, ctx('pof')).status).toBe('pass');
  });

  it('the prompt names the keys of the entity’s profile', () => {
    expect(requiredFieldsOf(resistances.accept, 'diablo1').find((r) => r.field === 'resists')?.keys).toEqual(['magicRes', 'fireRes', 'lightningRes']);
    const zombie = { id: 'd1-MT_NZOMBIE', name: 'Zombie', lifecycle: 'planned' as const, data: {}, canonProfile: 'diablo1' };
    const block = stepContractBlock(resistances, zombie);
    expect(block).toContain('`magicRes`');
    expect(block).not.toContain('`iceRes`');
    const pof = stepContractBlock(resistances, { id: 'b', name: 'Brute', lifecycle: 'planned', data: {} });
    expect(pof).toContain('`chaosRes`');
  });
});
