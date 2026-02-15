import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { computeProjectHealth } from '@/lib/health-engine';
import type { EvaluatorReport } from '@/types/evaluator';

/* ---- POST: compute health from client-side store data ------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const checklistProgress = (body.checklistProgress as Record<string, Record<string, boolean>>) ?? {};
    const scanHistory = (body.scanHistory as EvaluatorReport[]) ?? [];
    const lastScan = (body.lastScan as EvaluatorReport | null) ?? null;

    const summary = computeProjectHealth(checklistProgress, scanHistory, lastScan);
    return apiSuccess(summary);
  } catch (err) {
    return apiError(`Health computation failed: ${err instanceof Error ? err.message : err}`, 500);
  }
}
