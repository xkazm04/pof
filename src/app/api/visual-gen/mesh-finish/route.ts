import { NextRequest } from 'next/server';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { startMeshFinishJob } from '@/lib/visual-gen/mesh-finish-job-store';
import { polycountFor } from '@/lib/visual-gen/polycount-presets';
import type { BakeMap, MirrorAxis } from '@/lib/visual-gen/mesh-finish';

/**
 * POST /api/visual-gen/mesh-finish
 *
 * Retopo → UV → high→low bake a dense generated mesh into a game-tier low-poly, via
 * headless Blender ($0, no cloud credits). Starts a job (poll
 * GET /api/visual-gen/mesh-finish/status?jobId=...).
 *
 * Body: { highPolyPath, outputPath?, assetClass?, targetFaces?, mirror?, cullInterior?,
 *         unwrap?, bake?, bakeSize? }
 *
 * `targetFaces` defaults to the asset class's authored budget (`polycount-presets`),
 * which is stated in TRIANGLES — the same unit the Tier-1 gate measures in, so the
 * finished mesh is graded against the budget it was actually asked for.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      highPolyPath?: string;
      outputPath?: string;
      assetClass?: string;
      targetFaces?: number;
      mirror?: MirrorAxis;
      cullInterior?: boolean;
      unwrap?: boolean;
      bake?: BakeMap[];
      bakeSize?: number;
    };
    const { highPolyPath, assetClass, mirror, cullInterior, unwrap, bake, bakeSize } = body;

    if (!highPolyPath?.trim()) return apiError('highPolyPath is required', 400);
    // Fail on a missing input here rather than letting a Blender run burn minutes to
    // discover it — the runner checks too, but a 400 is the honest answer to the caller.
    if (!existsSync(highPolyPath)) return apiError(`input mesh not found at ${highPolyPath}`, 400);

    // An explicit targetFaces wins; otherwise the class budget; otherwise no retopo
    // (which also disables unwrap/bake inside the runner, and says why).
    const targetFaces = body.targetFaces ?? (assetClass ? polycountFor(assetClass)?.faceLimit : undefined);

    const outputPath = body.outputPath?.trim() || defaultOutputPath(highPolyPath);
    // Blender writes the file but will not create its directory.
    mkdirSync(dirname(outputPath), { recursive: true });

    const jobId = startMeshFinishJob(
      { highPolyPath, outputPath, targetFaces, mirror, cullInterior, unwrap, bake, bakeSize },
      assetClass,
    );
    return apiSuccess({ jobId, outputPath, targetFaces }, 202);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to start mesh-finish job', 500);
  }
}

/** `<name>.glb` → `generated/mesh-finish/<name>_lowpoly_<stamp>.glb`. */
function defaultOutputPath(highPolyPath: string): string {
  const base = (highPolyPath.split(/[\\/]/).pop() ?? 'mesh').replace(/\.[^.]+$/, '');
  const dir = join(process.cwd(), 'generated', 'mesh-finish').replace(/\\/g, '/');
  return join(dir, `${base}_lowpoly_${Date.now()}.glb`).replace(/\\/g, '/');
}
