import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { SUPPORTED_VIEW_KINDS, SUPPORTED_CHART_VARIANTS } from '@/lib/catalog/stepSpec';
import type { ViewDescriptor, StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * Fleet spec linter (runs in `npm run validate` — pure vitest, no dev server).
 *
 * This round surfaced capability-vs-adoption DRIFT by hand: ChartPanel shipped four
 * variants but the fleet declared one chart; the keyed-manifest table soft-failed;
 * `StepSpec.copy` had zero callers; the histogram variant was never used. Nothing guarded
 * any of it, so the next such drift would land silently. This walker asserts the
 * spec↔renderer contracts every registered pipeline step must honour, so a future drift is
 * a red `validate` instead of a dead capability.
 *
 * What it checks, per step of every `allCatalogPipelines()` pipeline:
 *  (a) `view.kind` is one the generic ViewPanel renderer supports (SUPPORTED_VIEW_KINDS),
 *      and a `chart` view's `variant` is one ChartPanel supports (SUPPORTED_CHART_VARIANTS).
 *  (b) chart descriptors point at REAL numeric data: the step's `produce()` stub output is
 *      statically reachable (produce is a pure `(entity) => StepOutput`), so we run it with
 *      a synthetic entity and assert every declared `bars`/`histogram` key resolves to a
 *      finite number in `data[field]` (this is exactly what caught the old spellbook
 *      `burstDPS` column — a key the produce never wrote, a permanently-null bar), and that
 *      a `highlightKey` is one of the declared keys. `scatter`/`waveform` fields must hold
 *      the array shape ChartPanel consumes.
 *  (c) every `archetype: 'balance'` step declares a `chart` view (the end-state of the
 *      "balance steps get their charts" direction — a balance step must not regress to a
 *      number-grid table).
 *  (d) a gallery step's `genCandidates` (when present) has a `build` function and, when
 *      `needsAssets`, a valid `assetKind` ('2d' | '3d' | unset→'2d').
 *
 * Every failure names catalog / step / field precisely.
 */

const SYNTH_ENTITY: LabEntity = { id: 'lint-entity', name: 'Lint Entity', lifecycle: 'planned', data: {} };

/** Same numeric coercion ViewPanel's chart branch uses, so the linter agrees with render. */
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? n : null;
}

type Step = { catalogId: string; label: string; spec: StepSpec };

const pipelines = allCatalogPipelines();
const steps: Step[] = pipelines.flatMap((p) =>
  p.steps.map((spec) => ({ catalogId: p.catalogId, label: spec.label, spec })),
);
const at = (s: Step) => `${s.catalogId} / "${s.label}"`;

