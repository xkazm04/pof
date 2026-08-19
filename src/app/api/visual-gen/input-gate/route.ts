import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { gateInputImage, parseVisionImage } from '@/lib/visual-gen/input-gate';

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
  try {
    const body = (await request.json()) as { imageDataUrl?: string; subject?: string };
    if (!body.imageDataUrl) return apiError('Missing required field: imageDataUrl', 400);
    const image = parseVisionImage(body.imageDataUrl);
    if (!image) return apiError('imageDataUrl must be a base64 image data URL', 400);

    const card = await gateInputImage(image, { subject: body.subject });
    if (!card.ok) return apiError(`input gate could not run: ${card.error}`, 502);
    return apiSuccess(card);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'input gate failed', 500);
  }
}
