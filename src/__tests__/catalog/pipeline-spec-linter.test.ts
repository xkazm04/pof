import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { SUPPORTED_VIEW_KINDS, SUPPORTED_CHART_VARIANTS, ARCHETYPE_VIEW_KINDS } from '@/lib/catalog/stepSpec';
import type { ViewDescriptor, StepSpec } from '@/lib/catalog/stepSpec';
import { readLinks } from '@/lib/catalog/acceptance/linkCheckers';
import { resolveTableView } from '@/lib/catalog/tableView';
import { isContentInvariant } from '@/lib/catalog/acceptance/contentInvariant';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import { ENGINE_CLASS, engineFamily, getStepFact } from '@/lib/status/statusModel';
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
 *  (a2) `view.kind` is one the step's own ARCHETYPE allows (`ARCHETYPE_VIEW_KINDS`, measured
 *      from the fleet). The archetype is the deliverable contract — it selects the corrective
 *      language, the canon slice and CLI eligibility — so a step rendering in a shape its
 *      archetype's peers never use is mis-declared on one side or the other, and nothing said
 *      which until this rule. Four such steps had already drifted (two character-pipeline face
 *      gates, codex "Lore Body", combat-map "Ambient / Audio").
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
 *  (k) every `archetype: 'balance'` step composes a CONTENT INVARIANT (acceptance/
 *      invariants.ts, marked via `contentInvariant.ts` and propagated by `allOf`) — a balance
 *      step graded only by shape/presence checkers can never fail on a wrong number, which is
 *      exactly how one Produce click yielded 300 pass / 0 fail fleet-wide. A companion ratchet
 *      guards fleet-wide adoption (INVARIANT_ADOPTION_FLOOR pipelines).
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
 *  (f2) every DECLARED TABLE COLUMN resolves against the step's own produce stub, through the
 *      SAME pure resolver the renderer uses (`catalog/tableView.ts`). Rule (f) only checked
 *      the container field, never descended into `view.columns` — which is how 99 of 451
 *      declared columns (28 whole tables) came to render nothing but "— missing" to every
 *      user. A column that no row and no flat record carries is a lie about the artifact.
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
 * ── Link integrity (h)–(i) ─────────────────────────────────────────────────────
 *  (h) every step that declares cross-catalog `links` composes `linksResolve()` — a link
 *      pointing at an entity that does not exist must be CAUGHT, not merely counted.
 *  (i) Rule 5 under a real, seed-backed `CheckerContext`: a cleanly-produced step never
 *      grades `fail`, and an L0–L2 step never defers on unresolved links.
 *
 * Every failure names catalog / step / field precisely.
 */

/** Fleet floor for content-invariant adoption (pipelines composing ≥1 real value law).
 *  A ratchet: raise it as more pipelines are wired, never lower it to make a change pass. */
const INVARIANT_ADOPTION_FLOOR = 20;

const SYNTH_ENTITY: LabEntity = { id: 'lint-entity', name: 'Lint Entity', lifecycle: 'planned', data: {} };

/** Same numeric coercion ViewPanel's chart branch uses, so the linter agrees with render. */
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? n : null;
}

type Step = { catalogId: string; label: string; spec: StepSpec };

/**
 * The stub artifact a step's Produce writes for the linter's synthetic entity — with the
 * typed top-level `links` folded into `data.links`, exactly as `labPipelineStore` does when
 * it persists the artifact (so `linksResolve` / `readLinks` see what they see at runtime).
 */
