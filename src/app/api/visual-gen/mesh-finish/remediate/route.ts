import { NextRequest } from 'next/server';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { startMeshFinishJob } from '@/lib/visual-gen/mesh-finish-job-store';
import { planFinishFromCritique } from '@/lib/visual-gen/finish-routing';
import { critiqueMesh } from '@/lib/visual-gen/mesh-critique';
import { localCritiqueDeps } from '@/lib/visual-gen/polycount-presets';
import { safeAssetDir, safeAssetName } from '@/lib/visual-gen/generated-assets';
import { assessStage } from '@/lib/visual-gen/critique-stage';

/**
 * POST /api/visual-gen/mesh-finish/remediate
 *
 * The critique → mesh-finish edge. Grades a generated mesh at stage `raw`, and — only if
 * the resulting FAIL is one the retopo/decimate stage can actually resolve — routes it
 * into a finish job whose output is re-graded at stage `finished`. Poll
 * `GET /api/visual-gen/mesh-finish/status?jobId=...` for the before → after.
 *
 * Body: `{ name, dir?, assetClass? }` — `name` is a BASENAME inside `generated/<dir>/`,
 * not a path. Unlike `POST /api/visual-gen/mesh-finish`, which takes an arbitrary
 * `highPolyPath`/`outputPath`, nothing here can name a file outside the `ASSET_DIRS`
 * allow-list in either direction.
 *
 * Every refusal is a 200 with `routed: false` and the reason, because "we did not run
 * Blender, and here is why" is a real answer — most notably the measured one: decimation
 * does not remove floater specks and has been observed to multiply them, so a
 * floater-only failure is refused rather than run.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; dir?: string; assetClass?: string };

    const name = safeAssetName((body.name ?? '').trim());
    if (!name) return apiError('name must be a safe generated-asset basename (e.g. "jinx_hd.glb")', 400);
    const dir = safeAssetDir(body.dir);
    if (!dir) return apiError(`dir "${body.dir}" is not a servable generated dir`, 400);

    const meshPath = join(process.cwd(), 'generated', dir.dir, name).replace(/\\/g, '/');
    if (!existsSync(meshPath)) return apiError(`mesh not found at generated/${dir.dir}/${name}`, 404);

    // Grade the INPUT as what it is: pre-finish geometry.
    const { deps, gradedAs } = localCritiqueDeps(body.assetClass);
    const before = await critiqueMesh(meshPath, { ...deps, stage: 'raw' });
    const assessment = assessStage(before, 'raw');

    const plan = planFinishFromCritique({
      meshName: name,
      meshDir: dir.dir,
      critique: before,
      assetClass: body.assetClass,
      stage: 'raw',
    });

    if (!plan.ok) {
      return apiSuccess({
        routed: false,
        reason: plan.reason,
        gradedAs,
        before: projectVerdict(before),
        caveat: assessment.caveat,
      });
    }

    mkdirSync(dirname(plan.spec.outputPath), { recursive: true });
    const jobId = startMeshFinishJob(plan.spec, body.assetClass, undefined, undefined, {
      before,
      planNote: plan.note,
    });

    return apiSuccess(
      {
        routed: true,
        jobId,
        gradedAs,
        before: projectVerdict(before),
        addresses: plan.addresses,
        unaddressed: plan.unaddressed,
        note: plan.note,
        caveat: assessment.caveat,
        outputPath: plan.spec.outputPath,
        targetFaces: plan.spec.targetFaces,
      },
      202,
    );
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to route mesh into finish', 500);
  }
}

function projectVerdict(c: Awaited<ReturnType<typeof critiqueMesh>>) {
  if (c.unavailable) return { graded: false, reason: c.error ?? 'the critic could not run' };
  if (!c.ok || c.verdict === undefined) return { graded: false, reason: c.error ?? 'no verdict' };
  return {
    graded: true,
    verdict: c.verdict,
    score: c.score ?? 0,
    reasons: c.reasons ?? [],
    failCodes: (c.findings ?? []).filter((f) => f.severity === 'fail').map((f) => f.code),
  };
}
