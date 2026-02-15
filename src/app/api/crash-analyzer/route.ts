import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { analyzeAllCrashes, parseCrashLog, analyzeSingleCrash } from '@/lib/crash-analyzer/analysis-engine';

/* ---- GET: run full analysis on sample data ----------------------- */

export async function GET() {
  try {
    const result = analyzeAllCrashes();
    return apiSuccess(result);
  } catch (err) {
    return apiError(`Crash analysis failed: ${err instanceof Error ? err.message : err}`, 500);
  }
}

/* ---- POST: actions ----------------------------------------------- */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    /* -- Import and parse raw crash log ----------------------------- */
    if (action === 'parse-log') {
      const rawText = body.rawText as string;
      if (!rawText) return apiError('rawText is required', 400);

      const report = parseCrashLog(rawText);
      if (!report) return apiError('Could not parse crash log', 400);

      const { report: analyzed, diagnosis } = analyzeSingleCrash(report);
      return apiSuccess({ report: analyzed, diagnosis });
    }

    /* -- Analyze a specific crash by ID ----------------------------- */
    if (action === 'analyze') {
      const crashId = body.crashId as string;
      if (!crashId) return apiError('crashId is required', 400);

      const result = analyzeAllCrashes();
      const report = result.reports.find((r) => r.id === crashId);
      const diagnosis = result.diagnoses.find((d) => d.crashId === crashId);

      if (!report) return apiError('Crash not found', 404);
      return apiSuccess({ report, diagnosis: diagnosis ?? null });
    }

    /* -- Get full analysis ------------------------------------------ */
    if (action === 'full-analysis') {
      const result = analyzeAllCrashes();
      return apiSuccess(result);
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(`Crash analyzer error: ${err instanceof Error ? err.message : err}`, 500);
  }
}
