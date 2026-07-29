import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import {
  findWiringContracts,
  findCriteria,
  stepContractBlock,
  stepContractRequirements,
  catalogContractRequirements,
  catalogCriteriaLines,
  canonCategoriesForStep,
  CONTRACT_RULE,
  MAX_STEP_CONTRACT_CHARS,
  MAX_CATALOG_CONTRACT_ROWS,
  MAX_CRITERIA_LINES,
  MAX_CLAIM_CHARS,
} from '@/lib/catalog/contractPrompt';
import { markContentInvariant } from '@/lib/catalog/acceptance/contentInvariant';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const ENTITY: LabEntity = { id: 'test-entity', name: 'Test Entity', lifecycle: 'planned', data: {} };

const spec = (produce: StepSpec['produce'], over: Partial<StepSpec> = {}): StepSpec => ({
  archetype: 'checklist',
  label: 'Wiring',
  view: { kind: 'checklist', field: 'checks' },
  produce,
  accept: () => ({ label: 'x', tier: 'L0', status: 'pass', detail: '' }),
  ...over,
});

const CONTRACT = {
  grantedBy: 'BP_JediPlayer DefaultAbilities array (granted at BeginPlay)',
  activatedBy: 'IA_Attack input action → GA activation by tag Ability.Melee',
  dependencies: ['spellbook::ga-slash', 'state-graph::montage-slash'],
  verification: 'L3 functional test VSAbility09Test asserts target Health drops',
};

describe('contractPrompt — pure extraction', () => {
  it('finds a root wiring contract', () => {
    const found = findWiringContracts({ wiringContract: CONTRACT });
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe('');
    expect(found[0].contract.grantedBy).toBe(CONTRACT.grantedBy);
  });

  it('finds nested wiring contracts and reports their dot-path', () => {
    const found = findWiringContracts({ layers: { bed: { wiringContract: CONTRACT } } });
    expect(found.map((f) => f.path)).toEqual(['layers.bed']);
  });

  it('ignores a malformed (non-object) contract', () => {
    expect(findWiringContracts({ wiringContract: 'TBD' })).toHaveLength(0);
  });

  it('flattens criteria that are strings, arrays and keyed objects', () => {
    const s = findCriteria({ gate: { criteria: 'visible sclera + defined pupils' } });
    expect(s[0]).toEqual({ path: 'gate.criteria', text: 'visible sclera + defined pupils' });

    const o = findCriteria({ criteria: { contrastTarget: '>=4.5:1', minDisplaySize: 32 } });
    expect(o.map((c) => c.path)).toEqual(['criteria.contrastTarget', 'criteria.minDisplaySize']);
    expect(o[1].text).toBe('32');

    const a = findCriteria({ criteria: ['one', 'two'] });
    expect(a.map((c) => c.text)).toEqual(['one', 'two']);
  });

  it('clamps an over-long claim instead of dumping it into the prompt', () => {
    const long = 'x'.repeat(MAX_CLAIM_CHARS * 3);
    const reqs = stepContractRequirements(spec(() => ({ data: { wiringContract: { ...CONTRACT, grantedBy: long } } })), ENTITY);
    expect(reqs[0].grantedBy!.length).toBeLessThanOrEqual(MAX_CLAIM_CHARS);
    expect(reqs[0].grantedBy!.endsWith('…')).toBe(true);
  });

  it('never throws a produce error into a prompt', () => {
    const boom = spec(() => { throw new Error('produce exploded'); });
    expect(stepContractBlock(boom, ENTITY)).toBe('');
    expect(stepContractRequirements(boom, ENTITY)).toEqual([]);
  });

  it('returns an empty block for a step that declares no contract and no criteria', () => {
    expect(stepContractBlock(spec(() => ({ data: { checks: ['a'] } })), ENTITY)).toBe('');
  });
});

