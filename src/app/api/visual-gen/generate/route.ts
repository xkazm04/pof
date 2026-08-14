import { NextRequest } from 'next/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseImageDataUrl } from '@/lib/visual-gen/triposr-runner';
import { startTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { startHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';
import { startTripoJob } from '@/lib/visual-gen/tripo-job-store';
import { polycountFor } from '@/lib/visual-gen/polycount-presets';
import { providerFaceLimit } from '@/lib/visual-gen/face-budget';

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
    };
    const { mode, providerId, imageDataUrl, prompt, mcResolution, assetClass } = body;
    // The preset budget is authored in TRIANGLES; `providerFaceLimit` converts it to the
    // number the provider's `face_limit` actually counts (halved for quad topology).
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

      const jobId = providerId === 'hunyuan3d'
        ? startHunyuanJob({ imagePath: inPath, outputPath })
        : startTriposrJob({ imagePath: inPath, outputPath, mcResolution, fidelity: true });
      return apiSuccess({ jobId, provider: providerId, mode }, 202);
    }

    if (providerId === 'tripo3d') {
      const { stamp, outputPath } = outFor('tripo3d');
      if (mode === 'text-to-3d') {
        if (!prompt?.trim()) return apiError('Missing prompt for text-to-3d', 400);
        const jobId = startTripoJob({ mode: 'text-to-3d', prompt, outputPath, pbr: true, faceLimit, assetClass });
        return apiSuccess({ jobId, provider: 'tripo3d', mode }, 202);
      }
      if (mode === 'image-to-3d') {
        if (!imageDataUrl) return apiError('Missing imageDataUrl for image-to-3d', 400);
        const inPath = imageToFile('tripo3d', stamp);
        if (!inPath) return apiError('imageDataUrl must be a base64 PNG/JPG/WebP data URL', 400);
        const jobId = startTripoJob({ mode: 'image-to-3d', imagePath: inPath, outputPath, pbr: true, faceLimit, assetClass });
        return apiSuccess({ jobId, provider: 'tripo3d', mode }, 202);
      }
      return apiError('tripo3d supports text-to-3d and image-to-3d', 400);
    }

    return apiError(`Provider "${providerId}" is not wired for local generation (MCP providers use /api/blender-mcp/generate)`, 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to process generation request', 500);
  }
}
