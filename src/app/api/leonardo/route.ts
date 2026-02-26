import { apiSuccess, apiError } from '@/lib/api-utils';
import { generateImage } from '@/lib/leonardo';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== 'string') {
      return apiError('Missing or invalid "prompt" field', 400);
    }

    if (prompt.length > 1500) {
      return apiError('Prompt exceeds 1500 character limit', 400);
    }

    if (!process.env.LEONARDO_API_KEY) {
      return apiError('LEONARDO_API_KEY not configured', 500);
    }

    const result = await generateImage(prompt);

    return apiSuccess({
      imageUrl: result.imageUrl,
      generationId: result.generationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[api/leonardo] ${message}`);
    return apiError(message, 500);
  }
}
