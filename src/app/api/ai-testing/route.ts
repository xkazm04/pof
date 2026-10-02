import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getAllSuites,
  getSuite,
  createSuite,
  updateSuite,
  deleteSuite,
  createScenario,
  updateScenario,
  deleteScenario,
  bulkUpdateScenarioStatus,
  recordRunVerdicts,
  getTestingSummary,
} from '@/lib/ai-testing-db';
import type { ScenarioStatus } from '@/types/ai-testing';
import { isAiTestReportDir, isAiTestRunId } from '@/lib/ai-testing/test-identity';
import { deriveRunVerdicts } from '@/lib/ai-testing/run-verdict';
import { readReport } from '@/lib/test-gate-runner/batchAutomation';

const SCENARIO_STATUSES: ReadonlySet<ScenarioStatus> = new Set([
  'draft', 'ready', 'running', 'passed', 'failed', 'error',
]);

// GET /api/ai-testing
// ?suiteId=<number> → single suite
// (no params) → all suites + summary
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const suiteId = searchParams.get('suiteId');

    if (suiteId) {
      const suite = getSuite(Number(suiteId));
      if (!suite) return apiError('Not found', 404);
      return apiSuccess({ suite });
    }

    const suites = getAllSuites();
    const summary = getTestingSummary();
    return apiSuccess({ suites, summary });
  } catch (err) {
    console.error('GET /api/ai-testing error:', err);
    return apiError('Internal error', 500);
  }
}

// POST /api/ai-testing
// Body: { action: 'create-suite' | 'create-scenario', ...payload }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'create-suite') {
      if (!body.name) return apiError('name is required', 400);
      const suite = createSuite({
        name: body.name,
        description: body.description ?? '',
        targetClass: body.targetClass ?? '',
      });
      return apiSuccess({ suite }, 201);
    }

    if (action === 'create-scenario') {
      if (!body.suiteId || !body.name) {
        return apiError('suiteId and name are required', 400);
      }
      const scenario = createScenario({
        suiteId: body.suiteId,
        name: body.name,
        description: body.description ?? '',
        stimuli: body.stimuli,
        expectedActions: body.expectedActions,
      });
      if (!scenario) return apiError('Suite not found', 404);
      return apiSuccess({ scenario }, 201);
    }

    // Run write-back (@@CALLBACK from the run-ai-tests task, or the view closing
    // a run whose callback never landed). Every dispatched scenario is graded
    // from UE's automation report in the app-chosen reportDir — the CLI's
    // per-scenario claim is kept only as a note in Last Run Output.
    if (action === 'record-run-results') {
      if (!Array.isArray(body.results)) return apiError('results array is required', 400);
      if (!isAiTestRunId(body.runId)) return apiError('valid runId is required', 400);
      // Policy: the server reads only index.json under <project>/Saved/Automation/PoF-AITests/<runId>.
      if (!isAiTestReportDir(body.reportDir, body.runId)) {
        return apiError('reportDir must be <project>/Saved/Automation/PoF-AITests/<runId> (no "..")', 400);
      }
      const scenarioIds: number[] = Array.isArray(body.scenarioIds) ? [...new Set<number>(body.scenarioIds.map(Number))] : [];
      if (scenarioIds.length === 0 || !scenarioIds.every(Number.isInteger)) {
        return apiError('scenarioIds array is required', 400);
      }
      const suite = getAllSuites().find((s) => s.scenarios.some((sc) => sc.id === scenarioIds[0]));
      const inSuite = new Set(suite?.scenarios.map((sc) => sc.id));
      if (!suite || !scenarioIds.every((id) => inSuite.has(id))) {
        return apiError('scenarioIds must belong to one suite', 400);
      }
      const report = await readReport(body.reportDir);
      // One door: status + last-run fields AND the run-history row keyed by runId.
      const verdicts = deriveRunVerdicts(report, scenarioIds, body.results, suite);
      const updated = recordRunVerdicts(body.runId, new Date().toISOString(), verdicts);
      return apiSuccess({ updated });
    }

    // CLI stimuli write-back (@@CALLBACK from the detect-stimuli task):
    // merge auto-detected stimuli/expectedActions into the scenario.
    if (action === 'apply-stimuli') {
      const scenarioId = Number(body.scenarioId);
      if (!Number.isInteger(scenarioId)) return apiError('scenarioId is required', 400);
      if (!Array.isArray(body.stimuli) && !Array.isArray(body.expectedActions)) {
        return apiError('stimuli or expectedActions array is required', 400);
      }
      const scenario = updateScenario({
        id: scenarioId,
        ...(Array.isArray(body.stimuli) ? { stimuli: body.stimuli } : {}),
        ...(Array.isArray(body.expectedActions) ? { expectedActions: body.expectedActions } : {}),
      });
      if (!scenario) return apiError('Not found', 404);
      return apiSuccess({ scenario });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    console.error('POST /api/ai-testing error:', err);
    return apiError('Internal error', 500);
  }
}

// PUT /api/ai-testing
// Body: { action: 'update-suite' | 'update-scenario', ...payload }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'update-suite') {
      if (!body.id) return apiError('id is required', 400);
      const suite = updateSuite(body);
      if (!suite) return apiError('Not found', 404);
      return apiSuccess({ suite });
    }

    if (action === 'update-scenario') {
      if (!body.id) return apiError('id is required', 400);
      const scenario = updateScenario(body);
      if (!scenario) return apiError('Not found', 404);
      return apiSuccess({ scenario });
    }

    // Bulk single-status transition for many scenarios in one transaction —
    // used by Run Tests ("mark all running") and the CLI-died failure reset
    // so one logical state change is one PUT + one refetch instead of N.
    if (action === 'bulk-status') {
      if (!Array.isArray(body.ids)) return apiError('ids array is required', 400);
      if (!SCENARIO_STATUSES.has(body.status)) return apiError('valid status is required', 400);
      const ids = body.ids.map((x: unknown) => Number(x));
      const updated = bulkUpdateScenarioStatus(ids, body.status, {
        ...(typeof body.lastRunOutput === 'string' ? { lastRunOutput: body.lastRunOutput } : {}),
        ...(body.lastRunAt !== undefined ? { lastRunAt: body.lastRunAt } : {}),
      });
      return apiSuccess({ updated });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    console.error('PUT /api/ai-testing error:', err);
    return apiError('Internal error', 500);
  }
}

// DELETE /api/ai-testing?type=suite&id=<number>
// DELETE /api/ai-testing?type=scenario&id=<number>
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return apiError('type and id are required', 400);
    }

    if (type === 'suite') {
      const deleted = deleteSuite(Number(id));
      if (!deleted) return apiError('Not found', 404);
      return apiSuccess({ ok: true });
    }

    if (type === 'scenario') {
      const deleted = deleteScenario(Number(id));
      if (!deleted) return apiError('Not found', 404);
      return apiSuccess({ ok: true });
    }

    return apiError('Unknown type', 400);
  } catch (err) {
    console.error('DELETE /api/ai-testing error:', err);
    return apiError('Internal error', 500);
  }
}
