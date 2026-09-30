import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { bindIconsAll } from '@/lib/catalog/acceptance/bindIconsAll';
import { listIconLibrary, makeBindIconsDeps } from '@/lib/catalog/acceptance/bindIconsDeps';
import { verifyStaticAll, defaultStaticVerifyDeps } from '@/lib/catalog/acceptance/staticVerify';
import { verifyPackagingAll, defaultPackagingVerifyDeps } from '@/lib/catalog/acceptance/packagingVerify';
import { defaultPackagingFsDeps } from '@/lib/catalog/packaging/packageArtifacts';
import { planSettle, confirmDropsRefusal, stagedFs, createArtifactStage, SETTLE_ORDER } from '@/lib/catalog/acceptance/settlePlan';
import { readDispatch, hasResult } from '@/lib/catalog/acceptance/pythonDrain';
import { realArtifactIO, stagedIO, parseSweepFilter, sweepIODeps, type ArtifactIO } from '@/lib/catalog/acceptance/regrade';
import { listAllArtifacts } from '@/lib/pipeline-artifacts-db';
import { collectDeferred } from '@/lib/test-gate-runner';
import '@/lib/catalog/pipelines/registry.generated';

/**
 * GET|POST /api/pipeline-artifacts/settle — re-settle ONE catalog (optionally ONE entity of it)
 * after a campaign.
 *
 * The idempotent filesystem truth passes (bind-icons → verify-static → verify-packaging) used
 * to be four separate acts: one mis-scoped button (bind-icons across EVERY catalog), two
 * curl-only routes, all blind. Here:
 *
 *   GET  ?catalogId=[&entityId=] → the preview. Each pass runs against an in-memory STAGE (staged verdicts
 *        and data, packaging's files in a Map), so a later pass sees an earlier pass's would-be
 *        writes — and nothing is written: no artifact row, no file under generated/packages/.
 *   POST { catalogId, entityId?, confirmDrops? } → operator-only. Re-previews, 409s unless `confirmDrops`
 *        equals the FRESH drop count (the purge-fixtures `expectRows` precedent), then applies
 *        the passes in order through their EXISTING writers (bind-icons' save, each sweep's
 *        upsertStatus — one writer per stored status) and reports the APPLIED figures.
 *
 * Every pass reads and writes through ONE `ArtifactIO` (`acceptance/regrade.ts`): the preview's
 * `stagedIO` (no lifecycle sync — it writes nothing), or the real store, whose applied passes
 * re-derive each touched entity's lifecycle once.
 *
 * The editor-bound drains are reported as `remaining`, never run: `/drain` needs a running
 * editor with the bridge, `/drain-python` the editor open with the PoF bridge.
 */
type Filter = { catalogId: string; entityId?: string };

/** Run the three passes in order through ONE io — the preview's stage, or the real store (apply).
 *  A later pass sees an earlier pass's writes either way (bind-icons' bound data → the content fold). */
function runPasses(filter: Filter, io: ArtifactIO) {
  const real = io === realArtifactIO;
  const icons = listIconLibrary();

  const bindDeps = makeBindIconsDeps(icons, io);
  const bindIcons = bindIconsAll(filter, bindDeps, { apply: true, library: icons.length });
  bindDeps.flushLifecycle();

  const stat = verifyStaticAll(filter, real ? defaultStaticVerifyDeps : { ...defaultStaticVerifyDeps, ...sweepIODeps(io) }, { apply: true });

  // The preview's package files stay in memory too: nothing under generated/packages/.
  const fsDeps = real ? defaultPackagingFsDeps() : stagedFs(defaultPackagingFsDeps());
  const pkg = verifyPackagingAll(filter, defaultPackagingVerifyDeps(fsDeps, io), { apply: true });

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
    { drain: collectDeferred(filter).length, needs: 'running UE editor (bridge)' },
    { drainPython: pythonPending, needs: 'editor open with PoF bridge' },
  ];
}

/** A settle is scoped to one catalog, and optionally to one entity of it. */
function settleFilter(input: URLSearchParams | Record<string, unknown>): Filter | null {
  const { catalogId, entityId } = parseSweepFilter(input);
  return catalogId ? { catalogId, ...(entityId ? { entityId } : {}) } : null;
}

export async function GET(req: NextRequest) {
  const filter = settleFilter(req.nextUrl.searchParams);
  if (!filter) return apiError('catalogId is required — a settle is scoped to one catalog', 400);
  try {
    return apiSuccess({ ...filter, ...runPasses(filter, stagedIO(createArtifactStage())), remaining: remaining(filter) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'settle GET failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const denied = requireOperator(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const filter = settleFilter(body);
    if (!filter) return apiError('catalogId is required — a settle is scoped to one catalog', 400);

    const fresh = runPasses(filter, stagedIO(createArtifactStage()));
    const refusal = confirmDropsRefusal(body.confirmDrops, fresh.plan.totals.drops);
    if (refusal) return apiError(refusal, 409);

    const applied = runPasses(filter, realArtifactIO);
    return apiSuccess({
      ...filter,
      ran: [...SETTLE_ORDER],
      confirmedDrops: fresh.plan.totals.drops,
      ...applied,
      remaining: remaining(filter),
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'settle POST failed', 500);
  }
}
