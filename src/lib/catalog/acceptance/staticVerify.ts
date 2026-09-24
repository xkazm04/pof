/**
 * L2 static-verify pass — the missing wiring that runs the catalog pipelines'
 * `staticChecks` against the REAL UE project (`Source/*.h`, `Content/Python/`) and
 * re-grades the persisted artifacts. The mechanism (`cppSymbolExists` / `seedRowPresent`
 * in `ueStaticCheckers.ts`) existed + was unit-tested but had NO production consumer; the
 * 4-tier ladder's L2 (static-against-real-UE) tier ran nowhere. This is its drain-style
 * runner: collect every artifact whose step declares `staticChecks`, run them against the
 * resolved UE root, and write the aggregated L2 verdict back — no bridge needed (pure
 * filesystem, unlike the L3/L4 drain). Operator-triggered via /api/pipeline-artifacts/verify-static.
 */
import type { AcceptanceResult } from './types';
import type { UeChecker } from './ueStaticCheckers';
import { resolveUeRoot } from './ueStaticCheckers';
import { isPackagingStep } from './packagingStep';
import { worstOf } from './combineVerdicts';
import { gradeArtifact } from '../headless';
import { getCatalogPipeline } from '../pipeline-registry';
// Side-effect: register all pipelines. Without it a cold server grades NOTHING — getCatalogPipeline
// returns null for every step and the sweep reports an empty success (verify-static: verified 0).
import '@/lib/catalog/pipelines/registry.generated';
import { seededEntities } from '../seed';
import { listAllArtifacts, getArtifact, upsertArtifact } from '@/lib/pipeline-artifacts-db';

export interface StaticVerifyFilter {
  catalogId?: string;
  entityId?: string;
}

export interface StaticVerifyRow {
  catalogId: string;
  entityId: string;
  step: string;
  from: string;
  to: string;
  detail?: string;
  reason?: string;
  changed: boolean;
}

export interface StaticVerifySummary {
  ueRoot: string | null;
  verified: number;
  passed: number;
  deferred: number;
  failed: number;
  skipped: number;
  /** Packaging steps left to the packaging sweep, which folds their static checks into ITS
   *  verdict. Counted apart from `skipped` so the hand-off reads as a decision, not a gap. */
  delegated: number;
  changed: number;
  results: StaticVerifyRow[];
}

/** Combine a step's per-check L2 results into one verdict. Pure. Returns null when the
 *  step declares no static checks (caller skips it). All present → pass; any missing →
 *  deferred (the honest "authored but not yet realized in UE"); any fail → fail. */
export function aggregateStatic(results: AcceptanceResult[], label: string): AcceptanceResult | null {
  if (!results.length) return null;
  const fails = results.filter((r) => r.status === 'fail');
  const defers = results.filter((r) => r.status === 'deferred');
  if (fails.length) {
    return { label, tier: 'L2', status: 'fail', detail: `${fails.length}/${results.length} UE static checks failed`, reason: fails.map((f) => f.reason ?? f.detail).filter(Boolean).join('; ') };
  }
  if (defers.length) {
    return {
      label, tier: 'L2', status: 'deferred',
      detail: `${results.length - defers.length}/${results.length} UE static checks present`,
      reason: defers.map((d) => d.reason ?? d.detail).filter(Boolean).join('; '),
    };
  }
  return { label, tier: 'L2', status: 'pass', detail: `${results.length}/${results.length} UE static checks present` };
}

/** True when the content checker withholds a pass for a reason in the DATA (not a runtime gate
 *  still to run) — the only content verdicts the static sweep must not paper over. Pure. */
export function holdsBackAtDataTier(content: AcceptanceResult): boolean {
  if (content.status === 'pending' || content.status === 'fail') return true;
  return content.status === 'deferred' && content.tier !== 'L3' && content.tier !== 'L4';
}

export interface StaticVerifyDeps {
  resolveUeRoot: () => string | null;
  /** The artifacts to grade (persisted steps). */
  listArtifacts: (filter: StaticVerifyFilter) => { catalogId: string; entityId: string; step: string; status: string }[];
  /** The step's `staticChecks(entity)` for this artifact, or null when the step has none. */
  getStaticChecks: (catalogId: string, entityId: string, step: string) => UeChecker[] | null;
  /** Write the re-graded L2 verdict back to the artifact (preserving its data/assets). */
  upsertStatus: (catalogId: string, entityId: string, step: string, res: AcceptanceResult) => void;
  /** Steps whose status the packaging sweep owns. Optional so a hand-built dep set needs no
   *  change; absent → nothing is delegated. */
  isPackaging?: (catalogId: string, step: string) => boolean;
  /** The step's own content checker, re-run on the stored data (raw — no judge overlay).
   *  Optional so a hand-built dep set needs no change; absent → the static verdict stands. */
  getContentVerdict?: (catalogId: string, entityId: string, step: string) => AcceptanceResult | null;
}

