import { apiSuccess, apiError } from '@/lib/api-utils';
import { generateTexture, type ScenarioTextureOptions } from '@/lib/scenario';
import { detectSeamsFromUrl } from '@/lib/visual-gen/seam-check';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== 'string') {
      return apiError('Missing or invalid "prompt" field', 400);
    }
    if (!process.env.SCENARIO_API_KEY) {
      return apiError('SCENARIO_API_KEY not configured', 500);
    }

    const opts: ScenarioTextureOptions = {
      prompt,
      modelId: typeof body?.modelId === 'string' ? body.modelId : undefined,
      width: typeof body?.width === 'number' ? body.width : undefined,
      height: typeof body?.height === 'number' ? body.height : undefined,
    };
    const result = await generateTexture(opts);

    // Seam / tileability pass on the albedo — Scenario's "seamless" output is
    // best-effort, so flag a visible wrap-around mismatch before it reaches UE5.
    // Never let a seam-check failure break generation (detectSeamsFromUrl returns null).
    const seam = result.albedoUrl ? await detectSeamsFromUrl(result.albedoUrl) : null;

    return apiSuccess({ ...result, seam });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[api/scenario] ${message}`);
    return apiError(message, 500);
  }
}
