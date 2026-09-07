import { NextRequest } from 'next/server';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { runMeshSplit } from '@/lib/visual-gen/mesh-split';
import { safeAssetDir, safeAssetName, assetUrl } from '@/lib/visual-gen/generated-assets';

/** The one dir a split may write into. Must be a member of `ASSET_DIRS`. */
const SPLIT_OUTPUT_DIR = 'mesh-split';

/**
 * POST /api/visual-gen/mesh-split
 *
 * Separate ONE generated GLB that holds several distinct objects into one asset per
 * object. The paying use is credit amortisation: a generator charges per job, so asking
 * one image-to-3D job for a small group of simple props (a well, a lamp post, two
 * barrels) and separating them here costs one job instead of four, and each separated
 * prop lands under its class budget with no decimation.
 *
 * Body: `{ name, dir?, minFaceShare?, maxParts?, minCoverage?, center? }` — `name` is a
 * BASENAME inside `generated/<dir>/`, never a path, and the output is always inside
 * `generated/mesh-split/`. Unlike an arbitrary `inputPath`/`outputDir`, nothing here can
 * name a file outside the `ASSET_DIRS` allow-list in either direction.
 *
 * A refusal is a 200 with `split: false` and the reason, because the most important
 * answer this endpoint gives is a refusal: a SHATTERED single object and a GROUP of
 * objects look identical to a component count, and splitting the former manufactures
 * assets out of debris. Measured on `props__crate.glb` — one crate, 451 loose components
 * — the parts above the speck threshold covered 23% of the faces, and the coverage floor
 * is what turns that into "run mesh-finish on it instead" rather than 24 junk assets.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string; dir?: string;
      minFaceShare?: number; maxParts?: number; minCoverage?: number; center?: boolean;
    };

    const name = safeAssetName((body.name ?? '').trim());
    if (!name) return apiError('name must be a safe generated-asset basename (e.g. "props_group.glb")', 400);
    const dir = safeAssetDir(body.dir);
    if (!dir) return apiError(`dir "${body.dir}" is not a servable generated dir`, 400);

    const inputPath = join(process.cwd(), 'generated', dir.dir, name).replace(/\\/g, '/');
    if (!existsSync(inputPath)) return apiError(`mesh not found at generated/${dir.dir}/${name}`, 404);

    const outputDir = join(process.cwd(), 'generated', SPLIT_OUTPUT_DIR).replace(/\\/g, '/');
    mkdirSync(outputDir, { recursive: true });

    // The prefix is derived from the already-validated basename, so no caller-supplied
    // string ever reaches a filename.
    const prefix = name.replace(/\.[^.]+$/, '');

    const result = await runMeshSplit({
      inputPath,
      outputDir,
      prefix,
      minFaceShare: body.minFaceShare,
      maxParts: body.maxParts,
      minCoverage: body.minCoverage,
      center: body.center,
    });

    if (!result.ok) {
      return apiSuccess({
        split: false,
        reason: result.error ?? 'the split produced no asset and gave no reason',
        components: result.components,
        coverage: result.coverage,
        facesIn: result.facesIn,
        durationMs: result.durationMs,
      });
    }

    return apiSuccess({
      split: true,
      facesIn: result.facesIn,
      components: result.components,
      coverage: result.coverage,
      discarded: result.discarded,
      discardedFaces: result.discardedFaces,
      capped: result.capped,
      parts: result.parts.map((p) => ({
        name: p.name,
        faces: p.faces,
        share: p.share,
        url: assetUrl(p.name, SPLIT_OUTPUT_DIR),
      })),
      durationMs: result.durationMs,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to split mesh', 500);
  }
}
