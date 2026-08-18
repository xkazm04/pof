import { NextRequest } from 'next/server';
import { synthesizeGDD, exportGDDAsMarkdown, type GDDDocument } from '@/lib/gdd-synthesizer';
import { exportGDDAsPitchHTML } from '@/lib/gdd-pitch';
import { apiSuccess, apiError } from '@/lib/api-utils';

type ChecklistProgress = Record<string, Record<string, boolean>>;

function asChecklist(raw: unknown): ChecklistProgress {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as ChecklistProgress) : {};
}

/**
 * Shape guard for a client-supplied document. Exports format the instance the
 * view is already holding (so .md / pitch / PDF cannot disagree), which means
 * the payload is untrusted input and must be checked before it reaches the
 * markdown/HTML assemblers.
 */
function isGDDDocument(v: unknown): v is GDDDocument {
  if (!v || typeof v !== 'object') return false;
  const d = v as Partial<GDDDocument>;
  return typeof d.title === 'string'
    && typeof d.generatedAt === 'string'
    && Array.isArray(d.sections)
    && d.sections.every((s) => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.title === 'string')
    && !!d.stats && typeof d.stats === 'object';
}

/**
 * GET — synthesize the GDD with no checklist overlay.
 *
 * Kept for read-only consumers that have no checklist to contribute (the
 * `pof_gdd` MCP tool). The in-app view uses POST `action: 'generate'` instead:
 * a ~300-item checklist does not belong in a query string.
 */
export async function GET(req: NextRequest) {
  try {
    const projectName = req.nextUrl.searchParams.get('projectName') ?? 'Untitled Project';
    return apiSuccess(synthesizeGDD(projectName, {}));
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to generate GDD');
  }
}

/** POST — generate the GDD (checklist in the body), or format an existing one. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'generate') {
      const gdd = synthesizeGDD(body.projectName ?? 'Untitled Project', asChecklist(body.checklist));
      return apiSuccess(gdd);
    }

    if (action === 'export-markdown' || action === 'export-pitch') {
      // No synthesis here by design: re-deriving the document would let an
      // export disagree with what the user is looking at.
      if (!isGDDDocument(body.document)) {
        return apiError('Export requires the generated `document` — regenerate the GDD and retry.', 400);
      }
      const gdd = body.document;
      return action === 'export-markdown'
        ? apiSuccess({ markdown: exportGDDAsMarkdown(gdd), title: gdd.title })
        : apiSuccess({ html: exportGDDAsPitchHTML(gdd), title: gdd.title });
    }

    return apiError(`Unknown action: ${action}`, 400);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to export GDD');
  }
}
