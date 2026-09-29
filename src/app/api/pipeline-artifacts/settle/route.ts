import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { bindIconsAll, type BindIconsDeps } from '@/lib/catalog/acceptance/bindIconsAll';
import { listIconLibrary, makeBindIconsDeps } from '@/lib/catalog/acceptance/bindIconsDeps';
import { verifyStaticAll, defaultStaticVerifyDeps, type StaticVerifyDeps } from '@/lib/catalog/acceptance/staticVerify';
import { verifyPackagingAll, defaultPackagingVerifyDeps, siblingsForPackaging } from '@/lib/catalog/acceptance/packagingVerify';
import { defaultPackagingFsDeps } from '@/lib/catalog/packaging/packageArtifacts';
import {
  planSettle, confirmDropsRefusal, stagedFs, createArtifactStage, SETTLE_ORDER, type ArtifactStage,
} from '@/lib/catalog/acceptance/settlePlan';
import { readDispatch, hasResult } from '@/lib/catalog/acceptance/pythonDrain';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import { listAllArtifacts } from '@/lib/pipeline-artifacts-db';
import { gradeArtifact } from '@/lib/catalog/headless';
import { collectDeferred } from '@/lib/test-gate-runner';
import '@/lib/catalog/pipelines/registry.generated';

/**
 * GET|POST /api/pipeline-artifacts/settle — re-settle ONE catalog after a campaign.
 *
 * The idempotent filesystem truth passes (bind-icons → verify-static → verify-packaging) used
 * to be four separate acts: one mis-scoped button (bind-icons across EVERY catalog), two
 * curl-only routes, all blind. Here:
 *
 *   GET  ?catalogId= → the preview. Each pass runs against an in-memory STAGE (staged verdicts
 *        and data, packaging's files in a Map), so a later pass sees an earlier pass's would-be
 *        writes — and nothing is written: no artifact row, no file under generated/packages/.
 *   POST { catalogId, confirmDrops? } → operator-only. Re-previews, 409s unless `confirmDrops`
 *        equals the FRESH drop count (the purge-fixtures `expectRows` precedent), then applies
 *        the passes in order through their EXISTING writers (bind-icons' save, each sweep's
 *        upsertStatus — one writer per stored status) and reports the APPLIED figures.
 *
 * The editor-bound drains are reported as `remaining`, never run: `/drain` needs a running
 * editor with the bridge, `/drain-python` the editor open with the PoF bridge.
 */
type Filter = { catalogId: string };

/** Run the three passes in order — against `stage` (preview) or the real writers (apply). */
function runPasses(filter: Filter, stage: ArtifactStage | null) {
  const icons = listIconLibrary();
  const list = (f: { catalogId?: string; entityId?: string }) =>
    stage ? stage.overlay(listAllArtifacts(f)) : listAllArtifacts(f);
  const stageStatus = (c: string, e: string, s: string, res: AcceptanceResult) =>
    stage?.save(c, e, s, { status: res.status, tier: res.tier, ...(res.reason ? { reason: res.reason } : {}) });
  // A staged data rewrite (bind-icons) is what a later content fold must grade, not the stored row.
  const content = (base?: (c: string, e: string, s: string) => AcceptanceResult | null) =>
    (c: string, e: string, s: string): AcceptanceResult | null => {
      const staged = stage?.get(c, e, s)?.data;
      if (!staged) return base?.(c, e, s) ?? null;
      const g = gradeArtifact(c, s, staged, e);
      return g.graded ? g.raw : null;
    };

  const bindBase = makeBindIconsDeps(icons);
  const bindDeps: BindIconsDeps = stage
    ? { ...bindBase, save: (c, e, s, data, res) => stage.save(c, e, s, { status: res.status, tier: res.tier, data }) }
    : bindBase;
  const bindIcons = bindIconsAll(filter, bindDeps, { apply: true, library: icons.length });

  const staticDeps: StaticVerifyDeps = stage
    ? { ...defaultStaticVerifyDeps, listArtifacts: list, upsertStatus: stageStatus, getContentVerdict: content(defaultStaticVerifyDeps.getContentVerdict) }
    : defaultStaticVerifyDeps;
  const stat = verifyStaticAll(filter, staticDeps, { apply: true });

  const pkgBase = defaultPackagingVerifyDeps(stage ? stagedFs(defaultPackagingFsDeps()) : defaultPackagingFsDeps());
  const pkg = verifyPackagingAll(filter, stage
    ? {
      ...pkgBase,
      listArtifacts: list,
      getSiblings: (c, e, step) => siblingsForPackaging(list({ catalogId: c, entityId: e }), step),
      upsertStatus: stageStatus,
      getContentVerdict: content(pkgBase.getContentVerdict),
    }
    : pkgBase, { apply: true });

  return {
    plan: planSettle({
      bindIcons: { library: icons.length, results: bindIcons.results },
      static: { ueRoot: stat.ueRoot, results: stat.results },
      packaging: { results: pkg.results, exempt: pkg.exempt },
    }),
    bindIcons,
    ueRoot: stat.ueRoot,
  };
}

/** What the filesystem passes cannot settle — read, never run. */
function remaining(filter: Filter) {
  const pythonPending = listAllArtifacts(filter)
    .filter((a) => readDispatch(a.data ?? {}) && !hasResult(a.data ?? {})).length;
  return [
    { drain: collectDeferred({ catalogId: filter.catalogId }).length, needs: 'running UE editor (bridge)' },
    { drainPython: pythonPending, needs: 'editor open with PoF bridge' },
  ];
}

export async function GET(req: NextRequest) {
  const catalogId = req.nextUrl.searchParams.get('catalogId');
  if (!catalogId) return apiError('catalogId is required — a settle is scoped to one catalog', 400);
  try {
    const filter = { catalogId };
    return apiSuccess({ catalogId, ...runPasses(filter, createArtifactStage()), remaining: remaining(filter) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'settle GET failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const denied = requireOperator(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as { catalogId?: unknown; confirmDrops?: unknown };
    const catalogId = typeof body.catalogId === 'string' && body.catalogId ? body.catalogId : null;
    if (!catalogId) return apiError('catalogId is required — a settle is scoped to one catalog', 400);
    const filter = { catalogId };

    const fresh = runPasses(filter, createArtifactStage());
    const refusal = confirmDropsRefusal(body.confirmDrops, fresh.plan.totals.drops);
    if (refusal) return apiError(refusal, 409);

    const applied = runPasses(filter, null);
    return apiSuccess({
      catalogId,
      ran: [...SETTLE_ORDER],
      confirmedDrops: fresh.plan.totals.drops,
      ...applied,
      remaining: remaining(filter),
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'settle POST failed', 500);
  }
}
