import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { gateInputImage, parseVisionImage } from '@/lib/visual-gen/input-gate';
import { logger } from '@/lib/logger';

/**
 * POST /api/visual-gen/input-gate
 *
 * Tier-0 gate: judge a 2D concept image as INPUT for image→3D (single subject, plain
 * background, near-canonical pose) BEFORE spending generation credits. Warn-first —
 * callers decide what to do with a warn/fail verdict; a gate that cannot run (no
 * QWEN_API_KEY) is an error with the reason, never a silent pass.
 *
 * This is the STANDALONE probe — "score this image on its own". The credit saving is
 * cashed in `POST /api/visual-gen/generate`, which calls the same `gateInputImage`
 * in-process before starting a provider job (no HTTP hop, so the gate cannot be
 * bypassed by a caller that simply forgets to probe first).
 *
 * Body: { imageDataUrl: string, subject?: string }
 * Data: { verdict: 'pass'|'warn'|'fail', score: 0-100, reasons: string[], raw: string }
 */
export async function POST(request: NextRequest) {
  const denied = requireOperator(request);
  if (denied) return denied;
  try {
    const parsed = await readJsonObject(request);
    if (!parsed) return apiError(MALFORMED_BODY_ERROR, 400);
    const body = parsed as { imageDataUrl?: string; subject?: string };
    if (!body.imageDataUrl) return apiError('Missing required field: imageDataUrl', 400);
    if (typeof body.imageDataUrl !== 'string') return apiError('imageDataUrl must be a string', 400);
    if (body.subject != null && typeof body.subject !== 'string') return apiError('subject must be a string', 400);
    const image = parseVisionImage(body.imageDataUrl);
    if (!image) return apiError('imageDataUrl must be a base64 image data URL', 400);

    const startedAt = Date.now();
    const card = await gateInputImage(image, { subject: body.subject });
    // One structured line per outcome: provider, status, duration. Never the image, subject or error text.
    (card.ok ? logger.info : logger.warn)('[visual-gen/input-gate] outcome', {
      provider: 'vision',
      status: card.ok ? 200 : 502,
      ms: Date.now() - startedAt,
    });
    if (!card.ok) return apiError(`input gate could not run: ${card.error}`, 502);
    return apiSuccess(card);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'input gate failed', 500);
  }
}
