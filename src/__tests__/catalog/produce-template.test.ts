/**
 * `stampTemplate` — the stub-produce write sites mark a data-blind body's output as the catalog
 * exemplar's template when it was written for any OTHER entity. "Data-blind" is observed (the body
 * is re-run with `data` blanked), never declared. The exemplar is the first CATALOG_SECTIONS seed —
 * the entity the Rule 5 walker opens — so the walker's stub pass is unchanged.
 */
import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { exemplarIdFor, stampTemplate } from '@/lib/catalog/produceTemplate';
import { TEMPLATE_FIELD } from '@/lib/catalog/acceptance/template';
import { siblingStepsBlock } from '@/lib/catalog/siblingSteps';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const statBlock = getCatalogPipeline('characters')!.steps.find((s) => s.label === 'Stat Block')!;
const vael = CATALOG_SECTIONS.find((s) => s.catalogId === 'characters')!.seed()[0] as unknown as LabEntity;
const other = { id: 'char-other', name: 'Other', lifecycle: 'planned', data: { stats: { health: 1 } } } as LabEntity;

describe('stampTemplate', () => {
  it('the characters exemplar is the first seeded entity (the one the walker opens)', () => {
    expect(exemplarIdFor('characters')).toBe('char-captain-vael');
    expect(vael.id).toBe('char-captain-vael');
  });

  it('stamps a data-blind stub written for a non-exemplar entity', () => {
    const out = stampTemplate('characters', statBlock, other, statBlock.produce(other));
    expect((out.data as Record<string, unknown>)[TEMPLATE_FIELD]).toEqual({ exemplar: 'char-captain-vael', entity: 'char-other' });
  });

  it('the stamped stub grades pending through the registered checker', () => {
    const out = stampTemplate('characters', statBlock, other, statBlock.produce(other));
    const r = statBlock.accept(out.data as Record<string, unknown>);
    expect(r.status).not.toBe('pass');
  });

  it('[guard] never stamps the exemplar itself', () => {
    const out = stampTemplate('characters', statBlock, vael, statBlock.produce(vael));
    expect(TEMPLATE_FIELD in (out.data as Record<string, unknown>)).toBe(false);
  });

  it('does not stamp a body that reads the entity (output differs when data is blanked)', () => {
    const reads = { produce: (e: LabEntity) => ({ data: { v: (e.data as { v?: number }).v ?? 0 } }) };
    const e2 = { id: 'e2', name: 'E2', lifecycle: 'planned', data: { v: 7 } } as LabEntity;
    const out = stampTemplate('x', reads, e2, reads.produce(e2));
    expect(TEMPLATE_FIELD in (out.data as Record<string, unknown>)).toBe(false);
    // …and the same data-reading body stays unstamped in a catalog that HAS an exemplar.
    const inCharacters = stampTemplate('characters', reads, e2, reads.produce(e2));
    expect(TEMPLATE_FIELD in (inCharacters.data as Record<string, unknown>)).toBe(false);
  });

  it('returns out unchanged without a catalog id', () => {
    const out = statBlock.produce(other);
    expect(stampTemplate(undefined, statBlock, other, out)).toBe(out);
  });

  it('treats a body that throws on blanked data as reading the entity (no stamp)', () => {
    const throws = { produce: (e: LabEntity) => ({ data: { n: (e.data as { a: { n: number } }).a.n } }) } as Pick<StepSpec, 'produce'>;
    const e3 = { id: 'e3', name: 'E3', lifecycle: 'planned', data: { a: { n: 1 } } } as LabEntity;
    const out = stampTemplate('characters', throws, e3, throws.produce(e3));
    expect(TEMPLATE_FIELD in (out.data as Record<string, unknown>)).toBe(false);
  });
});

describe('siblingStepsBlock — a template sibling', () => {
  it('is labelled as the exemplar\'s template, and the stamp itself is not rendered', () => {
    const block = siblingStepsBlock('characters', 'Behavior (NPC)', {
      'Stat Block': { stats: {}, [TEMPLATE_FIELD]: { exemplar: 'char-captain-vael', entity: 'char-other' } },
    });
    const heading = block.split('\n').find((l) => l.startsWith('## Stat Block'))!;
    expect(heading).toContain('char-captain-vael template');
    expect(heading).toContain('not this entity');
    expect(block).not.toContain(`"${TEMPLATE_FIELD}"`);
  });
});
