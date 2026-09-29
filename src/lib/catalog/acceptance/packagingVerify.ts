/**
 * Packaging-verify pass — the drain that makes the ~30 "UE Packaging" steps truthful
 * (docs/research/packaging-truth-engine-spec.md; step-facts: their produce() writes a
 * hand-typed asset-name list and never touches disk/UE — the judge fleet's phantom
 * glyph atlas). For every persisted packaging artifact it REBUILDS the package from the
 * row's current sibling artifacts (packaging/packageArtifacts.ts) and grades the result
 * from disk truth: real staged+hashed files → L2 pass; missing references → deferred
 * with reasons; nothing packageable → deferred "declarations only". Same drain shape as
 * staticVerify (its L2 sibling); operator-triggered via
 * /api/pipeline-artifacts/verify-packaging. The package half can defer, never fail; the step's
 * own `staticChecks` are folded in (the static sweep delegates packaging steps here), and so is its
 * content checker's data-tier hold (`foldContentHold`) — a TEMPLATE/SOURCED/failing row is never
 * stored `pass` over its own checker.
 */
import type { AcceptanceResult } from './types';
import type { SiblingArtifact } from '../packaging/collect';
import type { PackageManifest, PackagingFsDeps } from '../packaging/packageArtifacts';
import { buildPackage, defaultPackagingFsDeps } from '../packaging/packageArtifacts';
import { allCatalogPipelines, getCatalogPipeline } from '../pipeline-registry';
// Side-effect: register all pipelines. Without it a cold server grades NOTHING — getCatalogPipeline
// returns null for every step and the sweep reports an empty success (verify-static: verified 0).
import '@/lib/catalog/pipelines/registry.generated';
import { listAllArtifacts, getArtifact, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { isPackagingStep } from './packagingStep';
import { staticVerdictFor, contentVerdictFor } from './staticVerify';
import { foldContentHold } from './combineVerdicts';
import { aggregatePackaging, combinePackagingVerdict, siblingsForPackaging } from './packagingGrade';

export interface PackagingVerifyFilter {
  catalogId?: string;
  entityId?: string;
}

export { isPackagingStep };

/** A pipeline that declares WHY it owns no packaging step, so the drain can report
 *  "exempt by declaration" instead of silently re-grading nothing. */
export interface PackagingExemption {
  catalogId: string;
  reason: string;
}

/**
 * Packaging coverage for one pipeline — the two states the rule allows, and nothing else.
 * Pure; the linter test and the drain both read it, so "has a packaging step" is decided
 * in ONE place.
 */
export type PackagingCoverage =
  | { kind: 'step'; label: string }
  | { kind: 'exempt'; reason: string }
  | { kind: 'none' };

export function packagingCoverage(pipeline: {
  steps: { packaging?: boolean; label: string }[];
  packagingExempt?: string;
}): PackagingCoverage {
  const step = pipeline.steps.find(isPackagingStep);
  if (step) return { kind: 'step', label: step.label };
  const reason = pipeline.packagingExempt?.trim();
  return reason ? { kind: 'exempt', reason } : { kind: 'none' };
}

export { aggregatePackaging, combinePackagingVerdict, siblingsForPackaging };

export interface PackagingVerifyRow {
  catalogId: string;
  entityId: string;
  step: string;
  from: string;
  to: string;
  detail?: string;
  reason?: string;
  changed: boolean;
}

export interface PackagingVerifySummary {
  verified: number;
  passed: number;
  deferred: number;
  /** Only a folded-in half can fail: a static check that errored, or the content checker. */
  failed: number;
  skipped: number;
  changed: number;
  results: PackagingVerifyRow[];
  /** Pipelines in scope that own NO packaging step and say why (CatalogPipeline.
   *  `packagingExempt`). Reported so a catalog the drain cannot touch reads as an
   *  explicit exemption rather than as nothing at all. */
  exempt: PackagingExemption[];
}

export interface PackagingVerifyDeps {
  listArtifacts: (filter: PackagingVerifyFilter) => { catalogId: string; entityId: string; step: string; status: string }[];
  isPackaging: (catalogId: string, step: string) => boolean;
  /** Registered pipelines in scope that declare a packaging exemption. Optional so a
   *  hand-built dep set (tests, headless recipes) needs no change; absent → none. */
  listExemptions?: (filter: PackagingVerifyFilter) => PackagingExemption[];
  /** The row's OTHER persisted artifacts — what the package must reflect. */
  getSiblings: (catalogId: string, entityId: string, packagingStep: string) => SiblingArtifact[];
  build: (catalogId: string, entityId: string, siblings: SiblingArtifact[]) => PackageManifest;
  upsertStatus: (catalogId: string, entityId: string, step: string, res: AcceptanceResult) => void;
  /** The step's aggregated L2 static verdict, or null when it declares no static checks.
   *  Folded into the packaging verdict because the static sweep leaves packaging steps to this
   *  one — a single writer per status. Optional so a hand-built dep set needs no change. */
  getStaticVerdict?: (catalogId: string, entityId: string, step: string) => AcceptanceResult | null;
  /** The step's own content checker, re-run raw on the stored data. Optional; absent → no content fold. */
  getContentVerdict?: (catalogId: string, entityId: string, step: string) => AcceptanceResult | null;
}

/** Rebuild + grade every persisted packaging artifact. `apply: false` = dry-run preview.
 *  Pure orchestration over injected deps (no fs/db here) — same shape as verifyStaticAll. */
export function verifyPackagingAll(
  filter: PackagingVerifyFilter,
  deps: PackagingVerifyDeps,
  opts?: { apply?: boolean },
): PackagingVerifySummary {
  const apply = opts?.apply !== false;
  const results: PackagingVerifyRow[] = [];
  let verified = 0, passed = 0, deferred = 0, failed = 0, skipped = 0, changed = 0;

  for (const a of deps.listArtifacts(filter)) {
    if (!deps.isPackaging(a.catalogId, a.step)) { skipped++; continue; }
    const siblings = deps.getSiblings(a.catalogId, a.entityId, a.step);
    const manifest = deps.build(a.catalogId, a.entityId, siblings);
    const verdict = foldContentHold(
      combinePackagingVerdict(aggregatePackaging(manifest, a.step), deps.getStaticVerdict?.(a.catalogId, a.entityId, a.step) ?? null),
      deps.getContentVerdict?.(a.catalogId, a.entityId, a.step) ?? null,
    );

    verified++;
    if (verdict.status === 'pass') passed++;
    else if (verdict.status === 'fail') failed++;
    else if (verdict.status === 'deferred') deferred++;

    const moved = verdict.status !== a.status;
    if (moved && apply) { deps.upsertStatus(a.catalogId, a.entityId, a.step, verdict); changed++; }
    results.push({
      catalogId: a.catalogId, entityId: a.entityId, step: a.step,
      from: a.status, to: verdict.status,
      ...(verdict.detail ? { detail: verdict.detail } : {}),
      ...(verdict.reason ? { reason: verdict.reason } : {}),
      changed: moved && apply,
    });
  }

  return { verified, passed, deferred, failed, skipped, changed, results, exempt: deps.listExemptions?.(filter) ?? [] };
}

// ── default (server) deps — real registry / artifacts db / filesystem ──
function defaultIsPackaging(catalogId: string, step: string): boolean {
  const spec = getCatalogPipeline(catalogId)?.steps.find((s) => s.label === step);
  return spec ? isPackagingStep(spec) : step === 'UE Packaging';
}

/** Every registered pipeline in scope that declares a packaging exemption. Read from the
 *  REGISTRY, not from persisted rows: a catalog with no artifacts yet is still exempt by
 *  declaration, and reporting it only when a row happens to exist would be the same
 *  silence this replaces. */
function defaultListExemptions(filter: PackagingVerifyFilter): PackagingExemption[] {
  return allCatalogPipelines()
    .filter((p) => !filter.catalogId || p.catalogId === filter.catalogId)
    .map((p) => ({ catalogId: p.catalogId, coverage: packagingCoverage(p) }))
    .flatMap(({ catalogId, coverage }) =>
      coverage.kind === 'exempt' ? [{ catalogId, reason: coverage.reason }] : [],
    );
}

function defaultGetSiblings(catalogId: string, entityId: string, packagingStep: string): SiblingArtifact[] {
  return siblingsForPackaging(listAllArtifacts({ catalogId, entityId }), packagingStep);
}

function defaultUpsertStatus(catalogId: string, entityId: string, step: string, res: AcceptanceResult): void {
  const existing = getArtifact(catalogId, entityId, step);
  upsertArtifact({
    catalogId, entityId, step,
    data: existing?.data ?? {},
    ueAssets: existing?.ueAssets ?? [],
    status: res.status,
    tier: res.tier,
    ...(res.reason ? { reason: res.reason } : res.detail ? { reason: res.detail } : {}),
  });
}

export function defaultPackagingVerifyDeps(fsDeps: PackagingFsDeps = defaultPackagingFsDeps()): PackagingVerifyDeps {
  return {
    listArtifacts: (filter) => listAllArtifacts(filter),
    isPackaging: defaultIsPackaging,
    listExemptions: defaultListExemptions,
    getSiblings: defaultGetSiblings,
    build: (catalogId, entityId, siblings) => buildPackage(catalogId, entityId, siblings, fsDeps),
    upsertStatus: defaultUpsertStatus,
    getStaticVerdict: staticVerdictFor,
    getContentVerdict: contentVerdictFor,
  };
}
