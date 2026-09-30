/**
 * The 7 bespoke-owned Items labels (Attributes, 3D Generation, Material / Texture, Animations,
 * VFX, SFX, Inventory UI Integration) get the generic produce door and the TEMPLATE hold.
 *
 * Measured before this change: every bespoke produce body is data-blind (it writes the exemplar's
 * sword stub for any item), and the bespoke checkers carried no `templateGuard`. On item-2 five of
 * the seven labels graded `pass` on that stub, in the lab AND on the server (`serverCheckerFor`
 * falls back to `ITEMS_BESPOKE_CHECKERS`). A stub written for a non-exemplar item is the
 * exemplar's template, so it may never read `pass`.
 *
 * The adapter specs (`itemsBespokeSpecs.ts`) are also what a LIVE CLI session is prompted from,
 * so the four text (`rules`) labels must declare their graded keys world-neutrally: the bespoke
 * checkers are untagged, so without a declaration the prompt would name no graded key at all.
 */
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { ITEMS_BESPOKE_CHECKERS } from '@/lib/catalog/acceptance/itemsBespokeCheckers';
import { serverCheckerFor } from '@/lib/catalog/headless';
import { buildStepProducePrompt } from '@/lib/catalog/stepPrompt';
import { exemplarIdFor, stampTemplate } from '@/lib/catalog/produceTemplate';
import { CATALOG_SECTIONS, seedAllCatalogs } from '@/lib/catalog/sections';
import { isCliEligible } from '@/lib/catalog/cliEligibility';
import { ITEM_STEP_SPECS, DEFAULT_SFX_CUES } from '@/components/layout-lab/steps/itemsSteps';
import { itemsStepSpec, itemsRegisteredStep, produceItemStep } from '@/components/layout-lab/itemsLabelOwner';
import { ITEMS_BESPOKE_LABELS, itemsBespokeStepSpec } from '@/components/layout-lab/itemsBespokeSpecs';
import { resolveAccept } from '@/components/layout-lab/labAcceptance';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const SEED = CATALOG_SECTIONS.find((s) => s.catalogId === 'items')!.seed();
const lab = (id: string): LabEntity => {
  const e = SEED.find((x) => x.id === id)!;
  return { id: e.id, name: e.name, lifecycle: 'planned', data: (e as { data?: unknown }).data };
};
const ITEM_1 = lab('item-1');
const ITEM_2 = lab('item-2');
const RULES = ['Animations', 'VFX', 'SFX', 'Inventory UI Integration'];
const SHAPE_PASSING = ['Attributes', ...RULES];

describe('TEMPLATE hold on the bespoke Items checkers', () => {
  it('item-1 is the items exemplar (precondition)', () => {
    expect(exemplarIdFor('items')).toBe('item-1');
  });

  it('SFX over the exemplar stub stamped for item-2 reads pending TEMPLATE, lab and server alike', () => {
    const data = { cues: DEFAULT_SFX_CUES, template: { exemplar: 'item-1', entity: 'item-2' } };
    for (const checker of [ITEMS_BESPOKE_CHECKERS['SFX'], serverCheckerFor('items', 'SFX')!]) {
      const r = checker(data);
      expect(r.status).toBe('pending');
      expect(String(r.reason)).toMatch(/^TEMPLATE: item-1 template/);
    }
    // The shape still passes without the stamp — the guard holds, it does not re-grade.
    expect(ITEMS_BESPOKE_CHECKERS['SFX']({ cues: DEFAULT_SFX_CUES }).status).toBe('pass');
  });

  it('every shape-passing bespoke stub produced for item-2 is held, never pass', () => {
    for (const label of SHAPE_PASSING) {
      const out = produceItemStep(ITEM_2, label)!;
      expect(out.data?.template, label).toEqual({ exemplar: 'item-1', entity: 'item-2' });
      const r = resolveAccept('items', label)!((out.data ?? {}) as Record<string, unknown>);
      expect(r.status, label).toBe('pending');
      expect(String(r.reason), label).toMatch(/^TEMPLATE:/);
    }
  });

  it('[guard] the exemplar item-1 is never stamped and its stubs still pass', () => {
    for (const label of SHAPE_PASSING) {
      const out = produceItemStep(ITEM_1, label)!;
      expect(out.data?.template, label).toBeUndefined();
      expect(resolveAccept('items', label)!((out.data ?? {}) as Record<string, unknown>).status, label).toBe('pass');
    }
  });
});

