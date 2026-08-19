import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import {
  ITEMS_SPEC_DUALITY, ITEMS_ON_SCREEN_STEPS, itemsRegistrySteps, itemsSharedSteps, itemsAllStepLabels,
  itemsRegistryOnlySteps, catalogManifest, hasStepGrader,
} from '@/components/layout-lab/catalogManifest';
import { ITEM_STEP_SPECS, ITEM_STEP_NAMES } from '@/components/layout-lab/steps/itemsSteps';
import { getStepFact } from '@/lib/status/statusModel';
import { appendBatch, emptyHistory, historyData, makeBatch } from '@/components/layout-lab/steps/shared/genHistory';
import { WALKER_SKIP } from '../../../e2e/helpers/pipeline-coverage';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';

/**
 * ITEMS IS ONE PIPELINE — the guards the fleet applies to every registered `StepSpec`
 * pipeline, applied to the BESPOKE Items steps that users actually see and grade.
 *
 * `items` is the reference implementation and was, until this file existed, the one
 * pipeline none of the honesty machinery covered: `pipeline-spec-linter.test.ts` walks
 * `allCatalogPipelines()`, which yields the 11-label REGISTRY spec — never the 13-label
 * bespoke spec routed by `BESPOKE_CATALOGS`. Seven on-screen steps had no `StepFact`, no
 * linter rule touched their `accept`, and `Test Gate` graded a non-terminal `pending`
 * after a clean Produce (a Rule-5 violation in the very pipeline the docs call the model).
 *
 * The 11-vs-13 duality is DECLARED in `catalogManifest.ts` ({@link ITEMS_SPEC_DUALITY});
 * this file asserts the declaration matches both sources and holds the bespoke specs to
 * the fleet's rules.
 *
 * 2026-08-19 — DECLARED was not the same as VISIBLE. The lab rendered the bespoke list only,
 * so the 5 registry-only labels had no screen and no on-screen grader while carrying 31 of the
 * catalog's 90 persisted `pipeline_artifacts` rows (measured read-only on the live DB). The lab
 * now renders the ordered UNION, tagged by source. The labels themselves are untouched — a
 * rename would orphan every one of those rows (Rule 4b) — so this file keeps asserting the two
 * specs against their own sources, and additionally that neither one hides the other.
 */

const E: LabEntity = { id: 'items-lint-entity', name: 'Lint Longsword', lifecycle: 'planned', data: {} };

type Step = { label: string; data: Record<string, unknown> };

/** The stub artifact each bespoke step's Produce writes for the synthetic entity. */
const STEPS: Step[] = ITEM_STEP_NAMES.map((label) => ({
  label,
  data: (ITEM_STEP_SPECS[label].produce(E).data ?? {}) as Record<string, unknown>,
}));

/**
 * The same artifact, but with a one-candidate generation history whose selected candidate
 * carries a REAL generated image and projects the artifact's own fields. This is what a step
 * looks like after a generator has actually run — the shape `candidateAsset` accepts.
 */
function withRealAsset(data: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...data };
  delete payload.genHistory;
  const batch = makeBatch({
    seq: 0, at: '2026-01-01T00:00:00.000Z', direction: 'gen', prompt: 'gen',
    candidates: [{ swatch: 'linear-gradient(135deg, #444, #888)', imageUrl: '/api/visual-gen/icon/real.png', payload }],
  });
  return historyData(appendBatch(emptyHistory(), batch), data);
}

/** Record every top-level key a bespoke checker touches (same Proxy probe as the fleet linter). */
function acceptFields(label: string, data: Record<string, unknown>): { read: Set<string>; status: string } {
  const read = new Set<string>();
  const proxy = new Proxy({ ...data }, {
    get(t, k) { if (typeof k === 'string') read.add(k); return Reflect.get(t, k); },
    has(t, k) { if (typeof k === 'string') read.add(k); return Reflect.has(t, k); },
  });
  return { read, status: ITEM_STEP_SPECS[label].accept(proxy as Record<string, unknown>).status };
}

