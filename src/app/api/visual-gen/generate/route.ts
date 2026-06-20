import { NextRequest } from 'next/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseImageDataUrl } from '@/lib/visual-gen/triposr-runner';
import { startTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { startHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';

/**
 * POST /api/visual-gen/generate
 *
 * Local image-to-3D pipeline. The OFFICIAL provider is 'hunyuan3d' (Hunyuan3D-2 shape,
 * ~360K-face high-detail); 'triposr' is the MIT/commercial-safe fallback. Both decode
 * the uploaded reference image, write it server-side, and start a job (poll
 * GET /api/visual-gen/generate/status?jobId=...). MCP-backed providers (rodin) go
 * through /api/blender-mcp/generate, not here.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      mode?: string;
      providerId?: string;
      imageDataUrl?: string;
      mcResolution?: number;
    };
    const { mode, providerId, imageDataUrl, mcResolution } = body;

    if (!mode || !providerId) return apiError('Missing required fields: mode, providerId', 400);

    if (providerId === 'hunyuan3d' || providerId === 'triposr') {
      if (mode !== 'image-to-3d') return apiError(`${providerId} supports image-to-3d only`, 400);
      if (!imageDataUrl) return apiError('Missing imageDataUrl for image-to-3d', 400);
      const img = parseImageDataUrl(imageDataUrl);
      if (!img) return apiError('imageDataUrl must be a base64 PNG/JPG/WebP data URL', 400);

      const stamp = Date.now();
      const inPath = join(tmpdir(), `pof_${providerId}_in_${stamp}.${img.ext}`).replace(/\\/g, '/');
      writeFileSync(inPath, img.buffer);

      const outDir = join(process.cwd(), 'generated', providerId).replace(/\\/g, '/');
      mkdirSync(outDir, { recursive: true });
      const outputPath = join(outDir, `${stamp}.glb`).replace(/\\/g, '/');

      const jobId = providerId === 'hunyuan3d'
        ? startHunyuanJob({ imagePath: inPath, outputPath })
        : startTriposrJob({ imagePath: inPath, outputPath, mcResolution, fidelity: true });
      return apiSuccess({ jobId, provider: providerId, mode }, 202);
    }

    return apiError(`Provider "${providerId}" is not wired for local generation (MCP providers use /api/blender-mcp/generate)`, 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to process generation request', 500);
  }
}
