import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { startUeImportJob } from '@/lib/visual-gen/ue-import-job-store';
import type { CollisionUse } from '@/lib/visual-gen/ue-import';

const USES: CollisionUse[] = ['blocking', 'decorative', 'character'];

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
 * Body: { glbPath, use, destPath?, assetName?, components?, settleMs? }
 *
 * `use` is REQUIRED and has no default. It is the one thing the mesh cannot tell us and
 * the one thing collision depends on: the same geometry wants convex hulls as a crate and
 * no collision at all as a wall decoration. Defaulting it would silently pick one.
 *
 * `components` is an ESCAPE HATCH, not the normal path — the job measures the real shell
 * count with the Tier-1 critic and only falls back to a declared number when the critic
 * could not run. The job reports which basis it used.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      glbPath?: string;
      use?: string;
      destPath?: string;
      assetName?: string;
      components?: number;
      settleMs?: number;
    };

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

    const jobId = startUeImportJob({
      glbPath,
      use: body.use as CollisionUse,
      destPath: body.destPath,
      assetName: body.assetName,
      components: body.components,
      settleMs: body.settleMs,
    });
    return apiSuccess({ jobId }, 202);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to start ue-import', 500);
  }
}
