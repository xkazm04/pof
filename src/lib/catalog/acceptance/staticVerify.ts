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
import { isPackagingLabel } from './packagingStep';
import { foldContentHold, holdsBackAtDataTier } from './combineVerdicts';
import { getCatalogPipeline } from '../pipeline-registry';
// Side-effect: register all pipelines. Without it a cold server grades NOTHING — getCatalogPipeline
// returns null for every step and the sweep reports an empty success (verify-static: verified 0).
import '@/lib/catalog/pipelines/registry.generated';
import { seededEntities } from '../seed';
import { realArtifactIO, createTouched, sweepRow, sweepIODeps, contentVerdictVia, type SweepFilter } from './regrade';

export type StaticVerifyFilter = SweepFilter;

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

/** Lives in combineVerdicts (both sweeps fold through it); re-exported for existing importers. */
export { holdsBackAtDataTier };

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
  /** Re-derive one entity's lifecycle cache, once per entity an APPLY run wrote. Optional; absent
   *  → no sync (a stage, a hand-built dep set). */
  syncLifecycle?: (catalogId: string, entityId: string) => void;
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
  const touched = createTouched();

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
    // A content hold outranks a static deferral: author-owed work never reads as env-waiting.
    const verdict = foldContentHold(staticVerdict, deps.getContentVerdict?.(a.catalogId, a.entityId, a.step) ?? null);

    verified++;
    if (verdict.status === 'pass') passed++;
    else if (verdict.status === 'deferred') deferred++;
    else if (verdict.status === 'fail') failed++;

    const row = sweepRow(a, verdict);
    if (row.changed && apply) { deps.upsertStatus(a.catalogId, a.entityId, a.step, verdict); changed++; touched.add(a.catalogId, a.entityId); }
    results.push(row);
  }
  touched.flush(deps.syncLifecycle);

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

/** The step's own content checker re-run RAW on the STORED data (`contentVerdictVia` over the
 *  real store), or null when no row / no checker — what the lab's package panel folds in. */
export function contentVerdictFor(catalogId: string, entityId: string, step: string): AcceptanceResult | null {
  return contentVerdictVia(realArtifactIO)(catalogId, entityId, step);
}

export const defaultStaticVerifyDeps: StaticVerifyDeps = {
  resolveUeRoot,
  getStaticChecks: staticChecksFor,
  isPackaging: isPackagingLabel,
  ...sweepIODeps(realArtifactIO),
};

/** One step's aggregated L2 static verdict against the resolved UE root, or null when the
 *  step declares no checks — what the packaging sweep folds into a packaging step's grade. */
export function staticVerdictFor(catalogId: string, entityId: string, step: string): AcceptanceResult | null {
  const checks = staticChecksFor(catalogId, entityId, step);
  if (!checks?.length) return null;
  const root = resolveUeRoot();
  return aggregateStatic(checks.map((c) => c(root)), step);
}
