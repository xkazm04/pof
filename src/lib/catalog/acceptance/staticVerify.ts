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
import { getCatalogPipeline } from '../pipeline-registry';
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

export interface StaticVerifyDeps {
  resolveUeRoot: () => string | null;
  /** The artifacts to grade (persisted steps). */
  listArtifacts: (filter: StaticVerifyFilter) => { catalogId: string; entityId: string; step: string; status: string }[];
  /** The step's `staticChecks(entity)` for this artifact, or null when the step has none. */
  getStaticChecks: (catalogId: string, entityId: string, step: string) => UeChecker[] | null;
  /** Write the re-graded L2 verdict back to the artifact (preserving its data/assets). */
  upsertStatus: (catalogId: string, entityId: string, step: string, res: AcceptanceResult) => void;
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
  let verified = 0, passed = 0, deferred = 0, failed = 0, skipped = 0, changed = 0;

  for (const a of deps.listArtifacts(filter)) {
    const checks = deps.getStaticChecks(a.catalogId, a.entityId, a.step);
    if (!checks || !checks.length) { skipped++; continue; }
    const verdict = aggregateStatic(checks.map((c) => c(ueRoot)), a.step);
    if (!verdict) { skipped++; continue; }

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

  return { ueRoot, verified, passed, deferred, failed, skipped, changed, results };
}

// ── default (server) deps — wire the real registry / seed / UE root / artifacts db ──
function defaultGetStaticChecks(catalogId: string, entityId: string, step: string): UeChecker[] | null {
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
  getStaticChecks: defaultGetStaticChecks,
  upsertStatus: defaultUpsertStatus,
};
