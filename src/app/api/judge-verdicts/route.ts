import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listVerdicts, upsertVerdict } from '@/lib/status/judge-verdicts-db';

/** GET /api/judge-verdicts[?catalogId=] — the content-quality judgments layer. */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId') ?? undefined;
    return apiSuccess(listVerdicts(catalogId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'judge-verdicts GET failed', 500);
  }
}

const verdictSchema = z.object({
  catalogId: z.string().min(1),
  entityId: z.string().min(1),
  step: z.string().min(1),
  judge: z.enum(['llm-panel', 'vlm', 'human']),
  verdict: z.enum(['pass', 'fail']),
  score: z.number().min(0).max(100),
  findings: z.string().min(10, 'a verdict without findings is not auditable'),
  model: z.string().min(1),
});

/** POST /api/judge-verdicts — upsert one judgment. Unlike pipeline-artifacts there is
 *  no server-side re-grade: the judge IS the grader; `model` + `findings` make it auditable. */
export async function POST(req: NextRequest) {
  try {
    const parsed = verdictSchema.safeParse(await req.json());
    if (!parsed.success) return apiError('Invalid judge verdict', 400, parsed.error.issues);
    return apiSuccess(upsertVerdict(parsed.data));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'judge-verdicts POST failed', 500);
  }
}
