import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { drainPythonAll, readDispatch, hasResult, type PythonDrainFilter, type PythonDrainDeps } from '@/lib/catalog/acceptance/pythonDrain';
import { listAllArtifacts, getArtifact, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { gradeArtifact } from '@/lib/catalog/headless';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { runPython } from '@/lib/bridge/run-python';
import '@/lib/catalog/pipelines/registry.generated';

/**
 * Python-step drain — runs each python-driven step's module on the live editor thread
 * (`/pof/python/run`) and re-grades the artifact with the module's own return.
 *
 * The editor must be RUNNING with the PoF bridge (default http://localhost:30040); with it
 * closed every step reports `bridge-error` and NOTHING is written — "we could not ask" is
 * not "the step failed". This is the opposite prerequisite to `/drain`, which spawns its own
 * headless editor and therefore needs the editor CLOSED.
 */
function makeDeps(bridgeUrl?: string): PythonDrainDeps {
  return {
    listArtifacts: (filter) =>
      listAllArtifacts(filter).map((a) => ({
        catalogId: a.catalogId,
        entityId: a.entityId,
        step: a.step,
        status: a.status,
        data: a.data ?? {},
      })),
    stepOrder: (catalogId) => getCatalogPipeline(catalogId)?.steps.map((s) => s.label) ?? [],
    run: async (module, fn) => {
      const res = await runPython(module, fn, {}, bridgeUrl ? { bridgeUrl } : {});
      return res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error };
    },
    grade: (catalogId, step, data, entityId) => {
      const { graded, raw } = gradeArtifact(catalogId, step, data, entityId);
      return graded ? raw : null;
    },
    save: (catalogId, entityId, step, data, res) => {
      const existing = getArtifact(catalogId, entityId, step);
      upsertArtifact({
        catalogId, entityId, step,
        data,
        ueAssets: existing?.ueAssets ?? [],
        status: res.status,
        tier: res.tier,
        ...(res.reason ? { reason: res.reason } : res.detail ? { reason: res.detail } : {}),
      });
    },
  };
}

function parseFilter(get: (k: 'catalogId' | 'entityId') => string | null | undefined): PythonDrainFilter {
  const catalogId = get('catalogId');
  const entityId = get('entityId');
  return { ...(catalogId ? { catalogId } : {}), ...(entityId ? { entityId } : {}) };
}

/**
 * GET — preview WITHOUT touching the bridge: which steps declare a dispatch, which already
 * hold a result, in the order the drain would run them. Answers "what would this do" while
 * the editor is closed.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter = parseFilter((k) => sp.get(k));
    const rows = listAllArtifacts(filter)
      .map((a) => {
        const dispatch = readDispatch(a.data ?? {});
        return dispatch
          ? {
              catalogId: a.catalogId, entityId: a.entityId, step: a.step, status: a.status,
              module: dispatch.module, function: dispatch.function,
              alreadyDrained: hasResult(a.data ?? {}),
              order: getCatalogPipeline(a.catalogId)?.steps.findIndex((s) => s.label === a.step) ?? -1,
            }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .sort((x, y) => x.catalogId.localeCompare(y.catalogId) || x.entityId.localeCompare(y.entityId) || x.order - y.order);
    return apiSuccess({ dispatchable: rows.length, pending: rows.filter((r) => !r.alreadyDrained).length, rows });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'drain-python GET failed', 500);
  }
}

/**
 * POST — dispatch. Body: `{ catalogId?, entityId?, force?, continueOnFail?, bridgeUrl?, apply? }`.
 * `force` re-runs steps that already hold a result (the modules are idempotent);
 * `continueOnFail` keeps going after a condemned step instead of stopping that entity's chain.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      catalogId?: string; entityId?: string; force?: boolean; continueOnFail?: boolean; bridgeUrl?: string; apply?: boolean;
    };
    const summary = await drainPythonAll(
      parseFilter((k) => body[k]),
      makeDeps(body.bridgeUrl),
      { apply: body.apply !== false, force: body.force === true, continueOnFail: body.continueOnFail === true },
    );
    return apiSuccess(summary);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'drain-python POST failed', 500);
  }
}