describe('fleet spec linter', () => {
  it('registry is non-empty (sanity)', () => {
    expect(pipelines.length).toBeGreaterThan(0);
    expect(steps.length).toBeGreaterThan(0);
  });

  // ── (a) view kind + chart variant are renderer-supported ───────────────────
  it('every ViewDescriptor kind is one the ViewPanel renderer supports', () => {
    const bad = steps.filter((s) => !(SUPPORTED_VIEW_KINDS as readonly string[]).includes(s.spec.view.kind));
    expect(bad.map((s) => `${at(s)}: unsupported view kind "${s.spec.view.kind}"`)).toEqual([]);
  });

  it('every chart view uses a ChartPanel-supported variant', () => {
    const bad = steps
      .filter((s) => s.spec.view.kind === 'chart')
      .filter((s) => !(SUPPORTED_CHART_VARIANTS as readonly string[]).includes((s.spec.view as Extract<ViewDescriptor, { kind: 'chart' }>).variant));
    expect(bad.map((s) => `${at(s)}: unsupported chart variant`)).toEqual([]);
  });

  // ── (b) chart descriptors point at real numeric/array data in produce() ─────
  it('every chart descriptor references numeric-shaped produce() data (no permanently-empty charts)', () => {
    const violations: string[] = [];
    for (const s of steps) {
      if (s.spec.view.kind !== 'chart') continue;
      const view = s.spec.view as Extract<ViewDescriptor, { kind: 'chart' }>;
      let data: Record<string, unknown>;
      try {
        data = (s.spec.produce(SYNTH_ENTITY).data ?? {}) as Record<string, unknown>;
      } catch (e) {
        violations.push(`${at(s)}: produce() threw for the linter's synthetic entity — ${(e as Error).message}`);
        continue;
      }
      const raw = data[view.field];
      if (raw == null || typeof raw !== 'object') {
        violations.push(`${at(s)}: chart field "${view.field}" is absent or not an object in produce() data`);
        continue;
      }
      const rec = raw as Record<string, unknown>;

      if (view.variant === 'bars') {
        for (const r of view.rows) {
          if (num(rec[r.key]) == null) violations.push(`${at(s)}: bars row "${r.key}" is not a finite number in data.${view.field}`);
        }
        if (view.highlightKey != null && !view.rows.some((r) => r.key === view.highlightKey)) {
          violations.push(`${at(s)}: bars highlightKey "${view.highlightKey}" is not one of the declared rows`);
        }
      } else if (view.variant === 'histogram') {
        for (const k of view.keys) {
          if (num(rec[k]) == null) violations.push(`${at(s)}: histogram key "${k}" is not a finite number in data.${view.field}`);
        }
        if (view.highlightKey != null && !view.keys.includes(view.highlightKey)) {
          violations.push(`${at(s)}: histogram highlightKey "${view.highlightKey}" is not one of the declared keys`);
        }
      } else if (view.variant === 'scatter') {
        const isPointArray = (v: unknown) => Array.isArray(v) && v.every((p) => p != null && typeof p === 'object' && num((p as Record<string, unknown>).x) != null && num((p as Record<string, unknown>).y) != null);
        if (!isPointArray(rec[view.referenceKey])) violations.push(`${at(s)}: scatter referenceKey "${view.referenceKey}" is not an array of {x,y} numbers in data.${view.field}`);
        if (view.pointsKey != null && rec[view.pointsKey] != null && !isPointArray(rec[view.pointsKey])) {
          violations.push(`${at(s)}: scatter pointsKey "${view.pointsKey}" is present but not an array of {x,y} numbers`);
        }
      } else if (view.variant === 'waveform') {
        const samples = rec[view.samplesKey];
        if (!Array.isArray(samples) || !samples.some((v) => num(v) != null)) {
          violations.push(`${at(s)}: waveform samplesKey "${view.samplesKey}" is not a non-empty numeric array in data.${view.field}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  // ── (c) every balance step declares a chart ────────────────────────────────
  it("every archetype:'balance' step declares a chart view", () => {
    const bad = steps
      .filter((s) => s.spec.archetype === 'balance')
      .filter((s) => s.spec.view.kind !== 'chart');
    expect(bad.map((s) => `${at(s)}: balance step must declare a chart view (found "${s.spec.view.kind}")`)).toEqual([]);
  });

  // ── (d) gallery genCandidates contract ─────────────────────────────────────
  it('every gallery step with genCandidates has a build function and a valid assetKind', () => {
    const violations: string[] = [];
    for (const s of steps) {
      const gc = s.spec.genCandidates;
      if (!gc) continue;
      if (typeof gc.build !== 'function') violations.push(`${at(s)}: genCandidates.build must be a function`);
      if (gc.assetKind != null && gc.assetKind !== '2d' && gc.assetKind !== '3d') {
        violations.push(`${at(s)}: genCandidates.assetKind "${gc.assetKind}" is invalid (expected '2d' | '3d')`);
      }
      if (s.spec.view.kind !== 'gallery') {
        violations.push(`${at(s)}: genCandidates is set on a non-gallery step (view kind "${s.spec.view.kind}") — it will be ignored`);
      }
    }
    expect(violations).toEqual([]);
  });
});
