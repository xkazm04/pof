import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listArtifacts, upsertArtifact, deleteArtifact } from '@/lib/pipeline-artifacts-db';
import { artifactUpsertSchema } from '@/lib/catalog/artifact-validation';
import { gradeArtifact } from '@/lib/catalog/headless';
import { stampPromptVersion } from '@/lib/prompt-evolution/judge-fitness';

/** GET /api/pipeline-artifacts?catalogId=items[&entityId=item-1] → PipelineArtifact[] */
export async function GET(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId') ?? undefined;
    if (!catalogId) return apiError('catalogId is required', 400);
    return apiSuccess(listArtifacts(catalogId, entityId));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Artifacts GET failed', 500);
  }
}

/**
 * POST /api/pipeline-artifacts — the produce @@CALLBACK target. Upserts one step's artifact.
 *
 * Truth rule: when the step belongs to a registered pipeline, the SERVER re-grades the
 * submitted `data` with the step's own Checker and the caller's `status` is discarded —
 * a client can never persist a fabricated `pass` (nor an optimistic `?? 'pass'` default)
 * for a step the server can verify. A registered checker that fails to resolve degrades to
 * `pending`, never `pass`. Only catalogs with no server checker (bespoke Items specs, the
 * synthetic loot-filter catalog) keep the caller-supplied status. This matches the headless
 * MCP path (`submitStepArtifact`), so both write paths grade identically.
 *
 * The PERSISTED status is the PURE checker verdict (`graded.raw`), NOT the judge-bridged one —
 * the artifact row holds the checker's own truth and judge state lives apart in
 * `judge_verdicts` (bridged only on read). Persisting the bridge here would diverge from the
 * MCP path and skew `summarizeEntity`/rollups, which count straight off `art.status`.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = artifactUpsertSchema.safeParse(await req.json());
    if (!parsed.success) return apiError('Invalid artifact payload', 400, parsed.error.issues);
    const p = parsed.data;

    // Grade the SUBMITTED data, untouched — the provenance stamp is added only to what we
    // persist, so acceptance can never shift because of it (the additive-key pattern).
    const { graded, raw } = gradeArtifact(p.catalogId, p.step, p.data, p.entityId);
    const status = graded ? (raw?.status ?? 'pending') : p.status;
    const tier = graded ? (raw?.tier ?? 'L0') : p.tier;
    const reason = graded
      ? (raw?.reason ?? (raw ? undefined : 'unverified: acceptance check did not resolve'))
      : p.reason;

    return apiSuccess(upsertArtifact({
      catalogId: p.catalogId,
      entityId: p.entityId,
      step: p.step,
      data: stampPromptVersion(p.data, p.promptVersion),
      ueAssets: p.ueAssets,
      status,
      tier,
      reason,
    }));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Artifacts POST failed', 500);
  }
}

/**
 * DELETE /api/pipeline-artifacts?catalogId=items&entityId=item-1[&step=Economy]
 *
 * Destructive, operator-triggered: removes an entity's persisted artifacts (one step
 * when `step` is given, otherwise every step of that entity). It exists because the
 * lab's "Reset" used to clear LOCAL state only — and add-only hydration then re-hydrated
 * the server rows on the next load, silently un-doing the reset. `entityId` is required,
 * so there is no whole-catalog wipe surface here.
 *
 * Returns `{ deleted: n }` — the number of rows actually removed.
 */
export async function DELETE(req: NextRequest) {
  try {
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const entityId = req.nextUrl.searchParams.get('entityId');
    const step = req.nextUrl.searchParams.get('step');
    if (!catalogId || !entityId) return apiError('catalogId and entityId are required', 400);

    const targets = step ? [step] : listArtifacts(catalogId, entityId).map((a) => a.step);
    for (const s of targets) deleteArtifact(catalogId, entityId, s);
    return apiSuccess({ deleted: targets.length });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Artifacts DELETE failed', 500);
  }
}
