import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import {
  catalogManifest, hasStepGrader, stepSourceMap,
  ITEMS_ON_SCREEN_STEPS, itemsRegistrySteps, itemsRegistryOnlySteps, itemsAllStepLabels,
} from '@/components/layout-lab/catalogManifest';
import { resolveAccept } from '@/components/layout-lab/labAcceptance';
import { getStepComponent } from '@/components/layout-lab/steps';
import { itemsLabelOwner } from '@/components/layout-lab/itemsLabelOwner';
import { buildLabCheckerContext } from '@/components/layout-lab/labCheckerContext';
import { serverCheckerFor } from '@/lib/catalog/headless';
import { stampTemplate } from '@/lib/catalog/produceTemplate';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { ITEM_STEP_SPECS, ITEM_STEP_NAMES, populateItemDemo } from '@/components/layout-lab/steps/itemsSteps';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { deriveEntityArtifacts } from '@/components/layout-lab/hooks/useEntityArtifacts';
import { PipelineRail } from '@/components/layout-lab/PipelineRail';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact, StepOutput } from '@/components/layout-lab/labPipelineStore';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';

afterEach(cleanup);

/**
 * THE LAB MUST NOT HIDE PRODUCED WORK.
 *
 * `items` is the one catalog with two step specs (ITEMS_SPEC_DUALITY). Until 2026-08-19 the
 * manifest handed it the bespoke list ONLY and `resolveAccept` dead-ended on any label
 * outside `ITEM_STEP_SPECS` — so the 5 registry-only labels (the ones carrying the ARPG canon
 * payload: affix tier tables, base-type/GE wiring contracts, DPS derivation, surface material,
 * 3D mesh) had no screen in PoF and no on-screen grader.
 *
 * Measured against the operator's live `~/.pof/pof.db` (read-only) on 2026-08-19:
 * **90 persisted `items` rows — 59 on the 13 bespoke labels, 31 on the 5 registry-only ones.**
 * `item-3` held 11 produced, PASSING rows while the lab header read `6/13`.
 *
 * These tests pin the union — and pin that the duality stays VISIBLE (per-step source tags)
 * rather than being merged away, which would orphan every one of those 90 rows (Rule 4b:
 * `pipeline_artifacts` is keyed on `(catalog_id, entity_id, step)`).
 */

const E: LabEntity = { id: 'items-union-entity', name: 'Union Longsword', lifecycle: 'planned', data: {} };

/** The registry `StepSpec` for one items label (the 5 registry-only ones live here). */
function registrySpec(label: string) {
  const spec = getCatalogPipeline('items')?.steps.find((s) => s.label === label);
  if (!spec) throw new Error(`no registry StepSpec for items / "${label}"`);
  return spec;
}

describe('items renders the UNION of its two step specs', () => {
  // ── The headline: both halves failed before this change ──────────────────
  it('puts every registry-only label on screen WITH an on-screen grader', () => {
    const steps = catalogManifest('items').steps;
    // Derived from the two REAL sources rather than the new helper, so this test fails on
    // the claim ("Affixes is not rendered") and not on a missing export.
    const registryOnly = (getCatalogPipeline('items')?.steps ?? [])
      .map((s) => s.label)
      .filter((label) => !ITEM_STEP_NAMES.includes(label));
    expect(registryOnly.length).toBe(5);
    for (const label of registryOnly) {
      expect(steps, `"${label}" is declared by the items registry pipeline but the lab renders no step for it`).toContain(label);
      expect(hasStepGrader('items', label), `"${label}" is rendered but nothing grades it on screen`).toBe(true);
    }
    // Named explicitly so the regression reads as itself, not as a list length.
    expect(steps).toContain('Affixes');
    expect(hasStepGrader('items', 'Affixes')).toBe(true);
  });

  it('is the ordered union — bespoke 13 first, then the registry-only tail, no duplicates', () => {
    const m = catalogManifest('items');
    expect(m.steps).toEqual([...ITEM_STEP_NAMES, ...itemsRegistryOnlySteps()]);
    expect(new Set(m.steps).size).toBe(m.steps.length);
    // Nothing either spec declares can be missing — that set is exactly what a persisted
    // `pipeline_artifacts` row for this catalog can be keyed on.
    expect([...m.steps].sort()).toEqual([...itemsAllStepLabels()].sort());
    // The bespoke spec still leads: it owns the step UIs and the reference e2e walk.
    expect(m.stepSource).toBe('bespoke');
    expect(m.bespoke).toBe(true);
  });

  it('tags each step with the spec that OWNS it (the duality stays visible)', () => {
    const m = catalogManifest('items');
    expect(m.mixedStepSources).toBe(true);
    const bySource = (src: string) => m.stepEntries.filter((e) => e.source === src).map((e) => e.label);
    // A label both specs declare is registry-owned (itemsLabelOwner, the server's order).
    const shared = ITEMS_ON_SCREEN_STEPS.filter((s) => itemsRegistrySteps().includes(s));
    expect(bySource('bespoke')).toEqual(ITEMS_ON_SCREEN_STEPS.filter((s) => !shared.includes(s)));
    expect(bySource('registry')).toEqual([...shared, ...itemsRegistryOnlySteps()]);
    expect(m.stepEntries.map((e) => e.label)).toEqual(m.steps);
  });

  it('leaves single-spec catalogs untagged and unchanged', () => {
    // A plain registry catalog: every step comes from one spec, so a tag would be noise.
    const m = catalogManifest('materials');
    expect(m.mixedStepSources).toBe(false);
    expect(stepSourceMap('materials')).toBeNull();
    expect(m.steps).toEqual(getCatalogPipeline('materials')?.steps.map((s) => s.label));
    expect(m.stepEntries.every((e) => e.source === 'registry')).toBe(true);
    expect(stepSourceMap(undefined)).toBeNull();
  });
});

