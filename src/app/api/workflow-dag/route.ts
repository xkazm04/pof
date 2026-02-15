import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { WORKFLOW_TEMPLATES, hydrateTemplate } from '@/lib/workflow-templates';
import { validateWorkflow } from '@/lib/task-dag-orchestrator';
import type { WorkflowDefinition } from '@/types/task-dag';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const action = searchParams.get('action');

    if (action === 'templates') {
      return apiSuccess({ templates: WORKFLOW_TEMPLATES });
    }

    if (action === 'hydrate') {
      const templateId = searchParams.get('templateId');
      const modules = searchParams.get('modules')?.split(',').filter(Boolean) ?? [];

      if (!templateId) return apiError('templateId required', 400);
      if (modules.length === 0) return apiError('modules required (comma-separated)', 400);

      const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return apiError(`Template "${templateId}" not found`, 404);

      const hydrated = hydrateTemplate(template, modules);
      const workflow: WorkflowDefinition = {
        ...hydrated,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const errors = validateWorkflow(workflow);
      return apiSuccess({ workflow, validationErrors: errors });
    }

    return apiSuccess({ templates: WORKFLOW_TEMPLATES });
  } catch (err) {
    return apiError(`Failed: ${err instanceof Error ? err.message : err}`, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'validate') {
      const workflow = body.workflow as WorkflowDefinition;
      if (!workflow) return apiError('workflow required', 400);
      const errors = validateWorkflow(workflow);
      return apiSuccess({ valid: errors.length === 0, errors });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(`Failed: ${err instanceof Error ? err.message : err}`, 500);
  }
}