describe('Items spec duality — declared, not implied', () => {
  it('declares the on-screen (13) and registry (11) specs from their real sources', () => {
    expect(ITEMS_SPEC_DUALITY.catalogId).toBe('items');
    expect(ITEMS_SPEC_DUALITY.reason.length).toBeGreaterThan(60);
    expect([...ITEMS_ON_SCREEN_STEPS]).toEqual(Object.keys(ITEM_STEP_SPECS));
    expect(itemsRegistrySteps().length).toBeGreaterThan(0);
    // The two specs genuinely differ — that is the declared state, not a bug to hide.
    expect(itemsSharedSteps().length).toBeLessThan(ITEMS_ON_SCREEN_STEPS.length);
    expect(itemsAllStepLabels()).toEqual(
      expect.arrayContaining([...itemsRegistrySteps(), ...ITEMS_ON_SCREEN_STEPS]),
    );
    // The declaration itself must say what happens to the registry-only half, because
    // "declared" silently coexisted with "invisible" for three weeks.
    expect(ITEMS_SPEC_DUALITY.reason).toMatch(/union/i);
  });

  it('renders BOTH specs — neither half of the duality can hide produced rows', () => {
    const m = catalogManifest('items');
    const registryOnly = itemsRegistryOnlySteps();
    // The duality is real: there IS a registry-only half, and it is not empty.
    expect(registryOnly.length).toBeGreaterThan(0);
    expect(registryOnly.every((s) => !ITEMS_ON_SCREEN_STEPS.includes(s))).toBe(true);
    // …and every label a persisted artifact row can be keyed on is both rendered and graded.
    for (const label of itemsAllStepLabels()) {
      expect(m.steps, `items step "${label}" is declared but never rendered`).toContain(label);
      expect(hasStepGrader('items', label), `items step "${label}" is rendered but ungraded`).toBe(true);
    }
    // …tagged, not merged: the reader can still tell the two specs apart.
    expect(m.mixedStepSources).toBe(true);
    expect(m.stepEntries.filter((e) => e.source === 'registry').map((e) => e.label)).toEqual(registryOnly);
  });

  it('gives EVERY items step in either spec an audited StepFact (no PROVENANCE: UNAUDITED)', () => {
    const missing = itemsAllStepLabels().filter((s) => getStepFact('items', s) === undefined);
    expect(missing, `items steps with no step-facts.json row: ${missing.join(', ')}`).toEqual([]);
  });

  it('keeps the WALKER_SKIP reason honest about what covers items instead', () => {
    const reason = WALKER_SKIP.items ?? '';
    expect(reason).toContain('catalog-items-reference.spec.ts');
    // The reason must name the spec that is actually walked — the bespoke on-screen count.
    expect(reason).toContain(String(ITEMS_ON_SCREEN_STEPS.length));
  });
});

describe('Items bespoke steps — held to the fleet linter rules', () => {
  // ── (e) every accept-field is written by produce ───────────────────────────
  it('every field a bespoke accept reads is written by its produce() (except runtime-deferred gates)', () => {
    const violations: string[] = [];
    for (const s of STEPS) {
      const probe = acceptFields(s.label, s.data);
      if (probe.status === 'deferred') continue; // an L3 gate legitimately reads runner-written fields
      for (const f of probe.read) {
        if (!(f in s.data)) violations.push(`items / "${s.label}": accept grades field "${f}", which produce() never writes`);
      }
    }
    expect(violations).toEqual([]);
  });

  // ── Rule 5 — a clean Produce reaches a config-complete TERMINAL status ─────
  it('a cleanly-produced bespoke step reaches a terminal status (pass, or deferred with a reason)', () => {
    const violations: string[] = [];
    for (const s of STEPS) {
      const r = ITEM_STEP_SPECS[s.label].accept(s.data);
      if (r.status !== 'pass' && r.status !== 'deferred') {
        violations.push(`items / "${s.label}": a clean Produce grades "${r.status}" — Rule 5 requires pass (L0–L2) or deferred (L3/L4)`);
      }
      if (r.status === 'deferred' && !(r.reason ?? r.why)) {
        violations.push(`items / "${s.label}": deferred without a reason (Rule 4)`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('Test Gate stays terminal both with and without a sibling context', () => {
    const gate = ITEM_STEP_SPECS['Test Gate'];
    const data = (gate.produce(E).data ?? {}) as Record<string, unknown>;

    // No context to derive from → the honest L3 reading, never a silent `pending`.
    const bare = gate.accept(data);
    expect(bare.status).toBe('deferred');
    expect(bare.tier).toBe('L3');
    expect(bare.reason).toBeTruthy();

    // Every upstream step produced → the gate derives from real sibling acceptance. The three
    // generative upstreams (Icon 2D Art · 3D Generation · Material / Texture) own no generated
    // asset from a produce STUB, so they are `deferred`, and a gate blocked only by deferred
    // upstreams is deferred too — nothing failed, and no local edit can make it pass.
    const siblings: Record<string, Record<string, unknown>> = {};
    for (const s of STEPS) siblings[s.label] = s.data;
    const ctx: CheckerContext = { catalog: 'items', siblings, has: () => true };
    const derived = gate.accept(data, ctx);
    expect(derived.status).toBe('deferred');
    expect(derived.tier).toBe('L3');
    expect(derived.reason).toBeTruthy();

    // With those three upstreams carrying a REAL generated asset the gate goes green — the
    // derivation is not permanently pinned to deferred.
    const withArt = { ...siblings };
    for (const label of ['Icon 2D Art', '3D Generation', 'Material / Texture']) {
      withArt[label] = withRealAsset(withArt[label]);
    }
    expect(gate.accept(data, { ...ctx, siblings: withArt }).status).toBe('pass');

    // An upstream failure still FAILS the gate — the derivation is not weakened.
    const blocked: Record<string, Record<string, unknown>> = { ...siblings, Economy: { power: 500, target: 100, cost: 1 } };
    expect(gate.accept(data, { ...ctx, siblings: blocked }).status).toBe('fail');
  });

  // ── Produce is deterministic and non-empty ────────────────────────────────
  it('every bespoke produce() writes data for a synthetic entity', () => {
    const empty = STEPS.filter((s) => Object.keys(s.data).length === 0).map((s) => s.label);
    expect(empty).toEqual([]);
  });
});
