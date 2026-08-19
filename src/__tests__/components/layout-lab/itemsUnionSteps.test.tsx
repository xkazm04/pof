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
import { ITEM_STEP_SPECS, ITEM_STEP_NAMES } from '@/components/layout-lab/steps/itemsSteps';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { deriveEntityArtifacts } from '@/components/layout-lab/hooks/useEntityArtifacts';
import { PipelineRail } from '@/components/layout-lab/PipelineRail';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
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

  it('tags each step with the spec that declared it (the duality stays visible)', () => {
    const m = catalogManifest('items');
    expect(m.mixedStepSources).toBe(true);
    const bySource = (src: string) => m.stepEntries.filter((e) => e.source === src).map((e) => e.label);
    expect(bySource('bespoke')).toEqual([...ITEMS_ON_SCREEN_STEPS]);
    expect(bySource('registry')).toEqual(itemsRegistryOnlySteps());
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

describe('grader precedence — bespoke still wins every shared label', () => {
  it('grades a shared label with the BESPOKE checker, byte-identically to before', () => {
    const shared = ITEM_STEP_NAMES.filter((s) => itemsRegistrySteps().includes(s));
    expect(shared.length).toBeGreaterThan(0);
    for (const label of shared) {
      const data = (ITEM_STEP_SPECS[label].produce(E).data ?? {}) as Record<string, unknown>;
      const viaResolve = resolveAccept('items', label)!(data);
      const viaBespoke = ITEM_STEP_SPECS[label].accept(data);
      expect(viaResolve.status, `shared label "${label}" changed grader`).toBe(viaBespoke.status);
      expect(viaResolve.detail).toBe(viaBespoke.detail);
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
    const steps = ['Concept Brief', 'Affixes'];
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
