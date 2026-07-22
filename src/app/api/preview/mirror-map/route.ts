import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import stepFactsJson from '@/lib/status/step-facts.json';
import {
  mirrorSupport,
  isPreviewHydratable,
  PREVIEW_HYDRATABLE_CATALOGS,
} from '@/lib/preview/browser-mirror';

/**
 * GET /api/preview/mirror-map[?catalogId=] — the dual-execution capability map for
 * headless consumers (pof-mcp): which step classes can also run in the browser
 * preview, and which catalogs the preview runtime hydrates today. Derived purely
 * from the audited step-facts + browser-mirror lib, so app UI, /status, and MCP
 * all answer identically. Spec: docs/research/dual-execution-preview-spec.md
 */

interface AuditedStep {
  catalogId: string;
  step: string;
  deliverable: string;
}

export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId') ?? undefined;
    const steps = (stepFactsJson as { steps: AuditedStep[] }).steps
      .filter((s) => !catalogId || s.catalogId === catalogId)
      .map((s) => ({
        catalogId: s.catalogId,
        step: s.step,
        deliverable: s.deliverable,
        browserMirror: mirrorSupport(s.deliverable, s.step),
      }));
    if (catalogId && steps.length === 0) {
      return apiError(`no audited steps for catalog "${catalogId}"`, 404);
    }
    return apiSuccess({
      hydratableCatalogs: PREVIEW_HYDRATABLE_CATALOGS,
      ...(catalogId ? { catalogId, hydratable: isPreviewHydratable(catalogId) } : {}),
      steps,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Mirror map failed', 500);
  }
}
