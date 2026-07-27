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
 *      - action 'authoring-tasks': return the CLI authoring task(s) (`TaskFactory.askClaude`
 *        prompts) that instruct an agent to write the scaffold into the UE tree + compile.
 *
 * **'dispatch' was a lie and is gone.** It returned `{ dispatched: N, tasks }` — but
 * `TaskFactory.askClaude` is a PURE CONSTRUCTOR (`{type, moduleId, prompt, label}`) and the task
 * queue is client-side (`/api/cli-task-registry` only RECORDS tasks a client already started; it
 * cannot start one). No server-side enqueue mechanism exists, so nothing was ever dispatched.
 * The same payload is now returned under `action:'authoring-tasks'` with `enqueued:false` and no
 * dispatch claim; `action:'dispatch'` is refused with an explanation rather than silently
 * renamed, so a caller that believed the old contract learns the truth instead of guessing.
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
      action?: 'scaffold' | 'authoring-tasks' | 'dispatch';
      testName?: string; claim?: string;
      // Same scope surface as the drain (parsed by `parseDrainFilter`), incl. the entity set.
      tier?: string; catalogId?: string; entityId?: string; entityIds?: string[];
    };
    const filter: DrainFilter = parseDrainFilter((k) => body[k]);
    const testName = typeof body.testName === 'string' && body.testName.trim() ? body.testName.trim() : undefined;

    // The removed action, refused loudly — this endpoint never had a way to enqueue anything.
    if (body.action === 'dispatch') {
      return apiError(
        "action 'dispatch' has been removed: nothing server-side can enqueue a CLI task (TaskFactory.askClaude " +
          'only BUILDS a task; the queue is client-side), so it never dispatched anything. ' +
          "Use action:'authoring-tasks' to get the same task prompts and run them yourself.",
        400,
      );
    }

    if (body.action !== 'authoring-tasks') {
      if (testName) return apiSuccess({ scaffold: scaffoldForTest(testName, body.claim) });
      return apiSuccess({ scaffolds: scaffoldAllPlanned(filter) });
    }

    // authoring-tasks: the prompts an agent runs. NOTHING is enqueued and the payload says so.
    const targets: ScaffoldForName[] = testName
      ? [scaffoldForName(testName, filter, body.claim)]
      : scaffoldAllPlanned(filter);
    if (targets.length === 0) return apiError('no planned tests for the given filter', 404);
    const tasks = targets.map((sf) => ({ testName: sf.testName, task: buildScaffoldTask(sf) }));
    return apiSuccess({
      enqueued: false,
      tasks,
      note: `${tasks.length} authoring task prompt(s) built. Nothing was queued or started — run each task's prompt yourself (the app never writes UE files).`,
    });
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
