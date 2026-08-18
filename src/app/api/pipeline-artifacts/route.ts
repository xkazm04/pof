import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { listArtifacts, upsertArtifact, deleteArtifact } from '@/lib/pipeline-artifacts-db';
import { artifactUpsertSchema } from '@/lib/catalog/artifact-validation';
import { gradeArtifact, hasRegisteredChecker } from '@/lib/catalog/headless';
import { describeUngraded } from '@/lib/catalog/acceptance/stepGradability';
import { stampPromptVersion } from '@/lib/prompt-evolution/judge-fitness';

/** Max issues named in the error string — enough to fix the payload, short enough to render. */
const MAX_REPORTED_ISSUES = 5;

/**
 * Turn zod issues into ONE human-readable sentence naming the offending fields, so the
 * reason survives the `{ success:false, error }` envelope all the way to the operator.
 */
function describeInvalidPayload(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): string {
  const named = issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
  const more = issues.length > MAX_REPORTED_ISSUES ? ` (+${issues.length - MAX_REPORTED_ISSUES} more)` : '';
  return `Invalid artifact payload — ${named.join('; ')}${more}`;
}

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
 * `pending`, never `pass`. Only steps with no server checker at all (the synthetic loot-filter
 * catalog) keep the caller-supplied status — and those rows are stamped with an explicit
 * `UNGRADED:` reason naming why nothing could grade them, so a preserved producer status can
 * never be mistaken for a verified one. This matches the headless MCP path
 * (`submitStepArtifact`), so both write paths grade identically.
 *
 * The PERSISTED status is the PURE checker verdict (`graded.raw`), NOT the judge-bridged one —
 * the artifact row holds the checker's own truth and judge state lives apart in
 * `judge_verdicts` (bridged only on read). Persisting the bridge here would diverge from the
 * MCP path and skew `summarizeEntity`/rollups, which count straight off `art.status`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const parsed = artifactUpsertSchema.safeParse(body);
    // The validation DETAIL goes in the `error` STRING, not only in `details`: the standard
    // client (`tryApiFetch`) surfaces `error` and drops `details`, so a payload rejection
    // used to reach the operator as a bare "Invalid artifact payload" with no way to tell
    // WHICH field was wrong. `details` is kept for machine consumers.
    if (!parsed.success) return apiError(describeInvalidPayload(parsed.error.issues), 400, parsed.error.issues);
    const p = parsed.data;
    // The prompt-evolution variant this run was served, read off the RAW body: it is an
    // additive provenance stamp (like `promptVersion`), not part of what gets graded, and
    // the upsert schema is owned by the catalog contract. Absent / `'static'` → nothing is
    // stamped, so an artifact can never claim an experiment that did not run. A producer
    // may equally pass it inside `data._provenance` — the stamp preserves that.
    const promptVariantId =
      typeof body === 'object' && body !== null && typeof (body as { promptVariantId?: unknown }).promptVariantId === 'string'
        ? (body as { promptVariantId: string }).promptVariantId
        : undefined;

    // Grade the SUBMITTED data, untouched — the provenance stamp is added only to what we
    // persist, so acceptance can never shift because of it (the additive-key pattern).
    const { graded, raw } = gradeArtifact(p.catalogId, p.step, p.data, p.entityId);
    const status = graded ? (raw?.status ?? 'pending') : p.status;
    const tier = graded ? (raw?.tier ?? 'L0') : p.tier;
    // An UNGRADED row is a finding, not a quiet pass. The producer's status is preserved
    // (there is nothing truer to replace it with), but the persisted `reason` now SAYS the
    // server never verified it — and names why no checker resolved. Silently keeping a
    // producer's `pass` with no annotation is what re-opens the fabricated-pass hole.
    const reason = graded
      ? (raw?.reason ?? (raw ? undefined : 'unverified: acceptance check did not resolve'))
      : describeUngraded(p.catalogId, p.step, hasRegisteredChecker, p.reason);

    return apiSuccess(upsertArtifact({
      catalogId: p.catalogId,
      entityId: p.entityId,
      step: p.step,
      data: stampPromptVersion(p.data, p.promptVersion, promptVariantId),
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
