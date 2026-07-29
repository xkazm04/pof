import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepContractBlock } from '@/lib/catalog/contractPrompt';
import { SPELLBOOK_RECIPE, ITEMS_RECIPE } from '@/lib/catalog/recipe';
import { expectGolden } from './golden';
import type { AbilityEntry, ItemEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * Goldens for WIRING CONTRACTS REACHING PROMPTS.
 *
 * Two seams are pinned:
 *  - the per-step block the generic `ArchetypeStep.buildPrompt` prepends for the
 *    ~330 generic lab steps (and the headless `buildStepRecipe`),
 *  - the catalog-wide Wiring Requirements + Success Criteria the four-phase
 *    `recipeBuilder` injects.
 *
 * Re-record intentionally: POF_UPDATE_GOLDEN=1 npx vitest run src/__tests__/lib/prompts
 */

const ctx: ProjectContext = {
  projectName: 'PoF', projectPath: 'C:/proj/PoF', ueVersion: '5.7', dynamicContext: undefined,
};

const LAB_ENTITY: LabEntity = { id: 'itm-blade', name: 'Ashen Blade', lifecycle: 'planned', data: {} };

const fireball: AbilityEntry = {
  id: 'ga-fireball', catalogId: 'spellbook', name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'], tags: ['basic'], lifecycle: 'planned',
  data: {
    id: 'off-fire-01', name: 'Fireball', category: 'Offensive', element: 'Fire', tier: 'basic',
    damage: 35, manaCost: 20, cooldown: 3, radar: [0.7, 0.85, 0.3, 0.5, 0.5],
    description: 'Hurl a ball of fire', color: '#f00', tag: 'Ability.Fire.Fireball',
  },
};

const blade = {
  id: 'itm-blade', catalogId: 'items', name: 'Ashen Blade',
  categoryPath: ['Weapons'], tags: ['sword'], lifecycle: 'planned',
  data: { id: 'itm-blade', name: 'Ashen Blade', slot: 'weapon', rarity: 'rare' },
} as unknown as ItemEntry;

/** The first contract-bearing step of a catalog (the generic-seam sample). */
function firstContractStep(catalogId: string) {
  const p = getCatalogPipeline(catalogId);
  if (!p) throw new Error(`no pipeline for ${catalogId}`);
  const spec = p.steps.find((s) => stepContractBlock(s, LAB_ENTITY).length > 0);
  if (!spec) throw new Error(`no contract-bearing step in ${catalogId}`);
  return spec;
}

describe('generic step seam (ArchetypeStep / headless buildStepRecipe)', () => {
  it('pins the injected contract block for a real registered items step', () => {
    expectGolden('contract-step-items', stepContractBlock(firstContractStep('items'), LAB_ENTITY));
  });

  it('pins the injected contract block for a real registered spellbook step', () => {
    expectGolden('contract-step-spellbook', stepContractBlock(firstContractStep('spellbook'), LAB_ENTITY));
  });
});

describe('recipe seam (recipeBuilder)', () => {
  it('pins the full spellbook `wire` prompt, contracts included', () => {
    expectGolden('recipe-spellbook-wire', SPELLBOOK_RECIPE.buildStepPrompt(fireball, 'wire', ctx));
  });

  it('pins the full items `verify` prompt — recipe criteria survive alongside the test line', () => {
    expectGolden('recipe-items-verify', ITEMS_RECIPE.buildStepPrompt(blade, 'verify', ctx));
  });

  it('carries the catalog wiring table into a non-verify prompt', () => {
    const p = SPELLBOOK_RECIPE.buildStepPrompt(fireball, 'wire', ctx);
    expect(p).toContain('## Wiring Requirements');
    expect(p).toContain('| Artifact | Granted by | Activated by | Dependencies | Verify |');
  });

  it('still emits the verify functional-test criterion (addSuccessCriteria appends, never replaces)', () => {
    const p = ITEMS_RECIPE.buildStepPrompt(blade, 'verify', ctx);
    expect(p).toContain('## Success Criteria');
    expect(p).toContain('VSItemsDefinitionsTest');
  });
});
