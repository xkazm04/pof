import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { startUeImportJob } from '@/lib/visual-gen/ue-import-job-store';
import { ASSET_CLASS_IDS } from '@/lib/visual-gen/polycount-presets';
import { UE_ASSET_NAME, UE_CONTENT_PATH, type CollisionUse } from '@/lib/visual-gen/ue-import';

const USES: CollisionUse[] = ['blocking', 'decorative', 'character'];
/** Longest an import may wait on the editor; the importer's own default is three minutes. */
const MAX_SETTLE_MS = 1_800_000;

/**
 * POST /api/visual-gen/ue-import
 *
 * Import a generated `.glb` into the UE project as a Static Mesh, WITH collision derived
 * from the mesh itself. Starts a job (the editor launch takes minutes); poll
 * GET /api/visual-gen/ue-import/status?jobId=...
 *
 * This is the last link of the local 3D pipeline, and it was missing entirely: the app
 * generated meshes, finished them, graded them, and stopped at the filesystem. Every UE
 * import until now was a human driving the editor.
 *
 * Body: { glbPath, use, destPath?, assetName?, components?, settleMs?, assetClass?, targetExtentM? }
 *
 * `use` is REQUIRED and has no default. It is the one thing the mesh cannot tell us and
 * the one thing collision depends on: the same geometry wants convex hulls as a crate and
 * no collision at all as a wall decoration. Defaulting it would silently pick one.
 *
 * `components` is an ESCAPE HATCH, not the normal path — the job measures the real shell
 * count with the Tier-1 critic and only falls back to a declared number when the critic
 * could not run. The job reports which basis it used.
 *
 * `assetClass` / `targetExtentM` feed the gate request (`gateRequestFor`) the job critiques
 * through, which is what makes the SCALE derivable: a character has the 1.8 m Mannequin as its
 * nominal, a declared target overrides it, and with neither the plan states that no scale is
 * derivable rather than importing at a silent 1.0. The factor is applied at import and read back.
 */
export async function POST(req: NextRequest) {
  const denied = requireOperator(req);
  if (denied) return denied;

  try {
    const parsed = await readJsonObject(req);
    if (!parsed) return apiError(MALFORMED_BODY_ERROR, 400);
    const body = parsed as {
      glbPath?: string;
      use?: string;
      destPath?: string;
      assetName?: string;
      components?: number;
      settleMs?: number;
      assetClass?: string;
      targetExtentM?: number;
    };

    if (body.glbPath !== undefined && typeof body.glbPath !== 'string') return apiError('glbPath must be a string', 400);
    const glbPath = body.glbPath?.trim();
    if (!glbPath) return apiError('glbPath is required', 400);
    if (!/\.glb$/i.test(glbPath)) {
      return apiError(
        `only .glb is importable by this route (got "${glbPath}") — the executing pipeline writes GLB, and the FBX path has its own Interchange gotcha`,
        400,
      );
    }
    // Fail here rather than after a multi-minute editor launch that can only fail.
    if (!existsSync(glbPath)) return apiError(`no file at ${glbPath}`, 400);

    if (!body.use) {
      return apiError(
        `use is required — one of ${USES.join(', ')}. It decides collision, and no default is safe: a decorative asset wants none, a blocking prop wants hulls.`,
        400,
      );
    }
    if (!USES.includes(body.use as CollisionUse)) {
      return apiError(`use must be one of ${USES.join(', ')} (got "${body.use}")`, 400);
    }

    if (body.components !== undefined && (!Number.isInteger(body.components) || body.components < 1)) {
      return apiError('components, when given, must be a positive integer', 400);
    }

    if (body.targetExtentM !== undefined && !(typeof body.targetExtentM === 'number' && Number.isFinite(body.targetExtentM) && body.targetExtentM > 0)) {
      return apiError('targetExtentM, when given, must be a positive number of metres (the intended longest extent)', 400);
    }
    if (body.assetClass !== undefined && typeof body.assetClass !== 'string') {
      return apiError('assetClass, when given, must be a string', 400);
    }
    // The same rule mesh-finish applies: a typo (`charcter`) must not silently drop the class
    // budget and the scale nominal. An empty string still means "no class", as before.
    if (body.assetClass?.trim() && !(ASSET_CLASS_IDS as readonly string[]).includes(body.assetClass.trim())) {
      return apiError(`assetClass must be one of ${ASSET_CLASS_IDS.join(', ')}`, 400);
    }

    // The importer refuses these too, but only after the job has critiqued the mesh.
    if (body.assetName !== undefined && !(typeof body.assetName === 'string' && UE_ASSET_NAME.test(body.assetName))) {
      return apiError('assetName, when given, may only hold letters, digits, _ and -', 400);
    }
    if (body.destPath !== undefined && !(typeof body.destPath === 'string' && UE_CONTENT_PATH.test(body.destPath))) {
      return apiError('destPath, when given, must be a content path like /Game/Generated', 400);
    }
    if (body.settleMs !== undefined && !(Number.isInteger(body.settleMs) && body.settleMs > 0 && body.settleMs <= MAX_SETTLE_MS)) {
      return apiError(`settleMs, when given, must be a positive integer of at most ${MAX_SETTLE_MS}`, 400);
    }

    const jobId = startUeImportJob({
      glbPath,
      use: body.use as CollisionUse,
      destPath: body.destPath,
      assetName: body.assetName,
      components: body.components,
      settleMs: body.settleMs,
      assetClass: body.assetClass?.trim() || undefined,
      targetExtentM: body.targetExtentM,
    });
    return apiSuccess({ jobId }, 202);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to start ue-import', 500);
  }
}
