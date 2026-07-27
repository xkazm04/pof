import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listArtifacts } from '@/lib/pipeline-artifacts-db';
import { buildEvidenceAudit, type EvidenceAuditFilter } from '@/lib/test-gate-runner/evidenceAudit';

/**
 * GET /api/pipeline-artifacts/drain/evidence?catalogId=items[&entityId=&step=&tier=L3]
 * → `{ rows, missing }` — the PROOF behind every drained L3/L4 verdict in scope.
 *
 * This is the reader for the evidence `drainOne` persists into `data.evidence`. A judge (or
 * the /status audit) can see WHICH abslog markers matched, the observed scenario stats, and
 * the frame a visual verdict was judged from — auditing a flip without re-running the gate,
 * and seeing which gate verdicts carry no proof at all (`missing`).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const catalogId = sp.get('catalogId');
    if (!catalogId) return apiError('catalogId is required', 400);
    const entityId = sp.get('entityId') ?? undefined;
    const tier = sp.get('tier');
    const filter: EvidenceAuditFilter = {
      ...(entityId ? { entityId } : {}),
      ...(sp.get('step') ? { step: sp.get('step')! } : {}),
      ...(tier === 'L3' || tier === 'L4' ? { tier } : {}),
      ...(sp.get('includeSynthetic') === 'true' ? { includeSynthetic: true } : {}),
    };
    return apiSuccess(buildEvidenceAudit(listArtifacts(catalogId, entityId), filter));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'gate evidence GET failed', 500);
  }
}
