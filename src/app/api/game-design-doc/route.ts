import { NextRequest } from 'next/server';
import { synthesizeGDD, exportGDDAsMarkdown } from '@/lib/gdd-synthesizer';
import { apiSuccess, apiError } from '@/lib/api-utils';

/** GET — generate the GDD from all data sources */
export async function GET(req: NextRequest) {
  try {
    const projectName = req.nextUrl.searchParams.get('projectName') ?? 'Untitled Project';
    const checklistRaw = req.nextUrl.searchParams.get('checklist');

    let checklistProgress: Record<string, Record<string, boolean>> = {};
    if (checklistRaw) {
      try { checklistProgress = JSON.parse(checklistRaw); } catch { /* ignore */ }
    }

    const gdd = synthesizeGDD(projectName, checklistProgress);
    return apiSuccess(gdd);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to generate GDD');
  }
}

/** POST — export the GDD as markdown */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, projectName, checklist } = body;

    if (action === 'export-markdown') {
      const checklistProgress = checklist ?? {};
      const gdd = synthesizeGDD(projectName ?? 'Untitled Project', checklistProgress);
      const markdown = exportGDDAsMarkdown(gdd);
      return apiSuccess({ markdown, title: gdd.title });
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to export GDD');
  }
}