/**
 * Run the L2 static checks for every persisted artifact whose step declares them, against
 * the resolved UE root, and write the verdict back. `opts.apply === false` makes it a
 * dry-run preview (no writes). Pure orchestration over the injected deps (no fs/db here),
 * so it's unit-tested without a UE project or SQLite.
 */
export function verifyStaticAll(
  filter: StaticVerifyFilter,
  deps: StaticVerifyDeps,
  opts?: { apply?: boolean },
): StaticVerifySummary {
  const ueRoot = deps.resolveUeRoot();
  const apply = opts?.apply !== false;
  const results: StaticVerifyRow[] = [];
  let verified = 0, passed = 0, deferred = 0, failed = 0, skipped = 0, delegated = 0, changed = 0;

  for (const a of deps.listArtifacts(filter)) {
    // A packaging step answers to BOTH its static checks and its package's disk truth; if each
    // sweep wrote the status alone, whichever ran last would launder the other's missing half
    // (bestiary-melee-grunt: static pass over six unrealized /Game declarations).
    if (deps.isPackaging?.(a.catalogId, a.step)) { delegated++; continue; }
    const checks = deps.getStaticChecks(a.catalogId, a.entityId, a.step);
    if (!checks || !checks.length) { skipped++; continue; }
    const staticVerdict = aggregateStatic(checks.map((c) => c(ueRoot)), a.step);
    if (!staticVerdict) { skipped++; continue; }
    // A symbol existing in UE says nothing about the content: static may never lift a row its
    // own checker holds back at the data tiers — pending/fail (the d1 Stat Blocks' declared
    // `moveSpeed` gap) or deferred at L0-L2 (off-arc-fp's unresolved vfx link). A deferral at
    // L3/L4 belongs to a runtime gate the drain resolves, so it leaves the static verdict standing.
    const content = deps.getContentVerdict?.(a.catalogId, a.entityId, a.step) ?? null;
    const verdict = content && holdsBackAtDataTier(content) ? worstOf(staticVerdict, content) : staticVerdict;

    verified++;
    if (verdict.status === 'pass') passed++;
    else if (verdict.status === 'deferred') deferred++;
    else if (verdict.status === 'fail') failed++;

    const moved = verdict.status !== a.status;
    if (moved && apply) { deps.upsertStatus(a.catalogId, a.entityId, a.step, verdict); changed++; }
    results.push({
      catalogId: a.catalogId, entityId: a.entityId, step: a.step,
      from: a.status, to: verdict.status,
      ...(verdict.detail ? { detail: verdict.detail } : {}),
      ...(verdict.reason ? { reason: verdict.reason } : {}),
      changed: moved,
    });
  }

  return { ueRoot, verified, passed, deferred, failed, skipped, delegated, changed, results };
}

// ── default (server) deps — wire the real registry / seed / UE root / artifacts db ──
/** The step's declared `staticChecks` for one seeded entity, or null when it has none. */
export function staticChecksFor(catalogId: string, entityId: string, step: string): UeChecker[] | null {
  const pipeline = getCatalogPipeline(catalogId);
  const spec = pipeline?.steps.find((s) => s.label === step);
  if (!spec?.staticChecks) return null;
  const entity = seededEntities(catalogId).find((e) => e.id === entityId);
  if (!entity) return null;
  return spec.staticChecks({ id: entity.id, name: entity.name, lifecycle: entity.lifecycle, data: entity.data });
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

export const defaultStaticVerifyDeps: StaticVerifyDeps = {
  resolveUeRoot,
  listArtifacts: (filter) => listAllArtifacts(filter),
  getStaticChecks: staticChecksFor,
  upsertStatus: defaultUpsertStatus,
  getContentVerdict: (catalogId, entityId, step) => {
    const art = getArtifact(catalogId, entityId, step);
    if (!art) return null;
    const g = gradeArtifact(catalogId, step, art.data, entityId);
    return g.graded ? g.raw : null;
  },
  isPackaging: (catalogId, step) => {
    const spec = getCatalogPipeline(catalogId)?.steps.find((s) => s.label === step);
    return spec ? isPackagingStep(spec) : step === 'UE Packaging';
  },
};

/** One step's aggregated L2 static verdict against the resolved UE root, or null when the
 *  step declares no checks — what the packaging sweep folds into a packaging step's grade. */
export function staticVerdictFor(catalogId: string, entityId: string, step: string): AcceptanceResult | null {
  const checks = staticChecksFor(catalogId, entityId, step);
  if (!checks?.length) return null;
  const root = resolveUeRoot();
  return aggregateStatic(checks.map((c) => c(root)), step);
}
