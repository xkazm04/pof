// /diablo W03 (decision D12): no produce stub's content reaches a live prompt. The contract a
// prompt injects is the step's world-neutral DECLARATION (`StepSpec.contract`); a step without
// one injects none. Declarations themselves are guarded in contract-declarations-neutral.test.ts.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepContractBlock, stepContractRequirements } from '@/lib/catalog/contractPrompt';

describe('no stub content reaches a live prompt', () => {
  it('a Diablo zombie’s Abilities prompt carries no PoF ability', () => {
    const ab = getCatalogPipeline('bestiary')!.steps.find((s) => s.label === 'Abilities')!;
    const zombie = { id: 'd1-MT_NZOMBIE', name: 'Zombie', lifecycle: 'planned' as const, data: {} };
    const block = stepContractBlock(ab, zombie);
    expect(block).toContain('spellbook::<id> for EACH ability this entity uses');
    expect(block).not.toMatch(/off-phy|Ground Slam|Heavy Attack|lt-Brute/);
  });

  it('a step without a declaration injects no contract — never its stub’s', () => {
    for (const p of allCatalogPipelines()) for (const s of p.steps) {
      if (s.contract) continue;
      expect(stepContractRequirements(s, { id: 'x', name: 'X', lifecycle: 'planned', data: {} })).toEqual([]);
    }
  });

  it('fills {slug} and {name} for the entity in hand', () => {
    const st = getCatalogPipeline('bestiary')!.steps.find((s) => s.label === 'Stat Block')!;
    const [r] = stepContractRequirements(st, { id: 'd1', name: 'Black Death', lifecycle: 'planned', data: {} });
    expect(r.activatedBy).toContain('BP_BlackDeath');
    expect(r.verification).toContain('Black Death spawns');
  });
});
