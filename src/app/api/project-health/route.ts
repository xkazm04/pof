import { NextRequest } from 'next/server';
import { apiSuccess, apiError, readJsonObject } from '@/lib/api-utils';
import { computeProjectHealth } from '@/lib/health-engine';
import type { EvaluatorReport } from '@/types/evaluator';
import type { PerfHealthInput, CrashHealthInput } from '@/types/project-health';
import type { CompletionLedger } from '@/lib/roadmap/completion-ledger';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Shape check at the boundary: every field is optional, but a present field of the
 * wrong kind is a caller mistake (400 with the field named), not a server fault.
 * Unchecked casts let `scanHistory: "x"` throw inside the engine as a 500 and let
 * `lastScan: 7` or an array body compute a summary out of garbage.
 */
function badField(body: Record<string, unknown>): string | null {
  if (body.checklistProgress != null && !isRecord(body.checklistProgress)) return 'checklistProgress must be an object';
  if (body.scanHistory != null && !Array.isArray(body.scanHistory)) return 'scanHistory must be an array';
  for (const key of ['lastScan', 'perfInput', 'crashInput', 'completionLedger'] as const) {
    if (body[key] != null && !isRecord(body[key])) return `${key} must be an object or null`;
  }
  return null;
}

/* ---- POST: compute health from client-side store data ------------ */

export async function POST(req: NextRequest) {
  const parsedBody = await readJsonObject(req);
  if (!parsedBody.ok) return parsedBody.error;
  const body = parsedBody.data;
  const invalid = badField(body);
  if (invalid) return apiError(invalid, 400);

  try {
    const checklistProgress = (body.checklistProgress as Record<string, Record<string, boolean>>) ?? {};
    const scanHistory = (body.scanHistory as EvaluatorReport[]) ?? [];
    const lastScan = (body.lastScan as EvaluatorReport | null) ?? null;
    const perfInput = (body.perfInput as PerfHealthInput | null) ?? null;
    const crashInput = (body.crashInput as CrashHealthInput | null) ?? null;
    const completionLedger = (body.completionLedger as CompletionLedger | undefined) ?? {};

    // `now` is read once, here at the boundary; the engine itself is pure.
    const summary = computeProjectHealth(
      checklistProgress, scanHistory, lastScan, perfInput, crashInput, completionLedger, Date.now(),
    );
    return apiSuccess(summary);
  } catch (err) {
    return apiError(`Health computation failed: ${err instanceof Error ? err.message : err}`, 500);
  }
}
