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
  getTestingSummary,
} from '@/lib/ai-testing-db';

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