function produceData(s: Step): Record<string, unknown> | Error {
  try {
    const out = s.spec.produce(SYNTH_ENTITY);
    const data = (out.data ?? {}) as Record<string, unknown>;
    const topLinks = (out as { links?: unknown }).links;
    return topLinks != null ? { ...data, links: data.links ?? topLinks } : data;
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

/** Every path (as key segments) at which the produced artifact declares a `wiringContract`. */
function findWiringContracts(v: unknown, path: string[] = [], depth = 0): string[][] {
  if (depth > 6 || v == null || typeof v !== 'object') return [];
  if (Array.isArray(v)) return v.flatMap((x, i) => findWiringContracts(x, [...path, String(i)], depth + 1));
  return Object.entries(v as Record<string, unknown>).flatMap(([k, val]) =>
    k === 'wiringContract' ? [[...path, k]] : findWiringContracts(val, [...path, k], depth + 1),
  );
}

/** A deep copy of `data` with the wiring contract at `path` stubbed out ("TBD" gray-box). */
function hollowWiring(data: Record<string, unknown>, path: string[]): Record<string, unknown> {
  const copy = structuredClone(data);
  let cur: Record<string, unknown> = copy;
  for (const k of path.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[path[path.length - 1]] = { grantedBy: 'TBD', activatedBy: 'TBD', verification: 'TBD', dependencies: [] };
  return copy;
}

/**
 * Rule (a2): the step's `view.kind` must be one its own archetype declares. Returns the
 * violation message (naming step, archetype and view kind) or null. Shared by the fleet
 * walk and the fixture test that proves the rule actually rejects a new mismatch.
 */
function archetypeViewViolation(s: Step): string | null {
  const allowed = ARCHETYPE_VIEW_KINDS[s.spec.archetype];
  if (allowed == null || (allowed as readonly string[]).includes(s.spec.view.kind)) return null;
  return (
    `${at(s)}: archetype "${s.spec.archetype}" renders view kind "${s.spec.view.kind}", which is not ` +
    `one of [${allowed.join(', ')}] — re-declare the archetype to match the shape this step actually ` +
    `produces, or widen ARCHETYPE_VIEW_KINDS deliberately (with a stated reason) in stepSpec.ts`
  );
}

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

  // ── (a2) view kind agrees with the step's archetype ────────────────────────
  it("every step's view kind is one its archetype declares (ARCHETYPE_VIEW_KINDS)", () => {
    expect(steps.map(archetypeViewViolation).filter((v): v is string => v != null)).toEqual([]);
  });

  it('the archetype/view rule rejects a NEW mismatching step and names step, archetype and kind', () => {
    const rogue: Step = {
      catalogId: 'lint-fixture',
      label: 'Rogue Step',
      // A checklist archetype rendering a chart — the drift class (a2) exists to catch.
      spec: { ...steps[0].spec, archetype: 'checklist', view: { kind: 'chart', variant: 'bars', field: 'x', rows: [] } },
    };
    const msg = archetypeViewViolation(rogue);
    expect(msg).not.toBeNull();
    expect(msg).toContain('Rogue Step');
    expect(msg).toContain('"checklist"');
    expect(msg).toContain('"chart"');
  });

  it('every archetype has a declared view-kind allow-list (no silent escape hatch)', () => {
    const undeclared = [...new Set(steps.map((s) => s.spec.archetype))].filter(
      (a) => !Array.isArray(ARCHETYPE_VIEW_KINDS[a]) || ARCHETYPE_VIEW_KINDS[a].length === 0,
    );
    expect(undeclared).toEqual([]);
  });

  it('ARCHETYPE_VIEW_KINDS lists no kind the renderer does not support, and none the fleet never uses', () => {
    const used = new Set(steps.map((s) => `${s.spec.archetype}/${s.spec.view.kind}`));
    const violations: string[] = [];
    for (const [archetype, kinds] of Object.entries(ARCHETYPE_VIEW_KINDS)) {
      for (const k of kinds) {
        if (!(SUPPORTED_VIEW_KINDS as readonly string[]).includes(k)) {
          violations.push(`${archetype}: allows view kind "${k}", which the ViewPanel renderer does not support`);
        } else if (!used.has(`${archetype}/${k}`)) {
          // The list is MEASURED from the fleet; an entry no step uses is an invented
          // permission that would silently license a future divergence.
          violations.push(`${archetype}: allows view kind "${k}", but no registered step pairs them — drop the unused permission`);
        }
      }
    }
    expect(violations).toEqual([]);
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

  // ── (f2) every DECLARED TABLE COLUMN resolves against the step's own produce ─
  it("every declared table column resolves against the step's own produce() (no all-missing tables)", () => {
    const violations: string[] = [];
    for (const s of steps) {
      if (s.spec.view.kind !== 'table') continue;
      const view = s.spec.view as Extract<ViewDescriptor, { kind: 'table' }>;
      const data = produceData(s);
      if (data instanceof Error) continue; // reported by (e)/(f)
      if (isPythonBridge(data)) continue;  // the python envelope fills these later
      const res = resolveTableView(data, view.field, view.columns, view.rowsKey);
      if (res.mode === 'absent') {
        violations.push(`${at(s)}: table field "${view.field}"${view.rowsKey ? `.${view.rowsKey}` : ''} is absent from produce() data`);
        continue;
      }
      if (res.mode === 'mismatch') {
        violations.push(`${at(s)}: table field "${view.field}" holds ${res.actual} — no row records for the declared columns`);
        continue;
      }
      if (res.missing.length) {
        violations.push(`${at(s)}: table columns [${res.missing.join(', ')}] never resolve in data.${view.field}${view.rowsKey ? `.${view.rowsKey}` : ''} — they would render "— missing" to every user`);
      }
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

  // ── (h) every links-writing step actually RESOLVES its links ───────────────
  it('every step that declares cross-catalog links composes linksResolve()', () => {
    const violations: string[] = [];
    for (const s of steps) {
      const data = produceData(s);
      if (data instanceof Error) continue; // reported by (e)
      if (!readLinks(data).length) continue;
      const probe = acceptFields(s, data);
      if (probe instanceof Error) continue;
      if (!probe.read.has('links')) {
        violations.push(`${at(s)}: declares ${readLinks(data).length} cross-catalog link(s) but acceptance never reads them — compose linksResolve() via allOf so a link pointing at a non-existent entity is caught`);
      }
    }
    expect(violations).toEqual([]);
  });

  // ── (i) Rule 5 under a REAL catalog context ────────────────────────────────
  it('with a seed-backed CheckerContext, a cleanly-produced step still reaches a terminal status', () => {
    const seeded = seedAllCatalogs();
    const ctx = {
      catalog: '',
      siblings: {} as Record<string, Record<string, unknown>>,
      has: (c: string, e: string) => !!seeded[c]?.[e],
    };
    const violations: string[] = [];
    for (const s of steps) {
      const data = produceData(s);
      if (data instanceof Error) continue; // reported by (e)
      let r;
      try {
        r = s.spec.accept(data, { ...ctx, catalog: s.catalogId });
      } catch (e) {
        violations.push(`${at(s)}: accept() threw with a catalog context — ${(e as Error).message}`);
        continue;
      }
      if (r.status === 'fail') {
        violations.push(`${at(s)}: a clean Produce grades as FAIL under link resolution — ${r.reason ?? r.detail}`);
      }
      // linksResolve defers on an unresolved target; for an L0–L2 step that would break Rule 5.
      if (r.status === 'deferred' && r.tier !== 'L3' && r.tier !== 'L4' && readLinks(data).length > 0) {
        violations.push(`${at(s)}: links do not resolve against the seed — ${r.reason ?? r.detail}`);
      }
    }
    expect(violations).toEqual([]);
  });

  // ── (j) a declared wiring contract is GRADED, not just written ─────────────
  it('every step whose produce writes a wiringContract grades it (a hollow contract must not pass)', () => {
    const violations: string[] = [];
    for (const s of steps) {
      const data = produceData(s);
      if (data instanceof Error) continue; // reported by (e)
      const paths = findWiringContracts(data);
      if (!paths.length) continue;
      let clean;
      try {
        clean = s.spec.accept(data);
      } catch { continue; } // reported by (e)
      if (clean.status !== 'pass') continue; // can't distinguish — some other check already holds it back
      // Hollow the contract out (the "gray-box" an artifact must never ship with) and
      // re-grade: a step that composes `wiringContractSound` catches it.
      const hollowed = hollowWiring(data, paths[0]);
      let after;
      try {
        after = s.spec.accept(hollowed);
      } catch (e) {
        violations.push(`${at(s)}: accept() threw on a hollowed wiring contract — ${(e as Error).message}`);
        continue;
      }
      if (after.status === 'pass') {
        violations.push(`${at(s)}: declares a wiringContract at "${paths[0].join('.')}" but acceptance still passes when grantedBy/activatedBy/verification are stubbed — compose wiringContractSound(...) via allOf`);
      }
    }
    expect(violations).toEqual([]);
  });

  // ── (k) balance steps grade real VALUES, not shapes ────────────────────────
  it("every archetype:'balance' step composes a content invariant", () => {
    const bad = steps
      .filter((s) => s.spec.archetype === 'balance')
      .filter((s) => !isContentInvariant(s.spec.accept));
    expect(bad.map((s) => `${at(s)}: balance step must compose ≥1 content invariant (acceptance/invariants.ts) so a WRONG NUMBER fails — a shape/presence checker alone can't`)).toEqual([]);
  });

  it('content-invariant adoption does not regress below the fleet floor', () => {
    const adopting = pipelines.filter((p) => p.steps.some((spec) => isContentInvariant(spec.accept)));
    // Ratchet: raise this floor when you wire more pipelines; never lower it.
    expect(adopting.length, `only ${adopting.length}/${pipelines.length} pipelines compose a content invariant`).toBeGreaterThanOrEqual(INVARIANT_ADOPTION_FLOOR);
  });

  // ── (l) StepSpec.copy is retired — authoring it makes a banner LESS honest ─
  it('no step authors the retired StepSpec.copy (its signature cannot see the verdict)', () => {
    const authored = steps.filter((s) => typeof s.spec.copy === 'function');
    expect(
      authored.map(
        (s) =>
          `${at(s)}: StepSpec.copy is RETIRED. It receives only the artifact \`data\`, never the graded ` +
          `AcceptanceResult, so an authored why/suggestion structurally cannot name the checker's status ` +
          `or its reason — while the derived fallback (steps/shared/genericFixCopy.ts) always does. ` +
          `Authoring it makes this step's banner strictly LESS honest than the fallback it replaces. ` +
          `For step-bespoke copy that CAN see the verdict, follow ITEM_STEP_COPY (steps/itemsSteps.ts), ` +
          `which is applied inside the checker where the base verdict is in scope.`,
      ),
    ).toEqual([]);
  });

  // ── (m) the engine a step declares is a name the map can class ─────────────
  it('every authored StepSpec.engine is a name ENGINE_CLASS knows', () => {
    // `engineClass` returns `unaudited` for any string it does not recognise — the LOWEST
    // credibility bucket. That is the right default for an unknown engine, but it means a
    // TYPO in an authored value silently demotes the cell instead of reporting itself.
    const bad = steps
      .filter((s) => s.spec.engine != null && ENGINE_CLASS[s.spec.engine] == null)
      .map(
        (s) =>
          `${at(s)}: engine "${s.spec.engine}" is not a key of ENGINE_CLASS (statusModel.ts), so /status ` +
          `classes it as \`unaudited\` without saying why — add the engine to ENGINE_CLASS deliberately, ` +
          `or fix the spelling`,
      );
    expect(bad).toEqual([]);
  });

  // ── (n) spec and audit must not name different engines silently ────────────
  /**
   * Steps where the AUTHORED `StepSpec.engine` and the AUDITED `StepFact.trueEngine` name
   * different engines.
   *
   * `resolveEngine` prefers the audit, so today the spec's answer is silently discarded and
   * /status shows the audit's — a disagreement between the two things that know what powers
   * a step was invisible on the map whose job is to say what powers a step.
   *
   * This is a WORK QUEUE, not a suppression list: each entry names the code evidence for the
   * spec's side and needs a Director decision on `step-facts.json` (Class C — a lot authoring
   * engine values must not also edit its own audit). Shrink-only — resolve entries, never add
   * one to make a change pass.
   */
  /**
   * The whole `balance` archetype disputes `trueEngine: 'Claude'`. Shared evidence, quoted
   * once: `produce()` is a pure deterministic function of author-typed literals (13 of the
   * 16 balance steps take no `entity` argument at all, and the 3 that do use it only for
   * naming strings), and `'balance'` is absent from `CLI_ELIGIBLE_ARCHETYPES`
   * (`layout-lab/labProduceMode.ts`), so the LIVE branch of `ArchetypeStep.dispatchProduce`
   * is unreachable for these steps and no model can ever write the artifact. The audit
   * appears to be attributing who WROTE the constants rather than what runs Produce — and
   * the audit's own `note` on each of these steps says the numbers are hardcoded.
   */
  /**
   * Wave 26 (Lot NB) — the `Code` naming collision, and the 80 steps it covered.
   *
   * `ENGINE_CLASS` mapped `Code` / `Code (deterministic)` to the trusted `code` class, but
   * `Code` was carrying two meanings: deterministic code that COMPUTES a result from inputs
   * outside its own source (the packaging verifier, which rebuilds a package from sibling
   * artifacts and grades it against files on disk), and a `produce()` body that returns
   * LITERALS a person typed. Only the first has earned credibility.
   *
   * Measured over the 344 registered steps on 2026-08-20: 110 resolve to a code-class engine
   * — 80 audited `Code`/`Code (deterministic)` and 30 audited `Packaging engine`. All 80 are
   * the literals case, and the evidence is from each step's own code, not its label:
   *   · 106 of the 110 produce a BYTE-IDENTICAL artifact for two different entities; the
   *     other four interpolate the entity NAME into otherwise fixed prose;
   *   · `produce` is a pure synchronous `(entity) => StepOutput`, so it cannot read disk, DB
   *     or UE — an artifact it writes is determined entirely by literals in its own file;
   *   · `balance` / `schema` / `checklist` / `manifest` are absent from
   *     `CLI_ELIGIBLE_ARCHETYPES`, so for those steps no model can ever replace the stub;
   *   · the audit's own notes concede it — "hand-authored constants", "hand-picked constants
   *     engineered to land exactly at 1.0", "a hardcoded stub, not a measured shader-compile
   *     output", "produce() takes no entity/direction parameter at all".
   *
   * The 30 `Packaging engine` steps are deliberately NOT here: their verdict is re-graded
   * from disk truth by `verifyPackagingAll`, which is sense 1 by measurement.
   *
   * Each spec now declares `engine: 'Hand-authored'`. `resolveEngine`'s one-way self-demotion
   * rule makes that take effect immediately (a step may claim LESS credit than its audit gave
   * it, never more), so these disputes are LIVE on the map rather than silently discarded —
   * but they are still disputes: `step-facts.json` is Class C and only the Director can move
   * `trueEngine` to `Hand-authored`. Delete each entry as its fact lands.
   */
  const HAND_AUTHORED_DISPUTE = (catalogId: string) =>
    `audit records Code, spec authors Hand-authored: this step's produce() returns author-typed ` +
    `literals (measured — the artifact is byte-identical across two different entities, and produce ` +
    `is a pure sync function that cannot read disk, DB or UE), and every checker that grades it ` +
    `re-reads those same literals, so nothing outside ${catalogId}.ts can make it fail. \`Code\` is ` +
    `in TRUSTED_CLASSES and this has not earned that. Director: move trueEngine to 'Hand-authored'.`;

  const HAND_AUTHORED_BY_CATALOG: Record<string, string[]> = {
    "ambient": ["Spatialization", "Occlusion", "Memory Budget"],
    "bestiary": ["Encounter Balance"],
    "combat-map": ["Balance"],
    "crafting-recipes": ["Cost & Yield"],
    "currencies": ["Balance"],
    "items": ["Base Type & Rarity", "Affixes", "Damage / Implicit", "Economy"],
    "loot-tables": ["Drop Generation", "Rarity Odds", "Balance / Drop Sim"],
    "materials": ["Parameters", "LOD/Perf Budget"],
    "music": ["Mix & Loudness"],
    "progression-curves": ["Concept Brief", "Curve Formula", "XP Sources", "Reward Schedule", "Caps & Catch-up", "Death Penalty", "Balance", "Telemetry", "XP Bar UI", "Test Gate"],
    "props": ["Concept Brief", "Interaction", "Collision & Physics", "Material", "Destruction States", "Loot on Destroy", "VFX / Audio", "Test Gate"],
    "quests": ["Concept Brief", "Objective Graph", "Triggers & World-State", "Rewards", "NPC & Dialog Binding", "Marker / Tracker UI", "Journal / Lore", "Localization", "Test Gate"],
    "save-points": ["Concept Brief", "State Schema", "Versioning & Migration", "Save Triggers", "Cloud / Local Storage", "Conflict Resolution", "Corruption Recovery", "Slots UI", "Load-Time Budget", "Test Gate"],
    "screen-flow": ["Concept Brief", "Navigation Graph", "Input Mapping", "Component Inventory", "Transitions / Animation", "VFX / SFX Juice", "Accessibility", "Localization", "Test Gate"],
    "spellbook": ["Balance"],
    "status-effects": ["Balance"],
    "vendors": ["Economy Sim"],
    "vfx": ["Concept Brief", "Behavior", "Sound Hook", "GPU / LOD Budget", "Test Gate"],
    "zone-map": ["Concept Brief", "Macro Layout & POIs", "Area Level & Density", "Encounter Placement", "Streaming / LOD", "Material", "Ambient & Music", "Minimap UI", "Test Gate"],
  };

  const ENGINE_ATTRIBUTION_DISPUTES: { catalogId: string; label: string; reason: string }[] = [
    ...Object.entries(HAND_AUTHORED_BY_CATALOG).flatMap(([catalogId, labels]) =>
      labels.map((label) => ({ catalogId, label, reason: HAND_AUTHORED_DISPUTE(catalogId) })),
    ),
    // EMPTY — and it must stay that way by resolution, never by deletion.
    //
    // Wave 25 (Lot MC) raised 11 disputes; the Director resolved all 11 on 2026-08-20 by correcting
    // `step-facts.json` (Class C — a lot authoring engine values must not edit its own audit):
    //   · 9 balance steps  `Claude` -> `Code`      — 'balance' is absent from CLI_ELIGIBLE_ARCHETYPES,
    //                                                  so no model can ever author these artifacts, and
    //                                                  the audit already recorded Code on 6 identical steps.
    //   · UE Import        `Code (deterministic)` -> `UE Python`
    //                                                — THIS MOVED A GRADE: `Code` is in TRUSTED_CLASSES
    //                                                  and `UE Python` is not, so the old value granted
    //                                                  credibility the step had not earned.
    //   · Face Gate 2D     `Leonardo (Lucid Origin)` -> `None`, and the spec's `engine: 'Blender'`
    //                                                  REMOVED — neither side was defensible, so the step
    //                                                  now reads UNAUTHORED rather than naming an engine
    //                                                  nobody can point at. Deliberately not re-guessed.
    //
    // The guard below ("every recorded dispute is REAL") is what forced this cleanup: it fired the moment
    // the facts were corrected and the entries went stale. Add an entry ONLY for a live disagreement you
    // can evidence from the step's own code — never to make a change pass.
  ];

  it('no authored engine silently contradicts the audited fact (disputes are listed, with reasons)', () => {
    const disputed = new Set(ENGINE_ATTRIBUTION_DISPUTES.map((d) => `${d.catalogId}/${d.label}`));
    const found: string[] = [];
    for (const s of steps) {
      if (s.spec.engine == null) continue;
      const trueEngine = getStepFact(s.catalogId, s.label)?.trueEngine;
      if (trueEngine == null || trueEngine === 'None') continue;
      if (engineFamily(trueEngine) === engineFamily(s.spec.engine)) continue;
      const key = `${s.catalogId}/${s.label}`;
      if (disputed.has(key)) continue;
      found.push(
        `${at(s)}: spec authors engine "${s.spec.engine}" but the fleet audit records trueEngine ` +
          `"${trueEngine}". resolveEngine prefers the audit, so the spec's answer is DISCARDED with no ` +
          `trace on /status. Fix one side, or record the disagreement in ENGINE_ATTRIBUTION_DISPUTES ` +
          `with the code evidence for the spec's side.`,
      );
    }
    expect(found).toEqual([]);
  });

  it('every recorded dispute is REAL (a resolved entry must be deleted, not left parked)', () => {
    const stale = ENGINE_ATTRIBUTION_DISPUTES.filter((d) => {
      const spec = steps.find((s) => s.catalogId === d.catalogId && s.label === d.label);
      if (!spec?.spec.engine) return true;
      const trueEngine = getStepFact(d.catalogId, d.label)?.trueEngine;
      if (trueEngine == null || trueEngine === 'None') return true;
      return engineFamily(trueEngine) === engineFamily(spec.spec.engine);
    }).map((d) => `${d.catalogId} / "${d.label}": recorded as a dispute but spec and audit no longer disagree — delete the entry`);
    expect(stale).toEqual([]);
    const thin = ENGINE_ATTRIBUTION_DISPUTES.filter((d) => d.reason.trim().length < 60)
      .map((d) => `${d.catalogId} / "${d.label}": dispute reason is too thin to be a reason`);
    expect(thin).toEqual([]);
  });

  // ── (o) the unauthored-engine ratchet ──────────────────────────────────────
  /**
   * How many steps of each archetype still declare NO `StepSpec.engine`.
   *
   * A ceiling per archetype, not one fleet total, so authoring a cheap bucket cannot hide a
   * regression in an expensive one. SHRINK-ONLY: lower a number when you author engines,
   * never raise one to make a change pass. Each entry says why that bucket is still open —
   * an admitted gap is honest; a blanket exemption is not.
   *
   * Measured 2026-08-20: 12 of 344 authored before the gallery+balance sweep (all in
   * character-pipeline), 65 of 344 after it — 279 steps still unauthored, and the ceilings
   * below are where they live.
   */
  const UNAUTHORED_ENGINE_CEILING: Record<string, { max: number; why: string }> = {
    brief: { max: 26, why: 'CLI-eligible text steps: a real Claude dispatch OR the local produce stub writes them, and which one ran is per-artifact, not per-spec. 34 -> 26 on 2026-08-20 (the Hand-authored sweep authored the 8 whose audit already recorded Code)' },
    rules: { max: 86, why: 'largest bucket, same CLI-eligible ambiguity as brief; needs its own pass. 126 -> 86 on 2026-08-20 (Hand-authored sweep)' },
    gallery: { max: 6, why: 'the 6 left are genuinely ambiguous from their own code: MI_ material instances (2), an NS_ Niagara variant set, an SM_ "sprite", and two SM_ terrain/biome sets that may be procedural UE geometry rather than a generated mesh' },
    checklist: { max: 50, why: '61 -> 50 on 2026-08-20 (Hand-authored sweep). A checklist enumerates work items; several have no producing engine at all and must NOT be given one' },
    manifest: { max: 33, why: 'mixed — some are UE Python import manifests, some are hand-listed asset paths' },
    balance: { max: 0, why: 'fully authored: every balance produce() is a pure function of author-typed constants, and the archetype is not CLI-eligible' },
    schema: { max: 9, why: '13 -> 9 on 2026-08-20 (Hand-authored sweep). Data-shape declarations (struct/table field lists); this slice did not read them individually and will not guess an engine from a label. RAISED 12 -> 13 on 2026-08-20 by the Director, deliberately and against the ratchet\'s direction: `character-pipeline / Face Gate 2D` declared `engine: Blender` while the audit said `Leonardo`, and NEITHER was defensible — produce() records a crop-review verdict and invokes no generator. Removing the false declaration is an improvement that this counter registers as a regression, which is the one case where the ceiling should move up. It is the ONLY such entry; do not use it as precedent for parking a step you simply did not read.' },
    custom: { max: 1, why: 'one-off bespoke bodies with no shared pattern — each needs reading on its own terms, and this slice did not reach it' },
    graph: { max: 4, why: '6 -> 4 on 2026-08-20 (Hand-authored sweep). CLI-eligible node/edge graphs: same dispatch ambiguity as brief/rules — a live Claude run and the local stub both write them' },
  };

  it('the unauthored-engine count does not grow, per archetype', () => {
    const over: string[] = [];
    for (const [archetype, { max }] of Object.entries(UNAUTHORED_ENGINE_CEILING)) {
      const n = steps.filter((s) => s.spec.archetype === archetype && s.spec.engine == null).length;
      if (n > max) {
        over.push(
          `${archetype}: ${n} steps declare no engine, ceiling is ${max} — author \`engine\` on the new ` +
            `step(s) (defensible from the step's OWN code, never guessed from its label), or leave it ` +
            `unauthored and LOWER nothing: the ceiling only ever moves down`,
        );
      }
    }
    expect(over).toEqual([]);
  });

  it('every archetype in the fleet has a declared ceiling (a new archetype cannot slip in unmeasured)', () => {
    const missing = [...new Set(steps.map((s) => s.spec.archetype))]
      .filter((a) => UNAUTHORED_ENGINE_CEILING[a] == null)
      .map((a) => `archetype "${a}" has no UNAUTHORED_ENGINE_CEILING entry — add one with its count and a reason`);
    expect(missing).toEqual([]);
    const thin = Object.entries(UNAUTHORED_ENGINE_CEILING)
      .filter(([, v]) => v.why.trim().length < 30)
      .map(([a]) => `archetype "${a}": ceiling reason is too thin to be a reason`);
    expect(thin).toEqual([]);
  });

  it('no ceiling is SLACK — a ceiling above the real count is a licence to regress', () => {
    // The ratchet only works if every number is the measured truth. A ceiling left above the
    // actual count silently re-opens room for exactly the regression it was set to stop.
    const slack = Object.entries(UNAUTHORED_ENGINE_CEILING)
      .map(([a, { max }]) => ({ a, max, n: steps.filter((s) => s.spec.archetype === a && s.spec.engine == null).length }))
      .filter((r) => r.max > r.n)
      .map((r) => `${r.a}: ceiling ${r.max} but only ${r.n} steps are unauthored — lower it to ${r.n}`);
    expect(slack).toEqual([]);
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
