/**
 * POST /api/ability-spec/codegen
 *
 * Callback target for the `generate-gas-effects` CLI task: the agent reports
 * what it wrote / built / seeded in the UE project, and the result is persisted
 * as the spec's codegen provenance so the UI can show confirmed / failed
 * instead of "dispatched…" forever.
 *
 * The body is raw LLM JSON — it is validated field by field and the terminal
 * status is DERIVED from the evidence (`@/lib/ability/codegen-report`), never
 * read from a self-declared success.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseCodegenReport } from '@/lib/ability/codegen-report';
import { setCodegenReport } from '@/lib/ability/ability-spec-db';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  if (typeof body !== 'object' || body === null) {
    return apiError('Body must be a JSON object', 400);
  }

  // catalogId/entityId arrive as callback staticFields (server-controlled), but
  // they are still checked — the route is a public POST endpoint.
  const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
  const entityId = typeof body.entityId === 'string' ? body.entityId : '';
  if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);

  const parsed = parseCodegenReport(body);
  if (!parsed.ok) return apiError(`Invalid codegen report: ${parsed.error}`, 400);

  try {
    return apiSuccess(setCodegenReport(catalogId, entityId, parsed.data));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Codegen report POST failed', 500);
  }
}