describe('contractPrompt — rendered block (golden)', () => {
  it('pins the exact block a contract-bearing step injects', () => {
    const block = stepContractBlock(
      spec(() => ({ data: { wiringContract: CONTRACT, gate: { criteria: 'eyes survive meshing' } } })),
      ENTITY,
    );
    expect(block).toBe(
      [
        '# ACCEPTANCE CONTRACT FOR THIS STEP (you are graded against it)',
        '',
        '## Wiring contract — Wiring',
        '- **Granted by**: BP_JediPlayer DefaultAbilities array (granted at BeginPlay)',
        '- **Activated by**: IA_Attack input action → GA activation by tag Ability.Melee',
        '- **Dependencies**: spellbook::ga-slash, state-graph::montage-slash',
        '- **Verification**: L3 functional test VSAbility09Test asserts target Health drops',
        '',
        '## Authored criteria',
        '- Wiring — `gate.criteria`: eyes survive meshing',
        '',
        CONTRACT_RULE,
      ].join('\n'),
    );
  });

  it('pins a nested contract path in the artifact heading', () => {
    const block = stepContractBlock(
      spec(() => ({ data: { triggerProgress: { wiringContract: CONTRACT } } }), { label: 'Triggers' }),
      ENTITY,
    );
    expect(block).toContain('## Wiring contract — Triggers · triggerProgress');
  });
});

describe('contractPrompt — canon scoping by invariant', () => {
  it('gives a content-invariant step the FULL in-scope canon (no category filter)', () => {
    const invariant = spec(() => ({ data: {} }), {
      archetype: 'balance',
      accept: markContentInvariant(() => ({ label: 'x', tier: 'L2', status: 'pass', detail: '' })),
    });
    expect(canonCategoriesForStep(invariant)).toBeUndefined();
  });

  it('keeps the archetype slice for a shape-only step', () => {
    expect(canonCategoriesForStep(spec(() => ({ data: {} }), { archetype: 'gallery' }))).toEqual(['art', 'game']);
  });
});

describe('contractPrompt — prompt-size guard over the LIVE registry', () => {
  const pipelines = allCatalogPipelines();

  it('registers pipelines (guard is meaningless otherwise)', () => {
    expect(pipelines.length).toBeGreaterThan(20);
  });

  it('no step contract block exceeds MAX_STEP_CONTRACT_CHARS', () => {
    const over: string[] = [];
    for (const p of pipelines) {
      for (const s of p.steps) {
        const block = stepContractBlock(s, ENTITY);
        // The rule line is appended after the cap arithmetic; allow its length as slack.
        if (block.length > MAX_STEP_CONTRACT_CHARS + CONTRACT_RULE.length) {
          over.push(`${p.catalogId} · ${s.label} = ${block.length}`);
        }
      }
    }
    expect(over).toEqual([]);
  });

  it('no catalog contract table exceeds its row/criteria caps', () => {
    for (const p of pipelines) {
      expect(catalogContractRequirements(p, ENTITY).length).toBeLessThanOrEqual(MAX_CATALOG_CONTRACT_ROWS);
      expect(catalogCriteriaLines(p, ENTITY).length).toBeLessThanOrEqual(MAX_CRITERIA_LINES);
    }
  });

  it('carries a contract into ≥30 real steps (the direction bar)', () => {
    const bearing = pipelines.flatMap((p) =>
      p.steps.filter((s) => stepContractRequirements(s, ENTITY).length > 0).map((s) => `${p.catalogId} · ${s.label}`),
    );
    // Measured from the live registry — see the test output for the exact roster.
    expect(bearing.length).toBeGreaterThanOrEqual(30);
    for (const key of bearing.slice(0, 5)) expect(key).toContain(' · ');
  });

  it('an unregistered catalog degrades to no contract, never a throw', () => {
    expect(catalogContractRequirements(getCatalogPipeline('no-such-catalog'), ENTITY)).toEqual([]);
    expect(catalogCriteriaLines(null, ENTITY)).toEqual([]);
  });
});
