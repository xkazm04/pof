import { NextRequest } from 'next/server';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { runFbxConvert, type FbxConvertResponse } from '@/lib/visual-gen/fbx-convert';
import { assetUrl, safeAssetName } from '@/lib/visual-gen/generated-assets';

/** The one dir a conversion may write into. Must be a member of `ASSET_DIRS`. */
const CONVERT_OUTPUT_DIR = 'converted';

const ABSOLUTE = /^(?:[A-Za-z]:\/|\/)/;

/** `<stem>.glb` from an FBX basename, reduced to a safe generated-asset name. Pure. */
function outputNameFor(inputPath: string): string {
  const base = inputPath.split('/').pop() ?? '';
  const stem = base.replace(/\.fbx$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[^A-Za-z0-9]+/, '');
  return safeAssetName(`${stem}.glb`) ?? 'converted.glb';
}

/**
 * POST /api/visual-gen/fbx-convert
 *
 * Convert ONE operator FBX file into a GLB with a headless Blender (`runFbxConvert`) —
 * never through the Blender MCP bridge, so the operator's open scene is never touched
 * and Blender need not be running.
 *
 * Body: `{ inputPath, draco? }` — `inputPath` is an ABSOLUTE path to an existing `.fbx`.
 * The output is always `generated/converted/<stem>.glb`, derived from the validated
 * basename: no caller string reaches the output path, and the result is servable through
 * the `ASSET_DIRS` allow-list (`url`) by the viewer, the gate and the UE import plan.
 *
 * A refusal (no mesh in the FBX, Blender absent, GLB not written) is a 200 with
 * `converted: false` and its reason — the mesh-split contract. Only a malformed request
 * is an error.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { inputPath?: unknown; draco?: unknown };
    const inputPath = typeof body.inputPath === 'string' ? body.inputPath.trim().replace(/\\/g, '/') : '';

    if (!/\.fbx$/i.test(inputPath)) return apiError('inputPath must name an .fbx file', 400);
    if (!ABSOLUTE.test(inputPath)) return apiError('inputPath must be an absolute path (e.g. "C:/Assets/model.fbx")', 400);
    if (!existsSync(inputPath)) return apiError(`FBX not found at ${inputPath}`, 404);

    const name = outputNameFor(inputPath);
    const outputDir = join(process.cwd(), 'generated', CONVERT_OUTPUT_DIR).replace(/\\/g, '/');
    mkdirSync(outputDir, { recursive: true });

    const result = await runFbxConvert({
      inputPath,
      outputPath: `${outputDir}/${name}`,
      draco: body.draco === true,
    });

    const answer: FbxConvertResponse = result.ok
      ? {
        converted: true,
        name,
        url: assetUrl(name, CONVERT_OUTPUT_DIR),
        meshes: result.meshes,
        tris: result.tris,
        bytes: result.bytes,
        durationMs: result.durationMs,
      }
      : { converted: false, reason: result.error ?? 'the conversion wrote no GLB and gave no reason', durationMs: result.durationMs };
    return apiSuccess(answer);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to convert FBX', 500);
  }
}
