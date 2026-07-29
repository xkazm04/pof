import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { isContentInvariant } from '@/lib/catalog/acceptance/contentInvariant';
import stepFacts from '@/lib/status/step-facts.json';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import { itemsAllStepLabels, itemsRegistrySteps } from '@/components/layout-lab/catalogManifest';
import type { StepFact } from '@/lib/status/statusModel';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * STEP FACTS DERIVE FROM CODE.
 *
 * `step-facts.json` powers the `ProvenanceStrip`'s central honesty claim — is this step's
 * acceptance checker MEANINGFUL, or only shape-deep. It was hand-maintained JSON with no
 * guard, and it had already drifted from the code in 58 places: 5 in the DANGEROUS
 * direction (the fact said "shape-only" while the checker was a real content invariant, so
 * the strip under-claimed a step that genuinely grades values), and 1 claim no code backed
 * at all. Nothing would have caught the reverse either — the moment someone weakened a
 * checker, the strip would keep advertising `CHECKER: MEANINGFUL`.
 *
 * This file makes the CODE the evidence. Every claim is probed against the step's real
 * `produce()` output + `accept()` closure:
 *
 *  • content-invariant — `isContentInvariant(accept)` (the `allOf`-propagated marker), and
 *    independently: mutating ONE numeric leaf of the artifact flips the verdict.
 *  • link-integrity   — the checker READS `links` (it resolves cross-catalog references).
 *  • wiring-contract  — hollowing the declared `wiringContract` to `TBD` flips the verdict.
 *  • bridge-result    — `produce()` dispatches a python module; a runner supplies the truth.
 *  • value-content    — replacing every string leaf with a same-length nonsense token flips
 *    the verdict (a graph/reference law like `graphValid`, which grades what the strings
 *    SAY, not how many there are).
 *
 * The two rules, both code-derived:
 *  (1) NO UNDER-CLAIM — a checker that is a content invariant may not be advertised as
 *      shape-only. This is the dangerous direction: it hides real verification.
 *  (2) NO UNJUSTIFIED CLAIM — `checkerMeaningful: true` must be backed by at least one
 *      probe. A pure `minCount` / `fieldsPopulated` / `minLength` checker cannot claim it.
 *
 * Deliberately NOT enforced: 1:1 equality with `isContentInvariant`. 53 of the 58 original
 * disagreements are a different VOCABULARY (a packaging manifest, a link resolution or a
 * graph law is meaningful without grading a number); forcing them to the invariant
 * definition would mislabel them. Rules (1)+(2) pin both edges instead: a `true` is always
 * backed by code, and a `false` can never hide a content invariant.
 *
 * Plus COVERAGE both ways — every live step has a fact, every fact has a live step — so a
 * new step can no longer ship rendering `PROVENANCE: UNAUDITED`, and a deleted step can no
 * longer leave a fact asserting something about nothing.
 */

const E: LabEntity = { id: 'facts-probe', name: 'Facts Probe', lifecycle: 'planned', data: {} };
const FACTS = stepFacts.steps as StepFact[];
const key = (c: string, s: string) => `${c}::${s}`;

type Accept = (d: Record<string, unknown>) => { status: string };
type Live = { catalogId: string; step: string; accept: Accept; data: Record<string, unknown> };

/* ── probes ──────────────────────────────────────────────────────────────── */

function numericLeaves(v: unknown, path: (string | number)[] = [], depth = 0, out: (string | number)[][] = []) {
  if (depth > 5 || out.length > 60) return out;
  if (typeof v === 'number' && Number.isFinite(v)) { out.push(path); return out; }
  if (Array.isArray(v)) { v.forEach((x, i) => numericLeaves(x, [...path, i], depth + 1, out)); return out; }
  if (v != null && typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) numericLeaves(x, [...path, k], depth + 1, out);
  return out;
}

/** A WRONG NUMBER fails it: perturb one numeric leaf at a time and watch for a flip. */
function numericValueFlips(l: Live): boolean {
  let clean: string;
  try { clean = l.accept(l.data).status; } catch { return false; }
  for (const p of numericLeaves(l.data)) {
    const copy = structuredClone(l.data);
    let cur = copy as Record<string | number, unknown>;
    for (const k of p.slice(0, -1)) cur = cur[k] as Record<string | number, unknown>;
    const leaf = p[p.length - 1];
    cur[leaf] = Number(cur[leaf]) * 2.7 + 13;
    try { if (l.accept(copy).status !== clean) return true; } catch { return true; }
  }
  return false;
}

