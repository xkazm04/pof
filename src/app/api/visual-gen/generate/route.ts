import { NextRequest } from 'next/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseImageDataUrl } from '@/lib/visual-gen/triposr-runner';
import { startTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { startHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';
import { startTripoJob } from '@/lib/visual-gen/tripo-job-store';
import { polycountFor, resolveAssetClass } from '@/lib/visual-gen/polycount-presets';
import { providerFaceLimit } from '@/lib/visual-gen/face-budget';
import { tripoModelFor } from '@/lib/visual-gen/tripo-models';

/**
 * POST /api/visual-gen/generate
 *
 * Image/text-to-3D pipeline. Two routes behind one endpoint:
 *  - LOCAL (open-source, GPU): 'hunyuan3d' (OFFICIAL, ~360K-face) + 'triposr' (MIT
 *    fallback) — image-to-3d only; decode the uploaded image, write it server-side,
 *    start a job.
 *  - CLOUD (Tripo3D REST API): 'tripo3d' — text-to-3d OR image-to-3d, no local VRAM,
 *    PBR-textured output (free tier is non-commercial). Needs env TRIPO_API_KEY.
 * Both start a job (poll GET /api/visual-gen/generate/status?jobId=...). MCP-backed
 * providers (rodin) go through /api/blender-mcp/generate, not here.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      mode?: string;
      providerId?: string;
      imageDataUrl?: string;
      prompt?: string;
      mcResolution?: number;
      assetClass?: string;
      maxAttempts?: number;
      topology?: string;
    };
    const { mode, providerId, imageDataUrl, prompt, mcResolution, assetClass, maxAttempts, topology } = body;

    // Quad topology is REACHABLE but refused, rather than silently unavailable. Tripo
    // delivers a quad request as FBX, and every consumer downstream of this route assumes
    // GLB: the GlbViewer, `pof_mesh_critique.py`'s trimesh load (which feeds the Tier-1
    // gate), and the UE .glb import. Writing FBX bytes to the .glb path this route builds
    // would make the extension lie to all three — `formatMismatchReason` in tripo-runner
    // exists to catch exactly that. Enabling quad is a format-conversion change, not a
    // flag, so the refusal names what has to happen first instead of pretending the
    // option does not exist.
    if (topology === 'quads') {
      return apiError(
        'quad topology is not wired: Tripo delivers a quad request as FBX, and this route writes a .glb consumed by the GlbViewer, the trimesh Tier-1 gate, and the UE .glb import. Enabling it needs a format-aware output path (or an FBX→GLB conversion) first — see tripo-runner formatMismatchReason.',
        400,
      );
    }
    if (topology !== undefined && topology !== 'triangles') {
      return apiError(`unknown topology "${topology}" — expected "triangles" or "quads"`, 400);
    }
    // The preset budget is authored in TRIANGLES; `providerFaceLimit` converts it to the
    // number the provider's `face_limit` actually counts (halved for quad topology).
    const gradedAs = resolveAssetClass(assetClass).gradedAs;
    const triangleBudget = assetClass ? polycountFor(assetClass)?.faceLimit : undefined;
    const faceLimit = triangleBudget !== undefined
      ? providerFaceLimit({ triangleBudget, topology: 'triangles' })
      : undefined;

    if (!mode || !providerId) return apiError('Missing required fields: mode, providerId', 400);

    const outFor = (id: string) => {
      const stamp = Date.now();
      const outDir = join(process.cwd(), 'generated', id).replace(/\\/g, '/');
      mkdirSync(outDir, { recursive: true });
      return { stamp, outputPath: join(outDir, `${stamp}.glb`).replace(/\\/g, '/') };
    };
    const imageToFile = (id: string, stamp: number) => {
      const img = imageDataUrl ? parseImageDataUrl(imageDataUrl) : null;
      if (!img) return null;
      const inPath = join(tmpdir(), `pof_${id}_in_${stamp}.${img.ext}`).replace(/\\/g, '/');
      writeFileSync(inPath, img.buffer);
      return inPath;
    };

    if (providerId === 'hunyuan3d' || providerId === 'triposr') {
      if (mode !== 'image-to-3d') return apiError(`${providerId} supports image-to-3d only`, 400);
      if (!imageDataUrl) return apiError('Missing imageDataUrl for image-to-3d', 400);
      const { stamp, outputPath } = outFor(providerId);
      const inPath = imageToFile(providerId, stamp);
      if (!inPath) return apiError('imageDataUrl must be a base64 PNG/JPG/WebP data URL', 400);

      // `assetClass` is OPTIONAL and its default is stated, never guessed: absent (or
      // unrecognised) input grades class-blind and `gradedAs` says so, because promoting
      // a missing class to a "typical" one would fail an assembled character against a
      // prop's component budget. Until this arrived, the local stores graded every mesh
      // against the class-blind 200k ceiling with nothing anywhere admitting it.
      const jobId = providerId === 'hunyuan3d'
        ? startHunyuanJob({ imagePath: inPath, outputPath, assetClass })
        : startTriposrJob({ imagePath: inPath, outputPath, mcResolution, fidelity: true, assetClass });
      return apiSuccess({ jobId, provider: providerId, mode, gradedAs: resolveAssetClass(assetClass).gradedAs }, 202);
    }

    if (providerId === 'tripo3d') {
      const { stamp, outputPath } = outFor('tripo3d');
      // Never leave model_version unset — the character-pipeline arena graded the silent
      // account default a FAIL. `tripoModelFor` pins the one model it graded PASS, with
      // the texture quality both recorded pass recipes call for.
      const pin = tripoModelFor(assetClass);
      const tripoPin = { modelVersion: pin.modelVersion, textureQuality: pin.textureQuality };
      if (mode === 'text-to-3d') {
        if (!prompt?.trim()) return apiError('Missing prompt for text-to-3d', 400);
        const jobId = startTripoJob({ mode: 'text-to-3d', prompt, outputPath, pbr: true, faceLimit, assetClass, maxAttempts, ...tripoPin });
        return apiSuccess({ jobId, provider: 'tripo3d', mode, gradedAs }, 202);
      }
      if (mode === 'image-to-3d') {
        if (!imageDataUrl) return apiError('Missing imageDataUrl for image-to-3d', 400);
        const inPath = imageToFile('tripo3d', stamp);
        if (!inPath) return apiError('imageDataUrl must be a base64 PNG/JPG/WebP data URL', 400);
        const jobId = startTripoJob({ mode: 'image-to-3d', imagePath: inPath, outputPath, pbr: true, faceLimit, assetClass, maxAttempts, ...tripoPin });
        return apiSuccess({ jobId, provider: 'tripo3d', mode, gradedAs }, 202);
      }
      return apiError('tripo3d supports text-to-3d and image-to-3d', 400);
    }

    return apiError(`Provider "${providerId}" is not wired for local generation (MCP providers use /api/blender-mcp/generate)`, 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to process generation request', 500);
  }
}
