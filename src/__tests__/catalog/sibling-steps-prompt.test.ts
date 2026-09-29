import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-sibling-steps-${process.pid}.db`;
});

import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { buildStepProducePrompt } from '@/lib/catalog/stepPrompt';
import { buildStepRecipe, listEntitySummaries } from '@/lib/catalog/headless';
import { SIBLING_STEPS_MAX_CHARS } from '@/lib/catalog/siblingSteps';
import { SOURCED_FIELD } from '@/lib/catalog/acceptance/sourced';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';

const catalogId = 'items';
const pipeline = getCatalogPipeline(catalogId)!;
const [first, current, third, fourth] = pipeline.steps;
const entity = {
  id: 'sibling-prompt-entity',
  name: 'Sibling Prompt Entity',
  lifecycle: 'planned' as const,
  data: { category: 'test item' },
};

describe('sibling steps produce-prompt section', () => {
  it('is absent when no siblings are supplied', () => {
    const prompt = buildStepProducePrompt(current, entity, undefined, { catalogId, rules: [] });
    expect(prompt).not.toContain('# SIBLING STEPS');
  });

  it('is pipeline-ordered, excludes the current step, marks sourced data, and strips bookkeeping', () => {
    const prompt = buildStepProducePrompt(current, entity, undefined, {
      catalogId,
      rules: [],
      siblings: {
        [fourth.label]: { value: 'fourth-value' },
        [current.label]: { value: 'current-step-must-not-appear' },
        [first.label]: {
          value: 'first-value',
          wiringContract: { grantedBy: 'kept' },
          genHistory: { batches: ['large-history'] },
          [SOURCED_FIELD]: {
            sourceGame: 'Reference Game',
            sourceFile: 'items.tsv',
            sourceRow: 'id=1',
            columns: ['value'],
          },
        },
      },
    });

    const sectionStart = prompt.indexOf('# SIBLING STEPS');
    const contractStart = prompt.indexOf('# ACCEPTANCE CONTRACT');
    const section = prompt.slice(sectionStart, contractStart);
    expect(sectionStart).toBeGreaterThan(prompt.indexOf('# ENTITY VALUES'));
    expect(contractStart).toBeGreaterThan(sectionStart);
    expect(section.indexOf(`## ${first.label}`)).toBeLessThan(section.indexOf(`## ${fourth.label}`));
    expect(section).not.toContain('current-step-must-not-appear');
    expect(section).toContain('seeded from the reference — reproduce, do not contradict');
    expect(section).toContain('"wiringContract":{"grantedBy":"kept"}');
    expect(section).not.toContain('"sourced"');
    expect(section).not.toContain('"genHistory"');
  });

  it('names every step omitted by the total budget instead of cutting its JSON', () => {
    const prompt = buildStepProducePrompt(fourth, entity, undefined, {
      catalogId,
      rules: [],
      siblings: {
        [first.label]: { huge: 'x'.repeat(SIBLING_STEPS_MAX_CHARS) },
        [current.label]: { value: 'small-but-after-the-cut' },
        [third.label]: { value: 'also-after-the-cut' },
      },
    });
    const start = prompt.indexOf('# SIBLING STEPS');
    const end = prompt.indexOf('# ACCEPTANCE CONTRACT');
    const section = prompt.slice(start, end);

    expect(section.length).toBeLessThanOrEqual(SIBLING_STEPS_MAX_CHARS);
    expect(section).toContain('## Omitted by prompt size cap');
    expect(section).toContain(`- ${first.label}`);
    expect(section).toContain(`- ${current.label}`);
    expect(section).toContain(`- ${third.label}`);
    expect(section).not.toContain('small-but-after-the-cut');
  });
});

describe('headless sibling propagation', () => {
  it('includes a persisted sibling artifact for a real registered pipeline', () => {
    const seeded = listEntitySummaries(catalogId)[0];
    const siblingData = { siblingRecipeSentinel: 'persisted-real-sibling' };
    upsertArtifact({
      catalogId,
      entityId: seeded.id,
      step: first.label,
      data: siblingData,
      ueAssets: [],
      status: 'pending',
      tier: 'L0',
    });

    const recipe = buildStepRecipe(catalogId, seeded.id, current.label, undefined, []);
    expect(recipe.prompt).toContain('# SIBLING STEPS');
    expect(recipe.prompt).toContain(`## ${first.label}`);
    expect(recipe.prompt).toContain('"siblingRecipeSentinel":"persisted-real-sibling"');
  });
});