describe('grader precedence — the server\'s order (registered first)', () => {
  it('grades a shared label with the REGISTERED checker (2026-09-29; was bespoke-first)', () => {
    const shared = ITEM_STEP_NAMES.filter((s) => itemsRegistrySteps().includes(s));
    expect(shared).toHaveLength(6);
    const ctx: CheckerContext = { catalog: 'items', siblings: {}, has: () => true };
    for (const label of shared) {
      const data = (registrySpec(label).produce(E).data ?? {}) as Record<string, unknown>;
      const viaResolve = resolveAccept('items', label)!(data, ctx);
      const viaRegistry = registrySpec(label).accept(data, ctx);
      expect(viaResolve.status, `shared label "${label}" is not graded by its registered owner`).toBe(viaRegistry.status);
      expect(viaResolve.label).toBe(viaRegistry.label);
    }
  });

  it('resolves a registry-only label to the REGISTRY checker', () => {
    for (const label of itemsRegistryOnlySteps()) {
      expect(ITEM_STEP_SPECS[label], `"${label}" must stay registry-only`).toBeUndefined();
      const data = (registrySpec(label).produce(E).data ?? {}) as Record<string, unknown>;
      const ctx: CheckerContext = { catalog: 'items', siblings: {}, has: () => true };
      expect(resolveAccept('items', label)!(data, ctx).label).toBe(registrySpec(label).accept(data, ctx).label);
    }
  });

  it('still returns null for a label neither spec declares', () => {
    expect(resolveAccept('items', 'Not A Real Step')).toBeNull();
    expect(hasStepGrader('items', 'Not A Real Step')).toBe(false);
  });

  // Rule 5 — the walker now walks these five, so a clean Produce must land terminal.
  it('every registry-only step reaches a config-complete terminal status after a clean produce', () => {
    const violations: string[] = [];
    const ctx: CheckerContext = { catalog: 'items', siblings: {}, has: () => true };
    for (const label of itemsRegistryOnlySteps()) {
      const data = (registrySpec(label).produce(E).data ?? {}) as Record<string, unknown>;
      const r = resolveAccept('items', label)!(data, ctx);
      if (r.status !== 'pass' && r.status !== 'deferred') {
        violations.push(`items / "${label}": a clean Produce grades "${r.status}" — Rule 5 requires pass (L0–L2) or deferred (L3/L4)`);
      }
      if (r.status === 'deferred' && !r.reason) violations.push(`items / "${label}": deferred without a reason (Rule 4)`);
    }
    expect(violations).toEqual([]);
  });
});