let token = 0;
function scrambleStrings(v: unknown, depth = 0): unknown {
  if (depth > 6) return v;
  // Same LENGTH, different content — so a length/count checker is unmoved and only a
  // checker that reads what the strings SAY (a graph or reference law) can flip.
  if (typeof v === 'string') return `z${(token++).toString(36)}`.padEnd(v.length, 'z').slice(0, Math.max(v.length, 1));
  if (Array.isArray(v)) return v.map((x) => scrambleStrings(x, depth + 1));
  if (v != null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, scrambleStrings(x, depth + 1)]));
  }
  return v;
}

/** A WRONG REFERENCE fails it (graphValid and friends). */
function stringValueFlips(l: Live): boolean {
  let clean: string;
  try { clean = l.accept(l.data).status; } catch { return false; }
  try { return l.accept(scrambleStrings(l.data) as Record<string, unknown>).status !== clean; } catch { return true; }
}

/** The checker resolves cross-catalog links (`linksResolve` composed via `allOf`). */
function readsLinks(l: Live): boolean {
  const read = new Set<string>();
  const proxy = new Proxy({ ...l.data }, {
    get(t, k) { if (typeof k === 'string') read.add(k); return Reflect.get(t, k); },
    has(t, k) { if (typeof k === 'string') read.add(k); return Reflect.has(t, k); },
  });
  try { l.accept(proxy as Record<string, unknown>); } catch { /* the read set is what matters */ }
  return read.has('links');
}

function wiringPaths(v: unknown, path: string[] = [], depth = 0): string[][] {
  if (depth > 6 || v == null || typeof v !== 'object') return [];
  if (Array.isArray(v)) return v.flatMap((x, i) => wiringPaths(x, [...path, String(i)], depth + 1));
  return Object.entries(v as Record<string, unknown>).flatMap(([k, val]) =>
    k === 'wiringContract' ? [[...path, k]] : wiringPaths(val, [...path, k], depth + 1));
}

