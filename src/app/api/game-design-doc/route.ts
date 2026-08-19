import { NextRequest } from 'next/server';
import { synthesizeGDD, exportGDDAsMarkdown, type GDDDocument } from '@/lib/gdd-synthesizer';
import { exportGDDAsPitchHTML } from '@/lib/gdd-pitch';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { normalizeProjectId } from '@/lib/project-id';

type ChecklistProgress = Record<string, Record<string, boolean>>;

function asChecklist(raw: unknown): ChecklistProgress {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as ChecklistProgress) : {};
}

/**
 * The project this synthesis is scoped to, taken EXPLICITLY from the caller —
 * `projectId` or the `projectPath` the rest of the app already passes around (the
 * same value; `normalizeProjectId` folds separators/case). Nothing here infers it:
 * a server-side guess is exactly the silent mis-attribution the scoping exists to
 * remove (the phase-1 house rule, `1f27793f`).
 *
 * Absent ⇒ `''`, the documented global/legacy view. `synthesizeGDD` keeps its reads
 * global in that case AND states it in the document, because since the feature_matrix
 * UNIQUE key became `(project_id, module_id, feature_name)` two projects can hold the
 * same feature — a global synthesis counts it once per project, and a reader who is
 * not told that reads the sum as one project's progress.
 */
function paramProjectId(params: { get(key: string): string | null }): string {
  return normalizeProjectId(params.get('projectId') ?? params.get('projectPath'));
}

function bodyProjectId(body: Record<string, unknown>): string {
  const raw = body.projectId ?? body.projectPath;
  return normalizeProjectId(typeof raw === 'string' ? raw : '');
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
 *
 * `?projectId=` / `?projectPath=` scopes it; a caller that names neither gets the
 * global view, self-declared as such in the document.
 */
export async function GET(req: NextRequest) {
  try {
    const projectName = req.nextUrl.searchParams.get('projectName') ?? 'Untitled Project';
    return apiSuccess(synthesizeGDD(projectName, {}, paramProjectId(req.nextUrl.searchParams)));
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
      const gdd = synthesizeGDD(
        body.projectName ?? 'Untitled Project',
        asChecklist(body.checklist),
        bodyProjectId(body),
      );
      return apiSuccess(gdd);
    }

    if (action === 'export-markdown' || action === 'export-pitch') {
      // No synthesis here by design: re-deriving the document would let an
      // export disagree with what the user is looking at — and it is what keeps
      // the exports on the SAME scope as the view, since the document already
      // carries its scope (prose in the overview + `scope`).
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
