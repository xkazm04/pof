import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { computeProjectHealth } from '@/lib/health-engine';
import type { EvaluatorReport } from '@/types/evaluator';
import type { PerfHealthInput, CrashHealthInput } from '@/types/project-health';
import type { CompletionLedger } from '@/lib/roadmap/completion-ledger';

/* ---- POST: compute health from client-side store data ------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
