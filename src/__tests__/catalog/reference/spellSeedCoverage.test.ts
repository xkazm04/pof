import { describe, expect, it } from 'vitest';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import '@/lib/catalog/pipelines/registry.generated';
import { allOfMembers } from '@/lib/catalog/acceptance/combinators';
import { referenceCaster } from '@/lib/catalog/reference/spellLaw';
import { SPELL_SPECS } from '@/lib/catalog/reference/spellSpecs';
import { seedSpellSteps } from '@/lib/catalog/reference/stepSeeds';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

const table = DIABLO1.tables.find((candidate) => candidate.catalogId === 'spellbook')!;
const columns = Object.keys(table.map);
const caster = referenceCaster({
  className: 'Invented Caster',
  level: 4,
  attributes: { baseMag: '20', baseMagicToHit: '50', adjMana: '0', lvlMana: '5', chrMana: '1' },
  animations: { castingFrames: '10', castingActionFrame: '6' },
});

function wrapper(spell: string, element: string) {
  const raw: Record<string, string> = { id: spell, name: spell, manaCost: '5', flags: element === 'none' ? '' : element };
  const tsv = [columns.join('\t'), columns.map((column) => raw[column] ?? '').join('\t')].join('\n');
  return wrapTable(DIABLO1, table, tsv, 'invented').wrappers[0];
}

describe('seedSpellSteps coverage', () => {
  it('gives every vanilla spell Effect Logic and Applies Status, plus Balance for damaging spells', () => {
    for (const spec of SPELL_SPECS) {
      const seeds = seedSpellSteps(wrapper(spec.spell, spec.element), caster);
      const expected = spec.damage.kind === 'none'
        ? ['Effect Logic', 'Applies Status']
        : ['Effect Logic', 'Balance', 'Applies Status'];
      expect(seeds.map((seed) => seed.step), spec.spell).toEqual(expected);
    }
  });

  it('uses the pipeline conditional shape and omits damage-only fields for utility effects', () => {
    const effectStep = getCatalogPipeline('spellbook')!.steps.find((step) => step.label === 'Effect Logic')!;
    for (const spec of SPELL_SPECS) {
      const seed = seedSpellSteps(wrapper(spec.spell, spec.element), caster)[0];
      const effect = seed.data.effect as Record<string, unknown>;
      const entry = (seed.data.effects as Record<string, unknown>[])[0];
      expect(effect.kind, spec.spell).toBe(spec.effectKind);
      if (spec.damage.kind === 'none') {
        expect(effect.baseDamage, spec.spell).toBeUndefined();
        expect(effect.damageType, spec.spell).toBeUndefined();
        expect(entry.damageType, spec.spell).toBeUndefined();
      } else {
        expect(entry.kind, spec.spell).toBe('damage');
        expect(entry.damageType, spec.spell).toBeDefined();
      }
      const conditional = allOfMembers(effectStep.accept!)!
        .find((checker) => checker(seed.data).label === 'Damage effects declare their damage type');
      expect(conditional?.(seed.data).status, spec.spell).toBe('pass');
    }
  });
});
