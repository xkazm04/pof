import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  listCraftVerdicts,
  listCraftVerdictHistory,
  craftHistoryIndex,
  craftVerdictKey,
  upsertCraftVerdict,
  PROCESS_ENTITY,
  PROCESS_STEP,
} from '@/lib/craft/craft-verdicts-db';
import { buildCraftTrend, craftMovementOf, craftTrendSummary } from '@/lib/craft/craftCell';
import { LENS_IDS } from '@/lib/craft/lens-map';
import { listArtifacts } from '@/lib/pipeline-artifacts-db';

/**
 * GET /api/craft-verdicts[?catalogId=] — the A-axis storage layer (craft gauges).
 *
 * Display + routing only: nothing in acceptance or statusModel's grade derivation reads
 * this route or its table, so a craft verdict can never move an R-grade. Staleness is
 * NOT computed here — the client already holds the current artifacts and projects each
 * verdict through `craftOf` (src/lib/status/craft.ts) with both timestamps.
 *
 * Each returned verdict carries its `movement` (A-level change across the kept gauge log)
 * when it has been gauged more than once, joined from ONE extra query for the whole
 * response — the /status map holds ~342 cells and must not pay a request per chip.
 *
 * `?entityId=&step=&history=1` returns that one cell's full trend instead (points +
 * summary), for a detail view that wants every kept point rather than the delta.
 */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const catalogId = q.get('catalogId') ?? undefined;

    if (q.get('history') === '1') {
      const entityId = q.get('entityId');
      const step = q.get('step');
      if (!catalogId || !entityId || !step) {
        return apiError('history requires catalogId, entityId and step', 400);
      }
      const points = listCraftVerdictHistory(catalogId, entityId, step);
      const trend = buildCraftTrend(points);
      return apiSuccess({
        catalogId,
        entityId,
        step,
        history: points,
        trend,
        movement: craftMovementOf(trend) ?? null,
        summary: craftTrendSummary(trend),
      });
    }

    const verdicts = listCraftVerdicts(catalogId);
    const historyByCell = craftHistoryIndex(catalogId);
    return apiSuccess(
      verdicts.map((v) => {
        const kept = historyByCell.get(craftVerdictKey(v.catalogId, v.entityId, v.step)) ?? [];
        const movement = craftMovementOf(buildCraftTrend(kept));
        return movement ? { ...v, movement } : v;
      }),
    );
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'craft-verdicts GET failed', 500);
  }
}

const findingSchema = z.object({
  criterion: z.string().min(1, 'a finding must name the violated lens criterion'),
  detail: z.string().min(10, 'a finding without detail is not auditable'),
  class: z.enum(['content', 'capability', 'ux']),
});

const craftVerdictSchema = z.object({
  catalogId: z.string().min(1),
  entityId: z.string().min(1),
  step: z.string().min(1),
  lens: z.enum(LENS_IDS),
  lensVersion: z.number().int().min(1),
  aLevel: z.enum(['A1', 'A2', 'A3', 'A4']),
  // A1–A3 must explain the gap; a clean A4 may have none.
  findings: z.array(findingSchema),
  model: z.string().min(1),
  effort: z.string().optional(),
});

/**
 * POST /api/craft-verdicts — upsert one craft gauge. Like judge-verdicts there is no
 * server-side re-grade (the auditor IS the gauge; `model` + `findings` make it
 * auditable) — but the route stamps the STALENESS ANCHOR: `artifactUpdatedAt` is read
 * from the newest artifact on record for the same (catalog, entity, step), so every
 * producer binds without opting in and a gauge can never silently outlive the content
 * it gauged. A row with no artifact (the `__process__` scorecard) leaves it NULL —
 * staleness unknown, never fabricated.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = craftVerdictSchema.safeParse(await req.json());
    if (!parsed.success) return apiError('Invalid craft verdict', 400, parsed.error.issues);
    const v = parsed.data;
    if (v.aLevel !== 'A4' && v.findings.length === 0) {
      return apiError('a below-A4 gauge must name at least one finding', 400);
    }
    const isProcess = v.step === PROCESS_STEP || v.entityId === PROCESS_ENTITY;
    if (isProcess && v.lens !== 'production-process') {
      return apiError('the __process__ scorecard row must use the production-process lens', 400);
    }
    if (!isProcess && v.lens === 'production-process') {
      return apiError('production-process gauges the catalog, not a step — use the __process__ row', 400);
    }
    const artifactUpdatedAt = isProcess
      ? undefined
      : listArtifacts(v.catalogId, v.entityId).find((a) => a.step === v.step)?.updatedAt;
    return apiSuccess(
      upsertCraftVerdict({ ...v, ...(artifactUpdatedAt ? { artifactUpdatedAt } : {}) }),
    );
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'craft-verdicts POST failed', 500);
  }
}
