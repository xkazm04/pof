import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { drainPythonAll, readDispatch, hasResult, type PythonDrainDeps } from '@/lib/catalog/acceptance/pythonDrain';
import { listAllArtifacts } from '@/lib/pipeline-artifacts-db';
import { persistRegrade, realArtifactIO, createTouched, parseSweepFilter } from '@/lib/catalog/acceptance/regrade';
import { gradeArtifact } from '@/lib/catalog/headless';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { runPython } from '@/lib/bridge/run-python';
import { readSweepBody } from '@/app/api/pipeline-artifacts/_lib/sweepBody';
import '@/lib/catalog/pipelines/registry.generated';

/**
 * Python-step drain — runs each python-driven step's module on the live editor thread
 * (`/pof/python/run`) and re-grades the artifact with the module's own return.
 *
 * The editor must be RUNNING with the PoF bridge (default http://localhost:30040); with it
 * closed the first step of each entity reports `bridge-error` (its later steps `upstream-failed`, not dispatched) and NOTHING is written — "we could not ask" is
 * not "the step failed". This is the opposite prerequisite to `/drain`, which spawns its own
 * headless editor and therefore needs the editor CLOSED.
 *
 * The module's return is persisted through the one re-grade door (`acceptance/regrade.ts`), and
 * each entity it wrote gets its lifecycle re-derived once after the run.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The editor bridge is a LOCAL process: a caller-supplied `bridgeUrl` is fetched by the server,
 * so only an explicit-port http(s) loopback address is accepted (anything else is an SSRF
 * pivot to an arbitrary host). Returns the reason it was refused, or null when acceptable.
 */
function bridgeUrlProblem(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return 'bridgeUrl is not a valid URL';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'bridgeUrl must be http(s)';
  if (!LOOPBACK_HOSTS.has(u.hostname)) return 'bridgeUrl must be a loopback address (localhost, 127.0.0.1 or [::1])';
  if (!u.port) return 'bridgeUrl must include a port';
  return null;
}

function makeDeps(bridgeUrl?: string): PythonDrainDeps & { flushLifecycle: () => void } {
  const touched = createTouched();
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
      persistRegrade(realArtifactIO, { catalogId, entityId, step }, res, data);
      touched.add(catalogId, entityId);
    },
    flushLifecycle: () => touched.flush(realArtifactIO.syncLifecycle),
  };
}

/**
 * GET — preview WITHOUT touching the bridge: which steps declare a dispatch, which already
 * hold a result, in the order the drain would run them. Answers "what would this do" while
 * the editor is closed.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter = parseSweepFilter(sp);
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
    const denied = requireOperator(req);
    if (denied) return denied;
    const read = await readSweepBody(req);
    if (!read.ok) return read.error;
    const body = read.data as {
      catalogId?: string; entityId?: string; force?: boolean; continueOnFail?: boolean; bridgeUrl?: unknown; apply?: boolean;
    };
    // A flag that is present must be a boolean: `apply: 'false'` used to read as a LIVE apply.
    for (const flag of ['apply', 'force', 'continueOnFail'] as const) {
      if (body[flag] !== undefined && typeof body[flag] !== 'boolean') return apiError(`${flag} must be a boolean`, 400);
    }
    let bridgeUrl: string | undefined;
    if (body.bridgeUrl !== undefined) {
      if (typeof body.bridgeUrl !== 'string') return apiError('bridgeUrl must be a string', 400);
      const problem = bridgeUrlProblem(body.bridgeUrl);
      if (problem) return apiError(problem, 400);
      bridgeUrl = body.bridgeUrl;
    }
    const deps = makeDeps(bridgeUrl);
    const summary = await drainPythonAll(
      parseSweepFilter(body),
      deps,
      { apply: body.apply !== false, force: body.force === true, continueOnFail: body.continueOnFail === true },
    );
    deps.flushLifecycle();
    return apiSuccess(summary);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'drain-python POST failed', 500);
  }
}
