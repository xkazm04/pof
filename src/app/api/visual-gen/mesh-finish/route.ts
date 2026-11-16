import { NextRequest } from 'next/server';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { startMeshFinishJob } from '@/lib/visual-gen/mesh-finish-job-store';
import { ASSET_CLASS_IDS, polycountFor } from '@/lib/visual-gen/polycount-presets';
import type { BakeMap, MirrorAxis } from '@/lib/visual-gen/mesh-finish';

/**
 * POST /api/visual-gen/mesh-finish
 *
 * Retopo → UV → high→low bake a dense generated mesh into a game-tier low-poly, via
 * headless Blender ($0, no cloud credits). Starts a job (poll
 * GET /api/visual-gen/mesh-finish/status?jobId=...).
 *
 * Body: { highPolyPath, outputPath?, assetClass?, targetFaces?, mirror?,
 *         unwrap?, bake?, bakeSize? }
 *
 * `targetFaces` defaults to the asset class's authored budget (`polycount-presets`),
 * which is stated in TRIANGLES — the same unit the Tier-1 gate measures in, so the
 * finished mesh is graded against the budget it was actually asked for.
 *
 * `cullInterior` is REFUSED here, by name, with a 400. It is the one option whose cost
 * scales with the input rather than the budget: it runs before decimation, on the
 * full-density mesh, and this route accepts an arbitrary `highPolyPath` from an arbitrary
 * caller, so nothing on this side knows how big that mesh is. The script itself now
 * bounds the walk and refuses above its own ceiling — this refusal is the second layer,
 * not the only one. Nothing in the app has ever set the flag (`finish-routing.ts` refuses
 * it permanently); an in-process caller that has measured its own input can still pass
 * `cullInterior` to `runMeshFinish` directly.
 */
export const CULL_INTERIOR_REFUSAL =
  'cullInterior is not accepted over HTTP: it runs before decimation on the full-density ' +
  'mesh, and this route takes an arbitrary highPolyPath, so the cost is unbounded from ' +
  'here. It also removes nothing on the assembled multi-shell meshes this pipeline ' +
  'produces (select_interior_faces sees only WELDED interior). Re-send without it.';

const MIRROR_AXES: readonly MirrorAxis[] = ['x', 'y', 'z'];
/** Every map the runner knows; a `Record` so a new `BakeMap` cannot be forgotten here. */
const BAKE_MAPS: Record<BakeMap, true> = { normal: true, ao: true, diffuse: true, roughness: true, metallic: true };
/** A bake's cost is the square of this; the script's own docs run 1024-2048. */
const MIN_BAKE_SIZE = 64;
const MAX_BAKE_SIZE = 8192;

/** The refusal for the first field the runner could not honour, or null. Pure. */
function invalidField(body: Record<string, unknown>): string | null {
  const { highPolyPath, outputPath, assetClass, targetFaces, mirror, unwrap, bake, bakeSize } = body;
  if (highPolyPath !== undefined && typeof highPolyPath !== 'string') return 'highPolyPath must be a string';
  if (outputPath !== undefined && typeof outputPath !== 'string') return 'outputPath, when given, must be a string';
  if (assetClass !== undefined && !(ASSET_CLASS_IDS as readonly unknown[]).includes(assetClass)) {
    // An unknown class has no budget, so the run would silently skip retopo altogether.
    return `assetClass must be one of ${ASSET_CLASS_IDS.join(', ')}`;
  }
  if (targetFaces !== undefined && !(Number.isInteger(targetFaces) && (targetFaces as number) > 0)) {
    return 'targetFaces, when given, must be a positive integer (triangles)';
  }
  if (mirror !== undefined && !(MIRROR_AXES as readonly unknown[]).includes(mirror)) {
    return `mirror must be one of ${MIRROR_AXES.join(', ')}`;
  }
  if (unwrap !== undefined && typeof unwrap !== 'boolean') return 'unwrap, when given, must be a boolean';
  if (bake !== undefined && !(Array.isArray(bake) && bake.every((m) => typeof m === 'string' && Object.hasOwn(BAKE_MAPS, m)))) {
    return `bake must be an array of ${Object.keys(BAKE_MAPS).join(', ')}`;
  }
  if (bakeSize !== undefined && !(Number.isInteger(bakeSize) && (bakeSize as number) >= MIN_BAKE_SIZE && (bakeSize as number) <= MAX_BAKE_SIZE)) {
    return `bakeSize, when given, must be an integer from ${MIN_BAKE_SIZE} to ${MAX_BAKE_SIZE}`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = requireOperator(request);
  if (denied) return denied;

  try {
    const parsed = await readJsonObject(request);
    if (!parsed) return apiError(MALFORMED_BODY_ERROR, 400);
    const body = parsed as {
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

    // Refused by name, before anything else — a silently-dropped flag would let a caller
    // read the result as a cull that found nothing. See the header.
    if (cullInterior) return apiError(CULL_INTERIOR_REFUSAL, 400);

    const invalid = invalidField(parsed);
    if (invalid) return apiError(invalid, 400);

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
      { highPolyPath, outputPath, targetFaces, mirror, unwrap, bake, bakeSize },
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