describe('itemsBespokeSpecs — the 7 bespoke labels as StepSpecs', () => {
  it('covers exactly the bespoke-owned labels, with the honest archetype per deliverable', () => {
    expect([...ITEMS_BESPOKE_LABELS].sort()).toEqual(
      ['3D Generation', 'Animations', 'Attributes', 'Inventory UI Integration', 'Material / Texture', 'SFX', 'VFX'],
    );
    const arch = Object.fromEntries(ITEMS_BESPOKE_LABELS.map((l) => [l, itemsBespokeStepSpec(l)!.archetype]));
    expect(arch).toEqual({
      'Attributes': 'schema', '3D Generation': 'gallery', 'Material / Texture': 'gallery',
      'Animations': 'rules', 'VFX': 'rules', 'SFX': 'rules', 'Inventory UI Integration': 'rules',
    });
    expect(ITEMS_BESPOKE_LABELS.filter((l) => isCliEligible(itemsBespokeStepSpec(l)!.archetype)).sort()).toEqual([...RULES].sort());
  });

  it('grades with the SAME checker the server serves, and produces what the lab produces', () => {
    for (const label of ITEMS_BESPOKE_LABELS) {
      const spec = itemsBespokeStepSpec(label)!;
      expect(spec.label).toBe(label);
      expect(spec.accept, label).toBe(serverCheckerFor('items', label));
      for (const e of SEED) {
        const le: LabEntity = { id: e.id, name: e.name, lifecycle: 'planned', data: (e as { data?: unknown }).data };
        expect(spec.produce(le), `${label} · ${e.id}`).toEqual(ITEM_STEP_SPECS[label].produce(le));
      }
    }
  });

  it('itemsStepSpec resolves registered first, then the bespoke adapter; unknown is undefined', () => {
    expect(itemsStepSpec('Economy')).toBe(itemsRegisteredStep('Economy'));
    expect(itemsStepSpec('Animations')).toBe(itemsBespokeStepSpec('Animations'));
    expect(itemsStepSpec('Not A Real Step')).toBeUndefined();
  });

  it('a stub written through the adapter for item-2 is stamped (the one-shot deterministic door)', () => {
    const spec = itemsBespokeStepSpec('Animations')!;
    const out = stampTemplate('items', spec, ITEM_2, spec.produce(ITEM_2));
    expect(out.data?.template).toEqual({ exemplar: 'item-1', entity: 'item-2' });
  });
});

describe('the live prompt carries the graded keys, world-neutrally', () => {
  it('buildStepProducePrompt(Animations, item-2) names `clips` and no seeded entity other than item-2', () => {
    const prompt = buildStepProducePrompt(itemsStepSpec('Animations')!, ITEM_2, 'd');
    expect(prompt).toContain('clips');
    const leaks: string[] = [];
    for (const byId of Object.values(seedAllCatalogs())) {
      for (const e of Object.values(byId)) {
        if (e.id === ITEM_2.id || e.name === ITEM_2.name || e.name.length < 5) continue;
        const esc = e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(^|[^\\w-])${esc}($|[^\\w-])`).test(prompt)) leaks.push(e.name);
      }
    }
    expect(leaks).toEqual([]);
  });

  it('each text step names its own graded keys in its criteria', () => {
    const want: Record<string, string[]> = {
      'Animations': ['clips'], 'VFX': ['variants', 'cost', 'cap'], 'SFX': ['cues'], 'Inventory UI Integration': ['slot', 'wired'],
    };
    for (const [label, keys] of Object.entries(want)) {
      const text = (itemsBespokeStepSpec(label)!.criteria ?? []).join('\n');
      for (const k of keys) expect(text, `${label} criteria omit \`${k}\``).toContain(`\`${k}\``);
    }
  });
});
