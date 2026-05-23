import { apiSuccess, apiError } from '@/lib/api-utils';
import { generateImage, upscaleImage, generateTextureOn3DModel, type GenerateImageOptions } from '@/lib/leonardo';
import { logger } from '@/lib/logger';

type Mode = 'image' | 'upscale' | 'texture3d';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode: Mode = body?.mode ?? 'image';

    if (!process.env.LEONARDO_API_KEY) {
      return apiError('LEONARDO_API_KEY not configured', 500);
    }

    if (mode === 'image') {
      const prompt = body?.prompt;
      if (!prompt || typeof prompt !== 'string') return apiError('Missing or invalid "prompt" field', 400);
      if (prompt.length > 1500) return apiError('Prompt exceeds 1500 character limit', 400);
      const opts: GenerateImageOptions = body?.opts ?? {};
      const result = await generateImage(prompt, opts);
      return apiSuccess(result);
    }

    if (mode === 'upscale') {
      const imageId = body?.imageId;
      if (!imageId || typeof imageId !== 'string') return apiError('Missing "imageId" for upscale', 400);
      const result = await upscaleImage(imageId, typeof body?.style === 'string' ? body.style : 'GENERAL');
      return apiSuccess(result);
    }

    if (mode === 'texture3d') {
      const { objBase64, prompt, preview } = body ?? {};
      if (!objBase64 || typeof objBase64 !== 'string') return apiError('Missing "objBase64" for texture3d', 400);
      if (!prompt || typeof prompt !== 'string') return apiError('Missing "prompt" for texture3d', 400);
      const objBytes = new Uint8Array(Buffer.from(objBase64, 'base64'));
      const result = await generateTextureOn3DModel({ objBytes, prompt, preview: Boolean(preview) });
      return apiSuccess(result);
    }

    return apiError(`Unknown mode "${String(mode)}"`, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[api/leonardo] ${message}`);
    return apiError(message, 500);
  }
}
