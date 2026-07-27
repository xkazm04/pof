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
 * ── Field coherence (e)–(g) ────────────────────────────────────────────────────
 * A step is three faces of ONE artifact — what Produce writes, what the View renders, what
 * Acceptance grades. When those three name different fields the step lies: it can chart one
 * number while grading another, or grade a field no Produce or selection ever writes (so the
 * verdict is pinned to a hardcoded stub value forever). The fields a checker reads are
 * discovered by running `accept()` over a recording Proxy of the produce stub, so an opaque
 * checker closure still reports its inputs.
 *
 *  (e) every top-level field the `accept` checker READS is written by `produce()`. Exempt:
 *      steps whose accept verdict on the stub is `deferred` — an L3/L4 gate legitimately reads
 *      fields a live runner (UE automation, the /pof/python/run bridge) writes later.
 *  (f) the View's `field` is written by `produce()` — a View pointed at a field nothing
 *      produces renders an empty state forever. Exempt: python-bridge steps (`data.python`),
 *      whose manifest fields are filled by the module's return envelope.
 *  (g) the DISPLAYED data is the GRADED data: `accept` must read the View's `field` itself, or
 *      the field it grades must live INSIDE `data[view.field]` (a mirror of the displayed
 *      datum). Otherwise the user reads numbers no check ever touches.
 *      For `gallery` steps this is strict and doubly-checked: the View field IS the selection
 *      field — the key a chosen candidate's payload projects onto the artifact — so it must be
 *      the accept field AND the payload key produced by `genCandidates.build`. Pointing a
 *      gallery at its candidate ARRAY instead makes selection overwrite that array with an
 *      index while acceptance grades a field selection never touches (the character-pipeline
 *      bug this rule was written for).
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

/** The stub artifact a step's Produce writes for the linter's synthetic entity. */
function produceData(s: Step): Record<string, unknown> | Error {
  try {
    return (s.spec.produce(SYNTH_ENTITY).data ?? {}) as Record<string, unknown>;
  } catch (e) {
    return e as Error;
  }
}

/**
 * Run a step's `accept` over a Proxy of its produce data, recording every TOP-LEVEL key the
 * checker touches. Checkers are opaque closures (`selected('mesh')`, `allOf(...)`), so reading
 * their field names statically is impossible — but every one of them indexes the data object,
 * and dot-path checkers (`pickField`, invariants' `pick`) split the path first, so the top-level
 * key is always the first thing read.
 */
function acceptFields(s: Step, data: Record<string, unknown>): { read: Set<string>; status: string } | Error {
  const read = new Set<string>();
  const proxy = new Proxy({ ...data }, {
    get(t, k) { if (typeof k === 'string') read.add(k); return Reflect.get(t, k); },
    has(t, k) { if (typeof k === 'string') read.add(k); return Reflect.has(t, k); },
  });
  try {
    return { read, status: s.spec.accept(proxy as Record<string, unknown>).status };
  } catch (e) {
    return e as Error;
  }
}

/** Is `field` present INSIDE the object the View renders (a mirror of the displayed datum)? */
function insideViewField(data: Record<string, unknown>, viewField: string, field: string): boolean {
  const obj = data[viewField];
  return obj != null && typeof obj === 'object' && field in (obj as Record<string, unknown>);
}

/** A python-bridge step: Produce dispatches a module and the RUNNER writes the result fields. */
const isPythonBridge = (data: Record<string, unknown>) => data.python != null;

const viewField = (spec: StepSpec) => (spec.view as { field?: string }).field;

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

  // ── (e) every accept-field is written by produce ───────────────────────────
  it('every field the accept checker reads is written by produce() (except runtime-deferred gates)', () => {
    const violations: string[] = [];
    for (const s of steps) {
      const data = produceData(s);
      if (data instanceof Error) { violations.push(`${at(s)}: produce() threw — ${data.message}`); continue; }
      const probe = acceptFields(s, data);
      if (probe instanceof Error) { violations.push(`${at(s)}: accept() threw — ${probe.message}`); continue; }
      // An L3/L4 gate reads fields a live runner writes later — that is the design, not drift.
      if (probe.status === 'deferred') continue;
      for (const f of probe.read) {
        if (!(f in data)) violations.push(`${at(s)}: accept grades field "${f}", which produce() never writes`);
      }
    }
    expect(violations).toEqual([]);
  });

  // ── (f) every view.field exists in produce output ──────────────────────────
  it("every View's field is written by produce() (no permanently-empty panels)", () => {
    const violations: string[] = [];
    for (const s of steps) {
      const data = produceData(s);
      if (data instanceof Error) { violations.push(`${at(s)}: produce() threw — ${data.message}`); continue; }
      if (isPythonBridge(data)) continue; // the python module's return envelope fills these
      const f = viewField(s.spec);
      if (f != null && !(f in data)) violations.push(`${at(s)}: view field "${f}" is never written by produce()`);
    }
    expect(violations).toEqual([]);
  });

  // ── (g) the displayed data is the graded data ──────────────────────────────
  it('acceptance grades the field the View displays (or a datum inside it)', () => {
    const violations: string[] = [];
    for (const s of steps) {
      const data = produceData(s);
      if (data instanceof Error) continue; // reported by (e)
      const probe = acceptFields(s, data);
      if (probe instanceof Error) continue; // reported by (e)
      if (probe.status === 'deferred') continue; // runtime gate: the runner supplies the truth
      const f = viewField(s.spec);
      if (f == null) continue;
      if (probe.read.has(f)) continue;
      const mirrored = [...probe.read].filter((k) => insideViewField(data, f, k));
      if (mirrored.length === 0) {
        violations.push(`${at(s)}: view field "${f}" is displayed but never graded — accept reads [${[...probe.read].join(', ')}], none of which is "${f}" or lives inside it`);
      }
    }
    expect(violations).toEqual([]);
  });

  // ── (g′) gallery: view field = selection field = candidate payload key ─────
  it('every gallery step grades its selection field, and genCandidates project onto that same field', () => {
    const violations: string[] = [];
    for (const s of steps) {
      if (s.spec.view.kind !== 'gallery') continue;
      const field = s.spec.view.field;
      const data = produceData(s);
      if (data instanceof Error) continue; // reported by (e)
      const probe = acceptFields(s, data);
      if (probe instanceof Error) continue;
      if (!probe.read.has(field)) {
        violations.push(`${at(s)}: gallery view field "${field}" is not the accepted selection field (accept reads [${[...probe.read].join(', ')}]) — selecting a candidate would write "${field}" while acceptance graded something else`);
      }
      if (typeof data[field] !== 'number') {
        violations.push(`${at(s)}: gallery selection field "${field}" must be a numeric candidate index in produce() data (got ${JSON.stringify(data[field])})`);
      }
      const gc = s.spec.genCandidates;
      if (gc && typeof gc.build === 'function') {
        const built = gc.build('lint direction', 0, [{ name: 'lint.glb', url: '/api/visual-gen/asset/lint.glb' }]);
        const bad = built.filter((c) => !(field in c.payload));
        if (bad.length) {
          violations.push(`${at(s)}: genCandidates payloads project onto [${Object.keys(built[0]?.payload ?? {}).join(', ')}], not the graded selection field "${field}" — selecting would overwrite produced data and never satisfy acceptance`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
