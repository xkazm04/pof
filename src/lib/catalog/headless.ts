/**
 * Headless catalog-pipeline reader — the server-side "structure + truth" the
 * pof-mcp layer hands to the orchestrating Claude.
 *
 * The `/layout` lab computes these three things client-side (catalog list, entity
 * list, and a step's Produce recipe + Acceptance contract). This module recomputes
 * them from the SAME server-importable sources (the pipeline registry, the seed
 * reader, the canon table) so a step can be driven headlessly with an identical
 * prompt + acceptance contract. No React, no client stores — safe to import from an
 * API route.
 *
 * (Distinct from `recipe.ts`, which holds the legacy generation-engine recipes.)
 */
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { seededEntities } from '@/lib/catalog/seed';
import { listLifecycle } from '@/lib/catalog-db';
import { listArtifacts, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { listVerdicts } from '@/lib/status/judge-verdicts-db';
import { getStepFact } from '@/lib/status/statusModel';
import { bridgeJudgeVerdict } from '@/lib/catalog/acceptance/judgeBridge';
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { ARCHETYPE_CANON } from '@/lib/catalog/canon/archetypeCanon';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { AcceptanceResult, Checker, CheckerContext } from '@/lib/catalog/acceptance/types';
import type { ViewDescriptor, StepSpec } from '@/lib/catalog/stepSpec';
import type { LifecycleState, TestResult, StoredCatalogEntity } from '@/lib/catalog/types';

/** A "not found" recipe error carries a 404 so routes can map it precisely. */
export class CatalogNotFoundError extends Error {
  readonly status = 404;
  constructor(message: string) {
    super(message);
    this.name = 'CatalogNotFoundError';
  }
}

export interface CatalogSummary {
  catalogId: string;
  label: string;
  category: string;
  description: string;
  /** Ordered Produce step labels (empty when the catalog has no registered pipeline). */
  steps: string[];
  entityCount: number;
  registered: boolean;
}

export interface EntitySummary {
  id: string;
  name: string;
  lifecycle: LifecycleState;
  ueAssets: string[];
  lastTestResult?: TestResult;
}

export interface StepRecipe {
  catalogId: string;
  entityId: string;
  entityName: string;
  step: string;
  archetype: string;
  view: ViewDescriptor;
  produceNote?: string;
  defaultDirection?: string;
  /** Canon categories prefixed to the prompt for this archetype. */
  canonCategories: string[];
  /** The full instruction Claude should fulfil: canon prefix + the Produce line. */
  prompt: string;
  /** A deterministic example of a passing artifact's data + the UE asset paths the step owns. */
  example: { data: Record<string, unknown>; ueAssetTargets: string[] } | null;
  /** The Acceptance contract, derived from the step's Checker (never a manual toggle). */
  acceptance: {
    label: string;
    tier: string;
    /** What the verdict would be if the example data were submitted — i.e. what "good" looks like. */
    exampleStatus?: string;
    exampleDetail?: string;
    /** The verdict for whatever is currently persisted (or the pending message if nothing is). */
    currentStatus: string;
    currentDetail?: string;
    currentReason?: string;
  };
  /** What's already persisted for this step, if anything (so Claude sees prior work). */
  current: { data: Record<string, unknown>; status: string; tier?: string; ueAssets: string[] } | null;
}

/**
 * Run a Checker without letting a thrown produce/accept blow up the whole recipe. A throw
 * degrades to `pending` (NEVER an optimistic pass) but now SURFACES the real error message
 * (truncated) as the reason — instead of the old opaque `null` → "unverified" — so the
 * failing checker names what actually broke.
 */
export function safeAccept(accept: Checker, data: Record<string, unknown>, ctx?: CheckerContext): AcceptanceResult {
  try {
    return accept(data, ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { label: 'Acceptance check', tier: 'L0', status: 'pending', detail: 'checker threw', reason: `acceptance check threw: ${msg.slice(0, 200)}` };
  }
}

/**
 * Overlay any CURRENT-RUBRIC judge verdict for this (catalog, entity, step) onto the
 * checker's AcceptanceResult, so acceptance and the judge honesty-layer speak one truth
 * (a matching-class judge FAIL down-grades a shape-pass to `fail`/attention). READ-ONLY:
 * reads `judge_verdicts`, never re-grades. Needs a concrete entity to scope the verdict.
 */
function bridgeAcceptance(
  catalogId: string,
  entityId: string,
  step: string,
  result: AcceptanceResult,
): AcceptanceResult {
  const verdicts = listVerdicts(catalogId).filter((v) => v.entityId === entityId && v.step === step);
  if (!verdicts.length) return result;
  return bridgeJudgeVerdict(result, verdicts, getStepFact(catalogId, step)?.judge);
}

/**
 * The server-side CheckerContext for a (catalog, entity): sibling steps' persisted data
 * (when an entityId is known) plus a cross-catalog `has` derived from the SEEDED entities —
 * the server-importable source of entity existence. Mirrors the lab's catalog-store `has`.
 */
function serverCheckerContext(catalogId: string, entityId?: string): CheckerContext {
  const siblings: Record<string, Record<string, unknown>> = {};
  if (entityId) {
    for (const a of listArtifacts(catalogId, entityId)) siblings[a.step] = a.data;
  }
  return {
    catalog: catalogId,
    siblings,
    has: (c, e) => seededEntities(c).some((x) => x.id === e),
  };
}

/**
 * The server-side acceptance Checker for a (catalog, step), or null when the catalog
 * has no registered pipeline. Bespoke Items specs and synthetic catalogs (loot-filter)
 * have no server-importable checker, so the server genuinely can't re-derive them.
 */
export function serverCheckerFor(catalogId: string, step: string): Checker | null {
  const pipeline = getCatalogPipeline(catalogId);
  if (!pipeline) return null;
  return pipeline.steps.find((s) => s.label === step)?.accept ?? null;
}

/**
 * Grade a submitted artifact with the server's own checker — the caller never self-grades.
 * `graded` is false when no server checker exists (the caller's status must then stand).
 * A registered step's checker always resolves (a throw degrades to `pending` via `safeAccept`),
 * so a caller can never turn "checker didn't resolve" into an optimistic pass.
 *
 * Two verdicts come back for one grade:
 *  - `raw`    — the PURE checker verdict. This is what write paths PERSIST: the artifact row
 *               holds the checker's own truth, and judge state lives apart in `judge_verdicts`
 *               (matching the headless `submitStepArtifact` path, which also persists raw). A
 *               judge overlay must never be baked into the stored status, or the same logical
 *               write would persist different rows depending on the client (browser vs MCP) and
 *               skew `summarizeEntity`, which counts straight off `art.status`.
 *  - `result` — `raw` with any current-rubric judge verdict bridged in (scoped to a concrete
 *               entity), for READ/response/display. Read paths (`buildStepRecipe`, `/status`)
 *               apply the same overlay, so the bridged truth is reconstructed on read.
 */
export function gradeArtifact(
  catalogId: string,
  step: string,
  data: Record<string, unknown>,
  entityId?: string,
): { graded: boolean; result: AcceptanceResult | null; raw: AcceptanceResult | null } {
  const checker = serverCheckerFor(catalogId, step);
  if (!checker) return { graded: false, result: null, raw: null };
  const raw = safeAccept(checker, data, serverCheckerContext(catalogId, entityId));
  const result = entityId ? bridgeAcceptance(catalogId, entityId, step, raw) : raw;
  return { graded: true, result, raw };
}

/** Map a seeded entity to the `LabEntity` shape the step `produce`/`accept` expect. */
function toLabEntity(e: StoredCatalogEntity) {
  return { id: e.id, name: e.name, lifecycle: e.lifecycle, data: e.data };
}

/** Every catalog the lab shows, with its ordered steps + seeded entity count. */
export function listCatalogSummaries(): CatalogSummary[] {
  return CATALOG_SECTIONS.map((s) => {
    const pipeline = getCatalogPipeline(s.catalogId);
    return {
      catalogId: s.catalogId,
      label: s.label,
      category: s.category ?? 'Other',
      description: s.description ?? '',
      steps: pipeline?.steps.map((st) => st.label) ?? [],
      entityCount: seededEntities(s.catalogId).length,
      registered: !!pipeline,
    };
  });
}

/** Seeded entities for a catalog, with current lifecycle merged from the DB (server truth). */
export function listEntitySummaries(catalogId: string): EntitySummary[] {
  const seeded = seededEntities(catalogId);
  if (!seeded.length && !getCatalogPipeline(catalogId)) {
    throw new CatalogNotFoundError(`Unknown catalog: ${catalogId}`);
  }
  const byId = new Map(listLifecycle(catalogId).map((r) => [r.entityId, r]));
  return seeded.map((e) => {
    const row = byId.get(e.id);
    const lastTestResult = row?.lastTestResult ?? e.lastTestResult;
    return {
      id: e.id,
      name: e.name,
      lifecycle: row?.lifecycle ?? e.lifecycle,
      ueAssets: row?.ueAssets ?? e.ueAssets ?? [],
      ...(lastTestResult ? { lastTestResult: lastTestResult as TestResult } : {}),
    };
  });
}

/** Resolve the pipeline + step spec for a (catalog, step), or throw a 404 with hints. */
function resolveStep(catalogId: string, step: string): StepSpec {
  const pipeline = getCatalogPipeline(catalogId);
  if (!pipeline) throw new CatalogNotFoundError(`Unknown catalog: ${catalogId}`);
  const spec = pipeline.steps.find((s) => s.label === step);
  if (!spec) {
    throw new CatalogNotFoundError(
      `Unknown step "${step}" for catalog ${catalogId}. Steps: ${pipeline.steps.map((s) => s.label).join(', ')}`,
    );
  }
  return spec;
}

/**
 * Build the headless recipe for one (catalog, entity, step): the canon-prefixed
 * prompt, the declarative View, the Acceptance contract, the UE asset targets, and
 * any already-persisted artifact. `rules` is the project canon (pass `listRules()`
 * from the route; tests can pass `[]` for a canon-free prompt).
 */
export function buildStepRecipe(
  catalogId: string,
  entityId: string,
  step: string,
  direction: string | undefined,
  rules: ProjectRule[],
): StepRecipe {
  const spec = resolveStep(catalogId, step);

  const entity = seededEntities(catalogId).find((e) => e.id === entityId);
  if (!entity) {
    const ids = seededEntities(catalogId).map((e) => e.id);
    throw new CatalogNotFoundError(
      `Unknown entity "${entityId}" in catalog ${catalogId}. Entities: ${ids.join(', ') || '(none seeded)'}`,
    );
  }
  const labEntity = toLabEntity(entity);

  const canonCategories = ARCHETYPE_CANON[spec.archetype] ?? [];
  const canon = canonContextFor(rules, catalogId, canonCategories);
  const dir = (direction ?? '').trim() || spec.defaultDirection || '';
  const prompt = [canon, `Produce ${spec.label} for ${entity.name}. ${dir}`.trim()]
    .filter(Boolean)
    .join('\n\n');

  let example: StepRecipe['example'] = null;
  try {
    const out = spec.produce(labEntity);
    example = { data: out.data ?? {}, ueAssetTargets: out.ueAssets ?? [] };
  } catch {
    example = null;
  }

  const ctx = serverCheckerContext(catalogId, entityId);
  const exampleRes = example ? safeAccept(spec.accept, example.data, ctx) : null;

  const arts = listArtifacts(catalogId, entityId);
  const cur = arts.find((a) => a.step === step) ?? null;
  const current: StepRecipe['current'] = cur
    ? { data: cur.data, status: cur.status, ...(cur.tier ? { tier: cur.tier } : {}), ueAssets: cur.ueAssets }
    : null;

  // Current verdict: persisted truth when present (it may carry an L3/L4 drain verdict
  // the pure Checker can't reproduce), otherwise the pending message from accept({}).
  const pendingRes = safeAccept(spec.accept, {}, ctx);
  // Bridge the persisted verdict through the judge honesty-layer so a checker-pass that a
  // current-rubric judge FAILED shows the downgrade + judge reason here too (Claude sees
  // the same truth /status shows), not a stale pass.
  const curRes = cur
    ? bridgeAcceptance(catalogId, entityId, step, {
        label: exampleRes?.label ?? pendingRes?.label ?? spec.label,
        tier: (cur.tier as AcceptanceResult['tier'] | undefined) ?? exampleRes?.tier ?? pendingRes?.tier ?? 'L0',
        status: cur.status as AcceptanceResult['status'],
        detail: '',
        ...(cur.reason ? { reason: cur.reason } : {}),
      })
    : null;
  const acceptance: StepRecipe['acceptance'] = {
    label: exampleRes?.label ?? pendingRes?.label ?? spec.label,
    tier: exampleRes?.tier ?? pendingRes?.tier ?? 'L0',
    ...(exampleRes ? { exampleStatus: exampleRes.status, exampleDetail: exampleRes.detail } : {}),
    currentStatus: curRes?.status ?? pendingRes?.status ?? 'pending',
    ...(!cur && pendingRes?.detail ? { currentDetail: pendingRes.detail } : {}),
    ...(curRes?.reason ? { currentReason: curRes.reason } : {}),
  };

  return {
    catalogId,
    entityId,
    entityName: entity.name,
    step,
    archetype: spec.archetype,
    view: spec.view,
    ...(spec.produceNote ? { produceNote: spec.produceNote } : {}),
    ...(spec.defaultDirection ? { defaultDirection: spec.defaultDirection } : {}),
    canonCategories,
    prompt,
    example,
    acceptance,
    current,
  };
}

export interface SubmitResult {
  artifact: {
    catalogId: string;
    entityId: string;
    step: string;
    data: Record<string, unknown>;
    ueAssets: string[];
    status: string;
    tier?: string;
    reason?: string;
  };
  /** The DERIVED acceptance verdict — the server grades the submission; Claude never self-grades. */
  acceptance: { status: string; tier: string; label: string; detail?: string; reason?: string };
}

/**
 * Persist a step's produced artifact and return the SERVER-DERIVED acceptance verdict.
 *
 * This is the headless equivalent of the lab's Produce → setLabSync write-through: the
 * orchestrating Claude submits its work (data + UE asset paths), and the step's own
 * Checker decides pass/pending/fail/deferred. L3/L4 deferrals are later upgraded by the
 * gate-drain runner — the submit never claims a runtime/visual pass.
 */
export function submitStepArtifact(
  catalogId: string,
  entityId: string,
  step: string,
  data: Record<string, unknown>,
  ueAssets: string[],
): SubmitResult {
  const spec = resolveStep(catalogId, step); // throws CatalogNotFoundError for unknown catalog/step
  const res = safeAccept(spec.accept, data, serverCheckerContext(catalogId, entityId));
  const status = res?.status ?? 'pending';
  const tier = res?.tier ?? 'L0';
  const reason = res?.reason;
  const artifact = upsertArtifact({
    catalogId,
    entityId,
    step,
    data,
    ueAssets,
    status,
    tier,
    ...(reason ? { reason } : {}),
  });
  // The persisted artifact keeps the checker's own verdict (storage separation is
  // deliberate — judge_verdicts lives apart). The RETURNED acceptance the caller consumes
  // is bridged, so a current-rubric judge FAIL surfaces here instead of a stale pass.
  const bridged = res ? bridgeAcceptance(catalogId, entityId, step, res) : res;
  return {
    artifact: {
      catalogId: artifact.catalogId,
      entityId: artifact.entityId,
      step: artifact.step,
      data: artifact.data,
      ueAssets: artifact.ueAssets,
      status: artifact.status,
      ...(artifact.tier ? { tier: artifact.tier } : {}),
      ...(artifact.reason ? { reason: artifact.reason } : {}),
    },
    acceptance: {
      status: bridged?.status ?? status,
      tier: bridged?.tier ?? tier,
      label: bridged?.label ?? res?.label ?? step,
      ...(bridged?.detail ? { detail: bridged.detail } : {}),
      ...(bridged?.reason ? { reason: bridged.reason } : reason ? { reason } : {}),
    },
  };
}
