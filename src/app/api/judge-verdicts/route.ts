import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listVerdicts, upsertVerdict } from '@/lib/status/judge-verdicts-db';
import { listArtifacts } from '@/lib/pipeline-artifacts-db';
import { stepContentHash } from '@/lib/judge/contentHash';

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
  effort: z.string().optional(),
  rubricVersion: z.number().int().optional(),
  /** Per-dimension 0-100 craft scores (WS2). Additive — old clients omit it. */
  dimensions: z.record(z.string(), z.number().min(0).max(100)).optional(),
  /** Fingerprint of the content judged. Optional: when the producer doesn't supply one the
   *  route derives it from the artifact on record (below), so every writer binds. */
  contentHash: z.string().optional(),
});

/**
 * POST /api/judge-verdicts — upsert one judgment. Unlike pipeline-artifacts there is no
 * server-side re-grade: the judge IS the grader; `model` + `findings` make it auditable.
 *
 * The route DOES stamp the verdict's content binding: `contentHash` is derived here from the
 * artifact on record for the same (catalog, entity, step) unless the producer supplied one.
 * Binding at the single write seam means every producer — `scripts/judge-run.ts`, the gap-loop
 * scripts, anything future — is bound without opting in, and a verdict can never again outlive
 * the content it judged. A step with no artifact yet leaves the hash NULL (unknown provenance,
 * never a fabricated binding).
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = verdictSchema.safeParse(await req.json());
    if (!parsed.success) return apiError('Invalid judge verdict', 400, parsed.error.issues);
    const v = parsed.data;
    const contentHash = v.contentHash ?? (() => {
      const art = listArtifacts(v.catalogId, v.entityId).find((a) => a.step === v.step);
      return art ? stepContentHash(art.data) : undefined;
    })();
    return apiSuccess(upsertVerdict({ ...v, ...(contentHash ? { contentHash } : {}) }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'judge-verdicts POST failed', 500);
  }
}
