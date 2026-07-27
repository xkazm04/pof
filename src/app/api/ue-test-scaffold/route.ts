import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseDrainFilter, type DrainFilter } from '@/lib/test-gate-runner';
import {
  listPlannedTests,
  scaffoldAllPlanned,
  scaffoldForTest,
  buildScaffoldTask,
  type ScaffoldForName,
} from '@/lib/ue-test-scaffold';

/**
 * VS-test scaffolder API.
 *
 * GET  /api/ue-test-scaffold[?tier=&catalogId=&entityId=]
 *      → the planned-but-unmatched UE tests (deferred L3 gates with a recovered test name), each
 *        flagged `scaffoldAvailable`.
 *
 * POST /api/ue-test-scaffold  body: { action?, testName?, claim?, tier?, catalogId?, entityId? }
 *      - action 'scaffold' (default): generate C++ scaffold text. `testName` → one; else all
 *        planned (de-duped by name) for the filter.
 *      - action 'dispatch': build CLI authoring task(s) (TaskFactory.askClaude) instructing the
 *        agent to write the scaffold into the UE tree + compile. The app never writes UE files.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter = parseDrainFilter((k) => sp.get(k));
    return apiSuccess(listPlannedTests(filter));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'ue-test-scaffold GET failed', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: 'scaffold' | 'dispatch';
      testName?: string; claim?: string;
      // Same scope surface as the drain (parsed by `parseDrainFilter`), incl. the entity set.
      tier?: string; catalogId?: string; entityId?: string; entityIds?: string[];
    };
    const filter: DrainFilter = parseDrainFilter((k) => body[k]);
    const action = body.action === 'dispatch' ? 'dispatch' : 'scaffold';
    const testName = typeof body.testName === 'string' && body.testName.trim() ? body.testName.trim() : undefined;

    if (action === 'scaffold') {
      if (testName) return apiSuccess({ scaffold: scaffoldForTest(testName, body.claim) });
      return apiSuccess({ scaffolds: scaffoldAllPlanned(filter) });
    }

    // dispatch
    const targets: ScaffoldForName[] = testName
      ? [scaffoldForName(testName, filter, body.claim)]
      : scaffoldAllPlanned(filter);
    if (targets.length === 0) return apiError('no planned tests to dispatch for the given filter', 404);
    const tasks = targets.map((sf) => ({ testName: sf.testName, task: buildScaffoldTask(sf) }));
    return apiSuccess({ dispatched: tasks.length, tasks });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'ue-test-scaffold POST failed', 500);
  }
}

/** Build a ScaffoldForName for an explicit test name, gathering any deferred gates requesting it. */
function scaffoldForName(testName: string, filter: DrainFilter, claim?: string): ScaffoldForName {
  const requestedBy = listPlannedTests(filter)
    .filter((p) => p.testName === testName)
    .map((p) => ({ catalogId: p.catalogId, entityId: p.entityId, step: p.step }));
  return { testName, scaffold: scaffoldForTest(testName, claim), requestedBy };
}
