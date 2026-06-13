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
import { canonContextFor } from '@/lib/catalog/canon/canonContext';
import { ARCHETYPE_CANON } from '@/lib/catalog/canon/archetypeCanon';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { AcceptanceResult, Checker } from '@/lib/catalog/acceptance/types';
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

/** Run a Checker without letting a thrown produce/accept blow up the whole recipe. */
function safeAccept(accept: Checker, data: Record<string, unknown>): AcceptanceResult | null {
  try {
    return accept(data);
  } catch {
    return null;
  }
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

  const exampleRes = example ? safeAccept(spec.accept, example.data) : null;

  const arts = listArtifacts(catalogId, entityId);
  const cur = arts.find((a) => a.step === step) ?? null;
  const current: StepRecipe['current'] = cur
    ? { data: cur.data, status: cur.status, ...(cur.tier ? { tier: cur.tier } : {}), ueAssets: cur.ueAssets }
    : null;

  // Current verdict: persisted truth when present (it may carry an L3/L4 drain verdict
  // the pure Checker can't reproduce), otherwise the pending message from accept({}).
  const pendingRes = safeAccept(spec.accept, {});
  const acceptance: StepRecipe['acceptance'] = {
    label: exampleRes?.label ?? pendingRes?.label ?? spec.label,
    tier: exampleRes?.tier ?? pendingRes?.tier ?? 'L0',
    ...(exampleRes ? { exampleStatus: exampleRes.status, exampleDetail: exampleRes.detail } : {}),
    currentStatus: cur?.status ?? pendingRes?.status ?? 'pending',
    ...(!cur && pendingRes?.detail ? { currentDetail: pendingRes.detail } : {}),
    ...(cur?.reason ? { currentReason: cur.reason } : {}),
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
  const res = safeAccept(spec.accept, data);
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
      status,
      tier,
      label: res?.label ?? step,
      ...(res?.detail ? { detail: res.detail } : {}),
      ...(reason ? { reason } : {}),
    },
  };
}
