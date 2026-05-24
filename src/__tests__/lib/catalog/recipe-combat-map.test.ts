import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { CombatInteractionEntry } from '@/lib/catalog/types';
import { COMBO_SEQUENCES } from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const realCombo = COMBO_SEQUENCES[0];
const sample: CombatInteractionEntry = {
  id: `combo-${realCombo.id}`, catalogId: 'combat-map', name: realCombo.name,
  categoryPath: ['Combat Map', realCombo.weaponCategory], tags: [realCombo.weaponCategory], lifecycle: 'planned',
  data: realCombo,
};

describe('Combat Map recipe', () => {
  it('exists with wire+verify steps (no scaffold/author — wiring of existing abilities)', () => {
    const r = getRecipe('combat-map');
    expect(r).toBeDefined();
    expect(r!.steps).toEqual(['wire', 'verify']);
  });
  it('wire prompt names HitReact + damage tag wiring', () => {
    const p = getRecipe('combat-map')!.buildStepPrompt(sample, 'wire', ctx);
    expect(p).toContain(realCombo.name);
    expect(p).toContain('HitReact');
    expect(p).toContain('Damage');
  });
  it('verify prompt references VSCombat_DamageMatrixTest', () => {
    const p = getRecipe('combat-map')!.buildStepPrompt(sample, 'verify', ctx);
    expect(p).toContain('VSCombat_DamageMatrixTest');
  });
});
