import { NextRequest } from 'next/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseImageDataUrl } from '@/lib/visual-gen/triposr-runner';
import { startTriposrJob } from '@/lib/visual-gen/triposr-job-store';

/**
 * POST /api/visual-gen/generate
 *
 * Wired for the zero-budget local pipeline: providerId 'triposr' + mode 'image-to-3d'
 * decodes the uploaded reference image, writes it server-side, and starts a TripoSR
 * job (poll GET /api/visual-gen/generate/status?jobId=...). MCP-backed providers
 * (rodin/hunyuan3d) go through /api/blender-mcp/generate, not here.
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

    if (providerId === 'triposr') {
      if (mode !== 'image-to-3d') return apiError('TripoSR supports image-to-3d only', 400);
      if (!imageDataUrl) return apiError('Missing imageDataUrl for image-to-3d', 400);
      const img = parseImageDataUrl(imageDataUrl);
      if (!img) return apiError('imageDataUrl must be a base64 PNG/JPG/WebP data URL', 400);

      const stamp = Date.now();
      const inPath = join(tmpdir(), `pof_triposr_in_${stamp}.${img.ext}`).replace(/\\/g, '/');
      writeFileSync(inPath, img.buffer);

      const outDir = join(process.cwd(), 'generated', 'triposr').replace(/\\/g, '/');
      mkdirSync(outDir, { recursive: true });
      const outputPath = join(outDir, `${stamp}.glb`).replace(/\\/g, '/');

      const jobId = startTriposrJob({ imagePath: inPath, outputPath, mcResolution, fidelity: true });
      return apiSuccess({ jobId, provider: providerId, mode }, 202);
    }

    return apiError(`Provider "${providerId}" is not wired for local generation (MCP providers use /api/blender-mcp/generate)`, 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to process generation request', 500);
  }
}