describe('the completeness denominator counts every persisted row', () => {
  /**
   * The exact shape the live DB holds for `item-3` on 2026-08-19: 11 produced, passing rows
   * — 6 on bespoke labels, 5 on registry-only labels. The lab reported `6/13`.
   */
  const ITEM_3_PRODUCED = [
    'Concept Brief', 'Economy', 'Icon 2D Art', 'Tooltip / Compare', 'Test Gate', 'UE Packaging',
    'Base Type & Rarity', 'Affixes', 'Damage / Implicit', 'Material', '3D Mesh',
  ];

  it('counts all 11 of item-3\'s produced steps, not just the 6 bespoke ones', () => {
    const steps = catalogManifest('items').steps;
    const entitySteps: Record<string, LabStepArtifact> = {};
    for (const label of ITEM_3_PRODUCED) {
      const spec = ITEM_STEP_SPECS[label];
      const data = (spec ? spec.produce(E).data : registrySpec(label).produce(E).data) ?? {};
      entitySteps[label] = { done: true, data: data as Record<string, unknown>, ueAssets: [], at: '2026-08-19T00:00:00.000Z' };
    }
    const entity: LabEntity = { ...E, id: 'item-3' };
    const derived = deriveEntityArtifacts('items', entity, steps, entitySteps, {});

    expect(derived.done).toBe(11);
    expect(steps.length).toBe(18);
    // Every produced row now has a rendered step AND a derived artifact — none is dropped.
    expect(derived.artifacts.map((a) => a.step).sort()).toEqual([...ITEM_3_PRODUCED].sort());
    for (const label of ['Affixes', 'Base Type & Rarity', 'Damage / Implicit', 'Material', '3D Mesh']) {
      expect(derived.displayStatus(label, steps.indexOf(label)), `"${label}" must not read as unproduced`).not.toBe('unproduced');
    }
  });
});

describe('the rail discloses which spec a step came from', () => {
  const railProps = {
    stepIdx: 0,
    displayStatus: () => 'pending' as const,
    isLive: () => false,
    tooltipFor: () => '',
    ariaFor: (s: string) => `${s}: pending`,
    onSelectStep: () => {},
  };

  it('tags bespoke vs registry steps for items', () => {
    const sources = stepSourceMap('items')!;
    const steps = ['Attributes', 'Affixes'];
    render(<PipelineRail {...railProps} steps={steps} sourceFor={(s) => sources.get(s) ?? null} />);
    const tags = Array.from(document.querySelectorAll('[data-step-source]'));
    expect(tags.map((n) => n.getAttribute('data-step-source'))).toEqual(['bespoke', 'registry']);
    expect(tags.map((n) => n.textContent)).toEqual(['BESPOKE', 'REGISTRY']);
    // Silent to assistive tech unless folded into the button's aria-label.
    expect(screen.getByRole('button', { name: /Affixes.*registry spec/i })).toBeTruthy();
  });

  it('renders no tag when the caller has no source to disclose', () => {
    render(<PipelineRail {...railProps} steps={['Concept Brief']} />);
    expect(document.querySelectorAll('[data-step-source]').length).toBe(0);
  });
});

/**
 * ONE OWNER PER ITEMS LABEL.
 *
 * `items` has two step specs. Six labels are declared by BOTH (Concept Brief, Economy, Icon 2D
 * Art, Tooltip / Compare, Test Gate, UE Packaging). The server (`serverCheckerFor`), /status, the
 * headless drains and the judges resolve those six REGISTERED-first; the lab used to resolve them
 * BESPOKE-first, render them through the bespoke components and produce them through the bespoke
 * (unstamped, Pillars-exemplar) stubs. Measured read-only on the live DB (2026-09-29): 15 of 36
 * shared-label rows graded differently in the lab than on the server.
 *
 * The lab may only come DOWN to the server's reading, never up — a best-of-both build must fail
 * the bespoke-shaped floor cases below.
 */

const SHARED = ['Concept Brief', 'Economy', 'Icon 2D Art', 'Tooltip / Compare', 'Test Gate', 'UE Packaging'];
const BESPOKE_ONLY = [
  'Attributes', '3D Generation', 'Material / Texture', 'Animations', 'VFX', 'SFX', 'Inventory UI Integration',
];

const seeds = CATALOG_SECTIONS.find((s) => s.catalogId === 'items')!.seed() as unknown as LabEntity[];
const seedById = (id: string): LabEntity => {
  const e = seeds.find((s) => s.id === id);
  if (!e) throw new Error(`no items seed ${id}`);
  return e;
};
const ITEM_1 = seedById('item-1'); // the catalog exemplar (first seed)
const ITEM_2 = seedById('item-2');
const ENTITIES = { items: Object.fromEntries(seeds.map((s) => [s.id, s])) } as Record<string, Record<string, unknown>>;