/** A HOLLOW wiring contract fails it (`wiringContractSound`). */
function gradesWiringContract(l: Live): boolean {
  const paths = wiringPaths(l.data);
  if (!paths.length) return false;
  let clean: string;
  try { clean = l.accept(l.data).status; } catch { return false; }
  if (clean !== 'pass') return false;
  const copy = structuredClone(l.data);
  let cur: Record<string, unknown> = copy;
  for (const k of paths[0].slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[paths[0][paths[0].length - 1]] = { grantedBy: 'TBD', activatedBy: 'TBD', verification: 'TBD', dependencies: [] };
  try { return l.accept(copy).status !== 'pass'; } catch { return true; }
}

/** A python-bridge step: the RUNNER writes the graded truth. */
const isBridgeStep = (l: Live) => l.data.python != null;

/** Every machine justification for a `checkerMeaningful: true` claim, named. */
function justifications(l: Live, invariant: boolean): string[] {
  const found: string[] = [];
  if (invariant) found.push('content-invariant(marker)');
  if (numericValueFlips(l)) found.push('content-invariant(numeric-probe)');
  if (readsLinks(l)) found.push('link-integrity');
  if (gradesWiringContract(l)) found.push('wiring-contract');
  if (isBridgeStep(l)) found.push('bridge-result');
  if (stringValueFlips(l)) found.push('value-content');
  return found;
}

/* ── the live step universe ──────────────────────────────────────────────── */

const LIVE: Live[] = [];
for (const p of allCatalogPipelines()) {
  for (const s of p.steps) {
    let data: Record<string, unknown>;
    try {
      const out = s.produce(E);
      data = { ...((out.data ?? {}) as Record<string, unknown>) };
      const topLinks = (out as { links?: unknown }).links;
      if (topLinks != null && data.links == null) data.links = topLinks;
    } catch {
      continue; // produce() throwing is the fleet spec linter's failure to report, not ours
    }
    LIVE.push({ catalogId: p.catalogId, step: s.label, accept: s.accept as unknown as Accept, data });
  }
}
// The bespoke Items steps are live too (they are what `/layout` renders — see
// ITEMS_SPEC_DUALITY). A label defined by BOTH items specs is probed through the registry
// spec, which is the fleet-wide graded authority for that step identity.
const registryItems = new Set(itemsRegistrySteps());
for (const [label, spec] of Object.entries(ITEM_STEP_SPECS)) {
  if (registryItems.has(label)) continue;
  LIVE.push({
    catalogId: 'items', step: label, accept: spec.accept as unknown as Accept,
    data: (spec.produce(E).data ?? {}) as Record<string, unknown>,
  });
}

const INVARIANT = new Map<string, boolean>();
for (const p of allCatalogPipelines()) for (const s of p.steps) INVARIANT.set(key(p.catalogId, s.label), isContentInvariant(s.accept));

describe('step-facts.json coverage — every live step, and only live steps', () => {
  it('every live pipeline step has a StepFact (nothing renders PROVENANCE: UNAUDITED)', () => {
    const factKeys = new Set(FACTS.map((f) => key(f.catalogId, f.step)));
    const missing = LIVE.filter((l) => !factKeys.has(key(l.catalogId, l.step))).map((l) => key(l.catalogId, l.step));
    expect(missing, `live steps with no step-facts.json row: ${missing.join(', ')}`).toEqual([]);
  });

  it('every StepFact describes a live step (no facts asserting things about nothing)', () => {
    const liveKeys = new Set(LIVE.map((l) => key(l.catalogId, l.step)));
    // items carries both specs' labels — every one of them is live (see ITEMS_SPEC_DUALITY).
    for (const s of itemsAllStepLabels()) liveKeys.add(key('items', s));
    const orphans = FACTS.filter((f) => !liveKeys.has(key(f.catalogId, f.step))).map((f) => key(f.catalogId, f.step));
    expect(orphans, `step-facts.json rows with no live step: ${orphans.join(', ')}`).toEqual([]);
  });

  it('has no duplicate rows (a fact is keyed by catalogId + step)', () => {
    const seen = new Set<string>();
    const dupes = FACTS.filter((f) => !seen.add(key(f.catalogId, f.step))).map((f) => key(f.catalogId, f.step));
    expect(dupes).toEqual([]);
  });

  it('carries no dead audit metadata', () => {
    // `auditedAt` was a hand-written date with ZERO readers, three weeks stale on a file
    // rewritten daily — a claim of freshness nothing could keep true. The rules below are
    // the audit now: they re-derive on every `validate`.
    expect('auditedAt' in stepFacts).toBe(false);
  });
});

describe('checkerMeaningful derives from the code', () => {
  it('(1) never advertises a CONTENT INVARIANT as shape-only', () => {
    const facts = new Map(FACTS.map((f) => [key(f.catalogId, f.step), f]));
    const violations: string[] = [];
    for (const l of LIVE) {
      const fact = facts.get(key(l.catalogId, l.step));
      if (!fact || fact.checkerMeaningful) continue;
      const marker = INVARIANT.get(key(l.catalogId, l.step)) === true;
      if (marker || numericValueFlips(l)) {
        violations.push(
          `${key(l.catalogId, l.step)}: fact says CHECKER: SHAPE-ONLY, but the code grades real values ` +
          `(${marker ? 'isContentInvariant marker' : 'a single wrong number flips the verdict'}) — set checkerMeaningful: true`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it('(2) never claims MEANINGFUL without a machine justification', () => {
    const violations: string[] = [];
    for (const fact of FACTS) {
      if (!fact.checkerMeaningful) continue;
      const l = LIVE.find((x) => x.catalogId === fact.catalogId && x.step === fact.step);
      if (!l) continue; // coverage is asserted above
      const found = justifications(l, INVARIANT.get(key(l.catalogId, l.step)) === true);
      if (found.length === 0) {
        violations.push(
          `${key(l.catalogId, l.step)}: fact claims CHECKER: MEANINGFUL, but no probe backs it — the checker ` +
          `grades neither a value, a link, a wiring contract, a bridge result nor a reference. Set ` +
          `checkerMeaningful: false, or strengthen the checker.`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it('the five steps the old JSON under-claimed now display the truth', () => {
    // Regression pins for the concrete drift this direction found (the DANGEROUS direction:
    // the strip said shape-only while the checker really grades values).
    const fixed = [
      ['bestiary', 'Monster Rarity'],
      ['loot-tables', 'Drop Generation'],
      ['loot-tables', 'Rarity Odds'],
      ['progression-curves', 'Curve Formula'],
      ['zone-map', 'Area Level & Density'],
    ] as const;
    const facts = new Map(FACTS.map((f) => [key(f.catalogId, f.step), f]));
    for (const [c, s] of fixed) {
      expect(INVARIANT.get(key(c, s)), `${key(c, s)} should be a content invariant`).toBe(true);
      expect(facts.get(key(c, s))?.checkerMeaningful, `${key(c, s)} fact`).toBe(true);
    }
  });

  it('the probes actually discriminate (a shape-only checker is not justified)', () => {
    // Guard the guard: a pure fieldsPopulated/minCount step must find NO justification, or
    // rule (2) would be vacuous.
    const shapeOnly = LIVE.filter((l) => justifications(l, INVARIANT.get(key(l.catalogId, l.step)) === true).length === 0);
    expect(shapeOnly.length).toBeGreaterThan(50);
    const invariantSteps = LIVE.filter((l) => INVARIANT.get(key(l.catalogId, l.step)) === true);
    expect(invariantSteps.length).toBeGreaterThan(10);
    for (const l of invariantSteps) {
      expect(justifications(l, true).length, `${key(l.catalogId, l.step)}`).toBeGreaterThan(0);
    }
  });
});
