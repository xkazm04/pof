import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listVerdictHistory, type JudgeVerdict } from '@/lib/status/judge-verdicts-db';

const JUDGES: JudgeVerdict['judge'][] = ['llm-panel', 'vlm', 'human'];

/**
 * GET /api/judge-verdicts/history?catalogId=&entityId=&step=[&judge=]
 *
 * The kept judgments for ONE step, oldest first — the evidence behind "did my fix actually
 * improve this?". Before the append-only log existed a re-judge overwrote the previous verdict,
 * so this question could not be answered from the data at all.
 *
 * READ-ONLY and grading-free: the current verdict still lives in `judge_verdicts` (one row per
 * judge class) and only that row reaches `bridgeJudgeVerdict`. Retention is bounded to the newest
 * `VERDICT_HISTORY_LIMIT` judgments per (catalog, entity, step, judge).
 */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const catalogId = p.get('catalogId');
    const entityId = p.get('entityId');
    const step = p.get('step');
    if (!catalogId || !entityId || !step) {
      return apiError('catalogId, entityId and step are required', 400);
    }
    const judgeParam = p.get('judge');
    if (judgeParam && !JUDGES.includes(judgeParam as JudgeVerdict['judge'])) {
      return apiError(`unknown judge "${judgeParam}" (expected one of ${JUDGES.join(', ')})`, 400);
    }
    return apiSuccess(listVerdictHistory(catalogId, entityId, step, (judgeParam as JudgeVerdict['judge']) ?? undefined));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'judge-verdict history GET failed', 500);
  }
}
