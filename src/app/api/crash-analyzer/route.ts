import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  analyzeAllCrashes,
  analyzeReports,
  parseCrashLog,
  analyzeSingleCrash,
} from '@/lib/crash-analyzer/analysis-engine';
import { SAMPLE_CRASHES } from '@/lib/crash-analyzer/sample-crashes';
import { listCrashHistory, recordCrashSighting } from '@/lib/crash-history-db';
import type { CrashAnalyzerResult } from '@/types/crash-analyzer';

/**
 * The analyzer's crash set: the eight built-in demo crashes PLUS every crash
 * actually observed in this project.
 *
 * The persisted half is what makes an import survive a reload — the view calls
 * this on mount, and before crash history existed the answer was always the same
 * eight samples, silently discarding everything the operator had imported.
 *
 * With no history the memoized sample-only analysis is returned unchanged, so
 * the common path costs exactly what it used to.
 */
function fullAnalysis(): CrashAnalyzerResult {
  const history = listCrashHistory();
  if (history.length === 0) return analyzeAllCrashes();
  return analyzeReports([...SAMPLE_CRASHES, ...history.map((h) => h.report)]);
}

/* ---- GET: samples + persisted crash history ---------------------- */

export async function GET() {
  try {
    return apiSuccess(fullAnalysis());
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

      // Persist the sighting BEFORE answering, and answer with the STORED record
      // rather than the in-memory one. Two reasons: on a repeat the row keeps the
      // ORIGINAL crash id and the accumulated counters, so the client updates the
      // existing entry instead of stacking a second copy of the same crash; and
      // what the operator sees immediately after an import is then exactly what
      // they will see after a reload, bounds included.
      const sighting = recordCrashSighting(analyzed);
      const persisted = sighting.report;

      // The diagnosis was resolved for the freshly-minted id; re-point it at the
      // id the crash is actually stored under so the client can still find it.
      const boundDiagnosis = diagnosis ? { ...diagnosis, crashId: persisted.id } : null;

      return apiSuccess({
        report: persisted,
        diagnosis: boundDiagnosis,
        seenBefore: sighting.history.occurrences > 1,
      });
    }

    /* -- Analyze a specific crash by ID ----------------------------- */
    if (action === 'analyze') {
      const crashId = body.crashId as string;
      if (!crashId) return apiError('crashId is required', 400);

      const result = fullAnalysis();
      const report = result.reports.find((r) => r.id === crashId);
      const diagnosis = result.diagnoses.find((d) => d.crashId === crashId);

      if (!report) return apiError('Crash not found', 404);
      return apiSuccess({ report, diagnosis: diagnosis ?? null });
    }

    /* -- Get full analysis ------------------------------------------ */
    if (action === 'full-analysis') {
      return apiSuccess(fullAnalysis());
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(`Crash analyzer error: ${err instanceof Error ? err.message : err}`, 500);
  }
}
