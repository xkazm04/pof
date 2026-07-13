/**
 * Packaging-verify pass — the drain that makes the ~30 "UE Packaging" steps truthful
 * (docs/research/packaging-truth-engine-spec.md; step-facts: their produce() writes a
 * hand-typed asset-name list and never touches disk/UE — the judge fleet's phantom
 * glyph atlas). For every persisted packaging artifact it REBUILDS the package from the
 * row's current sibling artifacts (packaging/packageArtifacts.ts) and grades the result
 * from disk truth: real staged+hashed files → L2 pass; missing references → deferred
 * with reasons; nothing packageable → deferred "declarations only". Same drain shape as
 * staticVerify (its L2 sibling); operator-triggered via
 * /api/pipeline-artifacts/verify-packaging. A clean produce can defer here, never fail.
 */
import type { AcceptanceResult } from './types';
import type { SiblingArtifact } from '../packaging/collect';
import type { PackageManifest, PackagingFsDeps } from '../packaging/packageArtifacts';
import { buildPackage, defaultPackagingFsDeps } from '../packaging/packageArtifacts';
import { getCatalogPipeline } from '../pipeline-registry';
import { listAllArtifacts, getArtifact, upsertArtifact } from '@/lib/pipeline-artifacts-db';

export interface PackagingVerifyFilter {
  catalogId?: string;
  entityId?: string;
}

/** A step is a packaging step via the explicit StepSpec flag, or the canonical
 *  "UE Packaging" label every catalog pipeline ends with (no 30-file rollout needed). */
export function isPackagingStep(spec: { packaging?: boolean; label: string }): boolean {
  return spec.packaging === true || spec.label === 'UE Packaging';
}

/** Grade a rebuilt manifest into the step's L2 verdict. Pure.
 *  Files and declarations are graded together (Tier 2 rung A): a step passes only when
 *  every referenced output exists on disk AND every checked `/Game/...` declaration is
 *  realized as a `.uasset`/`.umap` under the UE root. Unchecked declarations (no UE
 *  root) fall back to the Tier 1 files-only verdict, saying so. Never 'fail'. */
export function aggregatePackaging(manifest: PackageManifest, label: string): AcceptanceResult {
  const staged = manifest.files.length;
  const decls = manifest.ueDeclarations;
  const checked = decls.filter((d) => d.realized !== null);
  const realized = checked.filter((d) => d.realized === true);
  const unrealized = checked.filter((d) => d.realized === false);
  const declDetail =
    checked.length > 0
      ? `${realized.length}/${checked.length} UE declarations realized on disk`
      : decls.length > 0
        ? `${decls.length} UE declarations unchecked (no UE root resolved)`
        : '';

  const reasons: string[] = [];
  if (manifest.missing.length > 0) {
    reasons.push(...manifest.missing.map((m) => `${m.path} (${m.sourceStep}: ${m.reason})`));
  }
  if (unrealized.length > 0) {
    const head = unrealized.slice(0, 6).map((d) => d.path).join(', ');
    reasons.push(`${unrealized.length} UE declaration(s) not realized in Content/: ${head}${unrealized.length > 6 ? ', …' : ''}`);
  }

  if (reasons.length > 0) {
    return {
      label, tier: 'L2', status: 'deferred',
      detail: [`${staged}/${staged + manifest.missing.length} referenced outputs present on disk`, declDetail].filter(Boolean).join('; '),
      reason: reasons.join('; '),
    };
  }

  const hasSubstance = staged > 0 || realized.length > 0;
  if (hasSubstance) {
    return {
      label, tier: 'L2', status: 'pass',
      detail: [staged > 0 ? `${staged} real files staged + hashed in the package manifest` : '', declDetail].filter(Boolean).join('; '),
    };
  }

  return {
    label, tier: 'L2', status: 'deferred',
    detail: 'package is empty — no sibling step has produced a file yet',
    reason:
      `no packageable file outputs among sibling artifacts; ` +
      `${decls.length} UE asset declaration(s) listed — those are realized/verified by the L3 gates`,
  };
}

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
  skipped: number;
  changed: number;
  results: PackagingVerifyRow[];
}

export interface PackagingVerifyDeps {
  listArtifacts: (filter: PackagingVerifyFilter) => { catalogId: string; entityId: string; step: string; status: string }[];
  isPackaging: (catalogId: string, step: string) => boolean;
  /** The row's OTHER persisted artifacts — what the package must reflect. */
  getSiblings: (catalogId: string, entityId: string, packagingStep: string) => SiblingArtifact[];
  build: (catalogId: string, entityId: string, siblings: SiblingArtifact[]) => PackageManifest;
  upsertStatus: (catalogId: string, entityId: string, step: string, res: AcceptanceResult) => void;
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
  let verified = 0, passed = 0, deferred = 0, skipped = 0, changed = 0;

  for (const a of deps.listArtifacts(filter)) {
    if (!deps.isPackaging(a.catalogId, a.step)) { skipped++; continue; }
    const siblings = deps.getSiblings(a.catalogId, a.entityId, a.step);
    const manifest = deps.build(a.catalogId, a.entityId, siblings);
    const verdict = aggregatePackaging(manifest, a.step);

    verified++;
    if (verdict.status === 'pass') passed++;
    else deferred++;

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

  return { verified, passed, deferred, skipped, changed, results };
}

// ── default (server) deps — real registry / artifacts db / filesystem ──
function defaultIsPackaging(catalogId: string, step: string): boolean {
  const spec = getCatalogPipeline(catalogId)?.steps.find((s) => s.label === step);
  return spec ? isPackagingStep(spec) : step === 'UE Packaging';
}

/** Sibling view for the package build: every OTHER artifact contributes data + declarations;
 *  the packaging artifact itself contributes ONLY its `ueAssets` — that declared list is
 *  the step's own claim (the thing Tier 2 verifies), while its data (the hand-typed asset
 *  name list) must never feed the file collector. Pure. */
export function siblingsForPackaging(
  artifacts: { step: string; data: Record<string, unknown>; ueAssets: string[] }[],
  packagingStep: string,
): SiblingArtifact[] {
  return artifacts.map((a) =>
    a.step === packagingStep
      ? { step: a.step, data: {}, ueAssets: a.ueAssets }
      : { step: a.step, data: a.data, ueAssets: a.ueAssets },
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
    getSiblings: defaultGetSiblings,
    build: (catalogId, entityId, siblings) => buildPackage(catalogId, entityId, siblings, fsDeps),
    upsertStatus: defaultUpsertStatus,
  };
}