function registered(label: string) {
  const spec = getCatalogPipeline('items')?.steps.find((s) => s.label === label);
  if (!spec) throw new Error(`no registered items step "${label}"`);
  return spec;
}

/** The stub each label's OWN spec writes for `e` — registered for shared/registry-only labels. */
function ownStub(label: string, e: LabEntity): StepOutput {
  const reg = getCatalogPipeline('items')?.steps.find((s) => s.label === label);
  if (reg) return stampTemplate('items', reg, e, reg.produce(e));
  return ITEM_STEP_SPECS[label].produce(e);
}

function ctxOver(stubs: Record<string, StepOutput>, entityId: string): CheckerContext {
  const steps: Record<string, LabStepArtifact> = {};
  for (const [label, out] of Object.entries(stubs)) {
    steps[label] = { done: true, data: out.data ?? {}, ueAssets: out.ueAssets ?? [], at: '2026-09-29T00:00:00.000Z' };
  }
  return buildLabCheckerContext('items', steps, ENTITIES, { entityId, verdicts: [] });
}

describe('shared items labels route to the registered spec', () => {
  // Case 1
  it('getStepComponent: the 6 shared labels fall through to ArchetypeStep; the 7 bespoke-only keep a component', () => {
    for (const label of SHARED) {
      expect(getStepComponent('items', label), `"${label}" must render through ArchetypeStep`).toBeNull();
    }
    for (const label of BESPOKE_ONLY) {
      expect(getStepComponent('items', label), `"${label}" lost its bespoke component`).not.toBeNull();
    }
  });

  // Case 2 (+ coordinator revision: the honest floor on bespoke-shaped data)
  it('Tooltip / Compare grades like the server on registry-shaped data AND on bespoke-shaped data', () => {
    const regRow = {
      tooltip: {
        displayName: 'Arkaine\'s Valor', description: 'A scarred cuirass',
        compareFields: [{ id: 'armorClass', label: 'Armor Class', value: 25 }],
      },
    };
    const ctx: CheckerContext = { catalog: 'items', siblings: {}, has: () => true };
    const server = serverCheckerFor('items', 'Tooltip / Compare')!(regRow, ctx).status;
    expect(server).toBe('pass');
    expect(resolveAccept('items', 'Tooltip / Compare')!(regRow, ctx).status).toBe(server);

    // The floor: a bespoke-shaped stub for a non-exemplar reads 'pass' on the bespoke checker,
    // 'pending' on the server. The lab must come DOWN to the server, never stay up.
    const economyStub = { power: 102, target: 100, cost: 143, rarity: 'Uncommon' };
    const srvEconomy = serverCheckerFor('items', 'Economy')!(economyStub, ctx).status;
    expect(srvEconomy).toBe('pending');
    expect(resolveAccept('items', 'Economy')!(economyStub, ctx).status).toBe('pending');

    const tooltipStub = (ITEM_STEP_SPECS['Tooltip / Compare'].produce(ITEM_2).data ?? {}) as Record<string, unknown>;
    const srvTooltip = serverCheckerFor('items', 'Tooltip / Compare')!(tooltipStub, ctx).status;
    expect(srvTooltip).toBe('pending');
    expect(resolveAccept('items', 'Tooltip / Compare')!(tooltipStub, ctx).status).toBe('pending');
  });

  // Case 3
  it('Test Gate on a registry-shaped row is deferred L3, equal to the server', () => {
    const row = { testGate: { test: 'VSItemsDefinitionsTest', acceptanceTier: 'L3' } };
    const ctx: CheckerContext = { catalog: 'items', siblings: {}, has: () => true };
    const srv = serverCheckerFor('items', 'Test Gate')!(row, ctx);
    const lab = resolveAccept('items', 'Test Gate')!(row, ctx);
    expect(lab.status).toBe('deferred');
    expect(lab.tier).toBe('L3');
    expect(lab.status).toBe(srv.status);
    expect(lab.tier).toBe(srv.tier);
  });

  // Case 4
  it('parity: every rendered items label grades identically in the lab and on the server (18 of 18)', () => {
    const labels = catalogManifest('items').steps;
    expect(labels).toHaveLength(18);
    const stubs = Object.fromEntries(labels.map((l) => [l, ownStub(l, ITEM_2)]));
    const rawStubs = Object.fromEntries(labels.map((l) => {
      const reg = getCatalogPipeline('items')?.steps.find((s) => s.label === l);
      return [l, reg ? reg.produce(ITEM_2) : ITEM_STEP_SPECS[l].produce(ITEM_2)];
    }));
    const mismatches: string[] = [];
    for (const [variant, set] of [['stamped', stubs], ['raw', rawStubs]] as const) {
      const ctx = ctxOver(set, ITEM_2.id);
      for (const label of labels) {
        const data = (set[label].data ?? {}) as Record<string, unknown>;
        const lab = resolveAccept('items', label)!(data, ctx).status;
        const srv = serverCheckerFor('items', label)!(data, ctx).status;
        if (lab !== srv) mismatches.push(`${variant} "${label}": lab ${lab} vs server ${srv}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  // Case 5
  it('populateItemDemo writes the REGISTERED, template-stamped stub for the 6 shared labels', () => {
    const writes: Record<string, StepOutput> = {};
    populateItemDemo(ITEM_2, (_id, step, out) => { writes[step] = out ?? {}; }, () => false);
    for (const label of SHARED) {
      const expected = stampTemplate('items', registered(label), ITEM_2, registered(label).produce(ITEM_2));
      expect(writes[label], `"${label}" was produced through the wrong spec`).toEqual(expected);
    }
    expect((writes['Economy'].data ?? {}).power).toBeUndefined();
    const ctx = ctxOver(writes, ITEM_2.id);
    for (const label of ['Economy', 'Tooltip / Compare', 'Concept Brief', 'UE Packaging']) {
      const r = resolveAccept('items', label)!((writes[label].data ?? {}) as Record<string, unknown>, ctx);
      expect(r.status, `"${label}" graded ${r.status} on an exemplar template`).toBe('pending');
      expect(String(r.reason)).toMatch(/^TEMPLATE:/);
    }
    // The bespoke-only labels keep their own produce door.
    for (const label of BESPOKE_ONLY) {
      expect(writes[label]).toEqual(ITEM_STEP_SPECS[label].produce(ITEM_2));
    }
  });

  // Case 6
  it('exemplar item-1: every registered stub reaches a config-complete terminal status through resolveAccept', () => {
    const steps = getCatalogPipeline('items')!.steps;
    expect(steps).toHaveLength(11);
    const stubs = Object.fromEntries(steps.map((s) => [s.label, s.produce(ITEM_1)]));
    const ctx = ctxOver(stubs, ITEM_1.id);
    const violations: string[] = [];
    for (const s of steps) {
      const r = resolveAccept('items', s.label)!((stubs[s.label].data ?? {}) as Record<string, unknown>, ctx);
      if (r.status === 'pass') continue;
      if (r.status === 'deferred' && r.reason) continue;
      violations.push(`"${s.label}": ${r.status}${r.reason ? ` (${r.reason})` : ''}`);
    }
    expect(violations).toEqual([]);
  });

  // Case 7 [guard for the labels/order; the source tags move]
  it('the rail keeps the same 18 labels in order, each graded, with truthful source tags', () => {
    const m = catalogManifest('items');
    const registryOnly = getCatalogPipeline('items')!.steps.map((s) => s.label).filter((l) => !ITEM_STEP_NAMES.includes(l));
    expect(m.steps).toEqual([...ITEM_STEP_NAMES, ...registryOnly]);
    for (const label of m.steps) expect(hasStepGrader('items', label), label).toBe(true);
    const source = new Map(m.stepEntries.map((e) => [e.label, e.source]));
    for (const label of SHARED) expect(source.get(label), label).toBe('registry');
    for (const label of BESPOKE_ONLY) expect(source.get(label), label).toBe('bespoke');
    for (const label of registryOnly) expect(source.get(label), label).toBe('registry');
    expect(m.mixedStepSources).toBe(true);
  });
});

describe('itemsLabelOwner — the one owner function', () => {
  it('registered wins a shared label (the server\'s order); bespoke owns only its own labels', () => {
    for (const label of SHARED) expect(itemsLabelOwner(label)).toBe('registry');
    for (const label of BESPOKE_ONLY) expect(itemsLabelOwner(label)).toBe('bespoke');
    expect(itemsLabelOwner('Affixes')).toBe('registry');
    expect(itemsLabelOwner('Not A Real Step')).toBeNull();
  });
});
